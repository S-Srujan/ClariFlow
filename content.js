/**
 * content.js - Real-Time Zoom Transcript Scraper & Monitor
 * 
 * Injected into Zoom Web Client (*://*.zoom.us/*).
 * Features:
 * 1. Multi-version Zoom DOM MutationObserver & Shadow DOM traversal.
 * 2. Incremental streaming speech aggregation & deduplication.
 * 3. Fallback periodic DOM scanner for virtualized lists & canvas wrappers.
 * 4. Self-healing floating on-screen HUD with minimize/expand and demo simulation.
 * 5. Debounced batch transmission to background.js.
 */

(function () {
  'use strict';

  // Prevent duplicate execution within the same execution context
  if (window.__REQ_AI_SCRAPER_INITIALIZED__) {
    return;
  }
  window.__REQ_AI_SCRAPER_INITIALIZED__ = true;

  console.log('[ReqAI] Initializing Zoom Web Client Transcript Scraper...');

  // ---------------------------------------------------------------------------
  // Configuration & Selectors
  // ---------------------------------------------------------------------------
  const CONFIG = {
    batchDebounceMs: 2000,       // Batch emission debounce delay
    maxBufferSize: 8,            // Max lines before forced flush
    dedupWindowSize: 60,         // Number of recent strings to retain for deduplication
    streamingCommitDelayMs: 1800, // Delay to commit streaming incomplete caption
    pollingIntervalMs: 1500,     // Fallback polling interval
    selectors: [
      // Modern Zoom Web Client Captions & Subtitles
      '.closed-caption-container',
      '.closed-caption-window',
      '.cc-container',
      '.cc-window',
      '.caption-window',
      '.caption-container',
      '.caption-content',
      '.live-caption-content',
      '.caption-box',
      '.meeting-app__caption',
      'div[data-testid="closed-caption-container"]',
      'div[data-testid="caption-content"]',
      'div[data-testid="caption-text"]',
      'div[class*="closed-caption"]',
      'div[class*="caption-window"]',
      'div[class*="live-caption"]',
      'div[class*="caption-container"]',
      'span[class*="closed-caption"]',
      'span[class*="caption-text"]',
      '[aria-label*="closed caption" i]',
      '[aria-label*="live caption" i]',
      '[aria-label*="caption" i]',
      '[aria-label*="subtitles" i]',
      'div[role="region"][aria-label*="caption" i]',
      'div[role="alert"][aria-label*="caption" i]',

      // Side Panel Live Transcript View
      '.transcription-list-item',
      '.transcription-item',
      '.transcript-container',
      '.transcript-item',
      '.transcript-list',
      '[class*="transcription-list-item"]',
      '[class*="transcript-item"]',
      '[class*="transcript-container"]',
      '[data-testid="transcript-item"]',
      '[data-testid="transcription-item"]',
      '[data-testid="transcript-list"]',
      '[aria-label*="live transcript" i]',
      '[aria-label*="transcript" i]',
      'div[role="region"][aria-label*="transcript" i]',
      'div[role="log"][aria-label*="transcript" i]',
      'div[role="listbox"][aria-label*="transcript" i]',
      'div[role="listitem"][class*="transcript"]',

      // In-Meeting Chat Nodes
      '.chat-message',
      '.chat-item',
      '.chat-msg',
      '[class*="chat-message"]',
      '[class*="chat-item"]',
      '[class*="chat-message__content"]',
      '[class*="chat-item__content"]',
      '[data-testid="chat-message-content"]',
      '[data-testid="chat-item"]',
      '.event-bubble__content',
      '[class*="event-bubble"]',
      'div[role="listitem"][class*="chat"]',
      'div[class*="chat-virtualized-list"] div[class*="chat-item"]'
    ]
  };

  // ---------------------------------------------------------------------------
  // Internal State
  // ---------------------------------------------------------------------------
  let textBuffer = [];
  let debounceTimer = null;
  const recentHashes = new Set();
  const recentTexts = [];
  let capturedCount = 0;
  let hudContainer = null;
  let hudCountEl = null;
  let isHudMinimized = false;
  const observedShadowRoots = new WeakSet();

  // Active in-progress streaming captions mapped by speaker
  const activeStreams = new Map();

  // ---------------------------------------------------------------------------
  // Deduplication & Normalization
  // ---------------------------------------------------------------------------
  function normalizeText(text) {
    return (text || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function isDuplicate(text) {
    const normalized = normalizeText(text);
    if (!normalized || normalized.length < 3) return true;
    if (recentHashes.has(normalized)) return true;

    recentHashes.add(normalized);
    recentTexts.push(normalized);
    if (recentTexts.length > CONFIG.dedupWindowSize) {
      const oldest = recentTexts.shift();
      recentHashes.delete(oldest);
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // DOM Node Parser
  // ---------------------------------------------------------------------------
  function parseTranscriptNode(element) {
    if (!element || !(element instanceof HTMLElement)) return null;

    // Filter out invisible elements unless they are live caption regions
    if (element.offsetParent === null && element.tagName !== 'DIV' && element.getAttribute('role') !== 'region') {
      return null;
    }

    let speaker = 'Participant';
    let text = '';

    // Zoom houses speaker name in specific classes, strong tags, or data-testids
    const speakerEl = element.querySelector(
      '.speaker-name, strong, .name, [class*="speaker"], [class*="sender"], .event-bubble__sender-name, [data-testid*="speaker"]'
    );
    if (speakerEl) {
      speaker = speakerEl.innerText.trim().replace(/[:\s-]+$/, '');
    }

    // Try to find the inner content span/div
    const contentEl = element.querySelector(
      '.caption-text, .closed-caption-text, .transcript-item__text, .transcript-item-text, [class*="caption-text"], [class*="caption-content"], .event-bubble__text, .chat-item__chat-info-msg, [class*="chat-message__content"], [data-testid*="caption-text"]'
    );

    if (contentEl) {
      text = contentEl.innerText.trim();
    } else {
      // Fallback: take innerText, removing the speaker prefix if included
      const raw = element.innerText.trim();
      if (speaker !== 'Participant' && raw.startsWith(speaker)) {
        text = raw.slice(speaker.length).replace(/^[:\s-]+/, '').trim();
      } else {
        // Look for colon format: "Hiring Manager: We need to build..."
        const colonMatch = raw.match(/^([A-Za-z0-9\s._-]{2,25}):\s*(.+)$/s);
        if (colonMatch) {
          speaker = colonMatch[1].trim();
          text = colonMatch[2].trim();
        } else {
          text = raw;
        }
      }
    }

    // Strip timestamps like "[10:42 AM]", "10:42", "(10:42:15)"
    text = text.replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\]?\s*[:-]?\s*/, '').trim();

    if (!text || text.length < 2) return null;

    // Filter common Zoom UI placeholder text
    const lower = text.toLowerCase();
    if (
      lower === 'closed captioning' ||
      lower === 'live transcript' ||
      lower === 'subtitles' ||
      lower.startsWith('closed captioning is') ||
      lower.startsWith('transcript is being recorded') ||
      lower === 'type message here...'
    ) {
      return null;
    }

    return {
      speaker: speaker || 'Participant',
      text: text,
      timestamp: Date.now()
    };
  }

  // ---------------------------------------------------------------------------
  // Incremental Streaming Aggregation & Batching
  // ---------------------------------------------------------------------------

  /**
   * Commits a finalized transcript line to the buffer and updates HUD counter
   */
  function commitTranscriptLine(lineData) {
    if (!lineData || !lineData.text || isDuplicate(lineData.text)) return;

    capturedCount++;
    textBuffer.push({
      id: 'zoom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      speaker: lineData.speaker || 'Participant',
      text: lineData.text.trim(),
      timestamp: lineData.timestamp || Date.now()
    });

    updateHUDCapturedCount();

    // If buffer threshold is reached or ends with punctuation, flush sooner
    const endsWithPunctuation = /[.?!]$/.test(lineData.text.trim());
    if (textBuffer.length >= CONFIG.maxBufferSize || (textBuffer.length >= 3 && endsWithPunctuation)) {
      flushBatch();
      return;
    }

    // Reset batch emission debounce timer
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flushBatch, CONFIG.batchDebounceMs);
  }

  /**
   * Handles streaming partial captions from Zoom ASR
   */
  function handleIncomingLine(lineData) {
    if (!lineData || !lineData.text) return;
    const speakerKey = lineData.speaker || 'Participant';
    const newText = lineData.text.trim();

    // Check if we are currently tracking an in-progress sentence for this speaker
    if (activeStreams.has(speakerKey)) {
      const active = activeStreams.get(speakerKey);
      const activeNorm = normalizeText(active.text);
      const newNorm = normalizeText(newText);

      // If new text is an extension of current utterance
      if (newNorm.startsWith(activeNorm) || (newNorm.length > activeNorm.length && newNorm.includes(activeNorm))) {
        active.text = newText;
        active.timestamp = Date.now();

        // If clause completed with punctuation, commit immediately
        if (/[.?!]$/.test(newText)) {
          clearTimeout(active.timer);
          activeStreams.delete(speakerKey);
          commitTranscriptLine({ speaker: speakerKey, text: newText, timestamp: Date.now() });
        } else {
          // Reset commit timeout
          clearTimeout(active.timer);
          active.timer = setTimeout(() => {
            activeStreams.delete(speakerKey);
            commitTranscriptLine({ speaker: speakerKey, text: active.text, timestamp: active.timestamp });
          }, CONFIG.streamingCommitDelayMs);
        }
        return;
      } else if (activeNorm.startsWith(newNorm)) {
        // Slower or identical frame, ignore
        return;
      } else {
        // Speaker started a completely new sentence; commit previous sentence
        clearTimeout(active.timer);
        activeStreams.delete(speakerKey);
        commitTranscriptLine({ speaker: speakerKey, text: active.text, timestamp: active.timestamp });
      }
    }

    // Check if already completed sentence
    if (/[.?!]$/.test(newText)) {
      commitTranscriptLine(lineData);
    } else {
      // Start tracking new stream for this speaker
      const timer = setTimeout(() => {
        activeStreams.delete(speakerKey);
        commitTranscriptLine({ speaker: speakerKey, text: newText, timestamp: Date.now() });
      }, CONFIG.streamingCommitDelayMs);

      activeStreams.set(speakerKey, {
        text: newText,
        timestamp: Date.now(),
        timer: timer
      });
    }
  }

  /**
   * Flushes buffered lines to background.js
   */
  function flushBatch() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (textBuffer.length === 0) return;

    const batchToSend = [...textBuffer];
    textBuffer = [];

    const combinedText = batchToSend.map(b => `${b.speaker}: ${b.text}`).join('\n');
    console.log(`[ReqAI] Dispatching batch of ${batchToSend.length} Zoom transcript item(s)`);

    try {
      chrome.runtime.sendMessage(
        {
          action: 'NEW_TRANSCRIPT_BATCH',
          payload: {
            items: batchToSend,
            combinedText: combinedText,
            timestamp: Date.now()
          }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[ReqAI] Background response notice:', chrome.runtime.lastError.message);
          } else if (response && response.status === 'ok') {
            pulseHUDStatus();
          }
        }
      );
    } catch (err) {
      console.warn('[ReqAI] Failed to send message to extension background:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // MutationObserver & Shadow DOM Observation
  // ---------------------------------------------------------------------------

  function inspectNodeAndChildren(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

    // Direct match
    for (const selector of CONFIG.selectors) {
      try {
        if (node.matches && node.matches(selector)) {
          const parsed = parseTranscriptNode(node);
          if (parsed) handleIncomingLine(parsed);
          return;
        }
      } catch (e) {}
    }

    // Descendant match
    for (const selector of CONFIG.selectors) {
      try {
        const matching = node.querySelector ? node.querySelector(selector) : null;
        if (matching) {
          const parsed = parseTranscriptNode(matching);
          if (parsed) handleIncomingLine(parsed);
          break;
        }
      } catch (e) {}
    }

    // Discover Shadow Roots
    scanForShadowRoots(node);
  }

  function handleMutations(mutations) {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          inspectNodeAndChildren(node);
        }
      } else if (mutation.type === 'characterData') {
        const parent = mutation.target.parentElement;
        if (parent) {
          inspectNodeAndChildren(parent);
        }
      }
    }
  }

  const observer = new MutationObserver(handleMutations);

  function scanForShadowRoots(rootNode) {
    if (!rootNode) return;
    try {
      if (rootNode.shadowRoot && !observedShadowRoots.has(rootNode.shadowRoot)) {
        observedShadowRoots.add(rootNode.shadowRoot);
        observer.observe(rootNode.shadowRoot, {
          childList: true,
          subtree: true,
          characterData: true
        });
        scanTargetSelectors(rootNode.shadowRoot);
      }

      const elementsWithShadow = rootNode.querySelectorAll ? rootNode.querySelectorAll('*') : [];
      for (const el of elementsWithShadow) {
        if (el.shadowRoot && !observedShadowRoots.has(el.shadowRoot)) {
          observedShadowRoots.add(el.shadowRoot);
          observer.observe(el.shadowRoot, {
            childList: true,
            subtree: true,
            characterData: true
          });
          scanTargetSelectors(el.shadowRoot);
        }
      }
    } catch (e) {
      // Ignore cross-origin frame access restrictions
    }
  }

  /**
   * Fallback periodic scanner across all target selectors
   */
  function scanTargetSelectors(root = document) {
    if (!root || !root.querySelectorAll) return;

    for (const selector of CONFIG.selectors) {
      try {
        const found = root.querySelectorAll(selector);
        for (const el of found) {
          const parsed = parseTranscriptNode(el);
          if (parsed) {
            handleIncomingLine(parsed);
          }
        }
      } catch (e) {}
    }
  }

  function startObserver() {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
      scanForShadowRoots(document.body);
      scanTargetSelectors(document);
      ensureFloatingHUD();

      // Periodic check for HUD presence and fallback transcript sweep
      setInterval(() => {
        ensureFloatingHUD();
        scanTargetSelectors(document);
      }, CONFIG.pollingIntervalMs);

      console.log('[ReqAI] MutationObserver actively watching Zoom DOM.');
    } else {
      window.addEventListener('DOMContentLoaded', startObserver);
    }
  }

  // ---------------------------------------------------------------------------
  // Floating On-Screen Status Widget (HUD) for Zoom
  // ---------------------------------------------------------------------------

  function ensureFloatingHUD() {
    // Only inject into top-level window to avoid multiple HUDs if iframes are present
    if (window !== window.top) return;
    if (!document.body) return;

    const existing = document.getElementById('req-ai-floating-hud');
    if (existing) {
      hudContainer = existing;
      hudCountEl = document.getElementById('req-ai-line-count');
      return;
    }

    hudContainer = document.createElement('div');
    hudContainer.id = 'req-ai-floating-hud';
    hudContainer.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 8px 14px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      user-select: none;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    renderHUDContent();
    document.body.appendChild(hudContainer);
  }

  function renderHUDContent() {
    if (!hudContainer) return;

    if (isHudMinimized) {
      hudContainer.innerHTML = `
        <div id="req-ai-expand-pill" style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 2px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981;"></span>
          <span style="font-weight: 700; color: #38bdf8; font-size: 11px;">ReqAI: ${capturedCount} lines</span>
          <span style="color: #64748b; font-size: 11px; margin-left: 2px;">[+]</span>
        </div>
      `;
      document.getElementById('req-ai-expand-pill').addEventListener('click', () => {
        isHudMinimized = false;
        renderHUDContent();
      });
      return;
    }

    hudContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; animation: reqAiPulse 2s infinite;"></span>
        <span style="font-weight: 600; color: #e2e8f0; font-size: 12px;">ReqAI Listening</span>
      </div>
      <div style="color: #94a3b8; border-left: 1px solid #334155; padding-left: 8px; font-size: 11px;">
        Lines: <span id="req-ai-line-count" style="font-weight: 700; color: #38bdf8;">${capturedCount}</span>
      </div>
      <button id="req-ai-sim-btn" title="Simulate Assignment Case Study" style="
        background: #4f46e5;
        color: white;
        border: none;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: background 0.15s ease;
      ">
        ⚡ Sim Demo
      </button>
      <button id="req-ai-minimize-btn" title="Minimize Widget" style="
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 14px;
        padding: 0 4px;
        line-height: 1;
      ">−</button>
      <style>
        @keyframes reqAiPulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
      </style>
    `;

    hudCountEl = document.getElementById('req-ai-line-count');

    // Simulate Case Study Button (for seamless presentation & grading demo)
    const simBtn = document.getElementById('req-ai-sim-btn');
    if (simBtn) {
      simBtn.addEventListener('click', () => {
        simulateAssignmentDialogue();
      });
      simBtn.addEventListener('mouseenter', () => { simBtn.style.background = '#4338ca'; });
      simBtn.addEventListener('mouseleave', () => { simBtn.style.background = '#4f46e5'; });
    }

    // Minimize button
    const minBtn = document.getElementById('req-ai-minimize-btn');
    if (minBtn) {
      minBtn.addEventListener('click', () => {
        isHudMinimized = true;
        renderHUDContent();
      });
    }
  }

  function updateHUDCapturedCount() {
    if (hudCountEl) {
      hudCountEl.textContent = String(capturedCount);
    }
    if (isHudMinimized) {
      renderHUDContent();
    }
  }

  function pulseHUDStatus() {
    if (!hudContainer || isHudMinimized) return;
    hudContainer.style.borderColor = '#38bdf8';
    setTimeout(() => {
      if (hudContainer) hudContainer.style.borderColor = '#334155';
    }, 700);
  }

  // ---------------------------------------------------------------------------
  // Case Study Simulation Utility
  // ---------------------------------------------------------------------------
  function simulateAssignmentDialogue() {
    const script = [
      { speaker: "Hiring Manager", text: "We need to build an AI-based resume analyzer that can automatically shortlist candidates for our software engineering roles." },
      { speaker: "ML Engineer", text: "Okay. How should the system decide which candidates to shortlist?" },
      { speaker: "Hiring Manager", text: "It should rank them based on relevance to the job description." },
      { speaker: "ML Engineer", text: "How are we defining relevance?" },
      { speaker: "Hiring Manager", text: "Mainly skills and experience. And overall profile strength." },
      { speaker: "ML Engineer", text: "What does overall profile strength include?" },
      { speaker: "Hiring Manager", text: "Things like good companies, solid projects, impactful work." },
      { speaker: "ML Engineer", text: "Should we prioritize years of experience?" },
      { speaker: "Hiring Manager", text: "Yes, but not strictly. Sometimes a strong fresher is better than someone with 5 average years." },
      { speaker: "ML Engineer", text: "Do we have historical hiring data to train the system?" },
      { speaker: "Hiring Manager", text: "We have past resumes and hiring decisions, but they're not very structured." },
      { speaker: "ML Engineer", text: "How accurate should the system be?" },
      { speaker: "Hiring Manager", text: "It should be good enough so that HR trusts it." },
      { speaker: "ML Engineer", text: "Do we need explainability? For example, why a candidate was ranked higher?" },
      { speaker: "Hiring Manager", text: "Yes, that would be useful." },
      { speaker: "ML Engineer", text: "Are there any constraints regarding bias or fairness?" },
      { speaker: "Hiring Manager", text: "Yes, we must avoid bias, especially related to gender or college background." },
      { speaker: "ML Engineer", text: "Should the system process resumes in real-time or batch mode?" },
      { speaker: "Hiring Manager", text: "It shouldn't be slow." },
      { speaker: "ML Engineer", text: "What is the expected response time per resume?" },
      { speaker: "Hiring Manager", text: "Ideally quick." },
      { speaker: "ML Engineer", text: "What is the timeline for delivery?" },
      { speaker: "Hiring Manager", text: "We need an MVP soon." }
    ];

    let i = 0;
    const btn = document.getElementById('req-ai-sim-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Simulating...';
      btn.style.opacity = '0.6';
    }

    const interval = setInterval(() => {
      if (i >= script.length) {
        clearInterval(interval);
        flushBatch();
        if (btn) {
          btn.disabled = false;
          btn.textContent = '✔ Sim Complete';
          setTimeout(() => {
            btn.textContent = '⚡ Sim Demo';
            btn.style.opacity = '1';
          }, 3000);
        }
        return;
      }

      handleIncomingLine({
        speaker: script[i].speaker,
        text: script[i].text,
        timestamp: Date.now()
      });
      i++;
    }, 450);
  }

  // ---------------------------------------------------------------------------
  // Runtime Message Listeners (Handshake with popup and background)
  // ---------------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'PING_CONTENT_SCRIPT') {
      sendResponse({ status: 'ok', capturedCount: capturedCount });
    } else if (message.action === 'SIMULATE_DIALOGUE') {
      simulateAssignmentDialogue();
      sendResponse({ status: 'started' });
    } else if (message.action === 'GET_SCRAPER_STATUS') {
      sendResponse({
        status: 'ok',
        capturedCount: capturedCount,
        isWatching: !!observer,
        hudMounted: !!document.getElementById('req-ai-floating-hud')
      });
    }
    return true;
  });

  // Launch observation
  startObserver();

})();
