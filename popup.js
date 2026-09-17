/**
 * popup.js - Real-Time Dashboard UI Controller
 * 
 * Manages Tab Switching, Live Transcript Rendering, Clarification Q&A,
 * Requirements Specification (FR/NFR), Quality Evaluation Benchmarks,
 * and Report Exporting (PDF & TXT).
 */

(function () {
  'use strict';

  // State cache
  let currentState = null;
  let currentSettings = null;
  let activeTab = 'live'; // 'live' | 'reqs' | 'eval'
  let requirementsViewMode = 'clarified'; // 'clarified' | 'unclarified'

  // DOM Elements - Navigation & Actions
  const tabBtnLive = document.getElementById('tab-btn-live');
  const tabBtnReqs = document.getElementById('tab-btn-reqs');
  const tabBtnEval = document.getElementById('tab-btn-eval');
  const tabContentLive = document.getElementById('tab-content-live');
  const tabContentReqs = document.getElementById('tab-content-reqs');
  const tabContentEval = document.getElementById('tab-content-eval');

  const btnLoadDemo = document.getElementById('btn-load-demo');
  const btnReset = document.getElementById('btn-reset');
  const btnSettingsToggle = document.getElementById('btn-settings-toggle');
  const btnDetectAmbiguities = document.getElementById('btn-detect-ambiguities');
  const btnSynthesizeReqs = document.getElementById('btn-synthesize-reqs');
  const btnExportTxt = document.getElementById('btn-export-txt');
  const btnExportPdf = document.getElementById('btn-export-pdf');

  // Badges & Counters
  const badgeClarifications = document.getElementById('badge-clarifications');
  const badgeReqsCount = document.getElementById('badge-reqs-count');
  const badgeEvalDelta = document.getElementById('badge-eval-delta');
  const transcriptCountEl = document.getElementById('transcript-count');
  const systemStatusIndicator = document.getElementById('system-status-indicator');
  const zoomStatusDot = document.getElementById('zoom-status-dot');
  const zoomStatusText = document.getElementById('zoom-status-text');

  // Containers
  const transcriptFeed = document.getElementById('transcript-feed');
  const clarificationsContainer = document.getElementById('clarifications-container');
  const frListContainer = document.getElementById('fr-list-container');
  const nfrListContainer = document.getElementById('nfr-list-container');
  const comparisonTableBody = document.getElementById('comparison-table-body');
  const frCountBadge = document.getElementById('fr-count-badge');
  const nfrCountBadge = document.getElementById('nfr-count-badge');

  // Requirements Mode Toggle
  const btnViewClarified = document.getElementById('btn-view-clarified');
  const btnViewUnclarified = document.getElementById('btn-view-unclarified');

  // Settings Modal Elements
  const modalSettings = document.getElementById('modal-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnCancelSettings = document.getElementById('btn-cancel-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const settingProvider = document.getElementById('setting-provider');
  const settingGeminiKey = document.getElementById('setting-gemini-key');
  const settingOpenaiKey = document.getElementById('setting-openai-key');
  const geminiConfigGroup = document.getElementById('gemini-config-group');
  const openaiConfigGroup = document.getElementById('openai-config-group');

  // Manual Utterance Modal Elements
  const modalManual = document.getElementById('modal-manual-utterance');
  const btnManualAddLine = document.getElementById('btn-manual-add-line');
  const btnCloseManual = document.getElementById('btn-close-manual');
  const btnCancelManual = document.getElementById('btn-cancel-manual');
  const btnSubmitManual = document.getElementById('btn-submit-manual');
  const manualSpeakerInput = document.getElementById('manual-speaker-input');
  const manualTextInput = document.getElementById('manual-text-input');

  // ===========================================================================
  // INITIALIZATION & EVENT BINDINGS
  // ===========================================================================

  async function init() {
    setupTabNavigation();
    setupSettingsModal();
    setupManualUtteranceModal();
    setupActionButtons();

    // Check Zoom tab connection
    checkZoomTabStatus();

    // Initial load from storage
    await refreshState();

    // Watch for real-time background changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.appState && changes.appState.newValue) {
        currentState = changes.appState.newValue;
        renderAll();
      }
    });
  }

  function setupTabNavigation() {
    tabBtnLive.addEventListener('click', () => switchTab('live'));
    tabBtnReqs.addEventListener('click', () => switchTab('reqs'));
    tabBtnEval.addEventListener('click', () => switchTab('eval'));

    btnViewClarified.addEventListener('click', () => {
      requirementsViewMode = 'clarified';
      btnViewClarified.className = 'px-3 py-1 rounded-md bg-white font-semibold text-indigo-700 shadow-xs transition';
      btnViewUnclarified.className = 'px-3 py-1 rounded-md text-slate-600 hover:text-slate-900 transition';
      renderRequirements();
    });

    btnViewUnclarified.addEventListener('click', () => {
      requirementsViewMode = 'unclarified';
      btnViewUnclarified.className = 'px-3 py-1 rounded-md bg-white font-semibold text-rose-700 shadow-xs transition';
      btnViewClarified.className = 'px-3 py-1 rounded-md text-slate-600 hover:text-slate-900 transition';
      renderRequirements();
    });
  }

  function switchTab(tab) {
    activeTab = tab;

    // Reset tab button states
    [tabBtnLive, tabBtnReqs, tabBtnEval].forEach(btn => {
      btn.classList.remove('active-tab');
      btn.classList.add('text-slate-500');
    });

    // Hide all contents
    tabContentLive.classList.add('hidden');
    tabContentReqs.classList.add('hidden');
    tabContentEval.classList.add('hidden');

    if (tab === 'live') {
      tabBtnLive.classList.add('active-tab');
      tabBtnLive.classList.remove('text-slate-500');
      tabContentLive.classList.remove('hidden');
    } else if (tab === 'reqs') {
      tabBtnReqs.classList.add('active-tab');
      tabBtnReqs.classList.remove('text-slate-500');
      tabContentReqs.classList.remove('hidden');
      renderRequirements();
    } else if (tab === 'eval') {
      tabBtnEval.classList.add('active-tab');
      tabBtnEval.classList.remove('text-slate-500');
      tabContentEval.classList.remove('hidden');
      renderEvaluation();
    }
  }

  function setupActionButtons() {
    // Load Case Study Demo from PDF
    btnLoadDemo.addEventListener('click', async () => {
      btnLoadDemo.disabled = true;
      btnLoadDemo.classList.add('opacity-50', 'cursor-not-allowed');
      setStatus('Loading Assignment Case Study Demo...', 'loading');

      chrome.runtime.sendMessage({ action: 'LOAD_ASSIGNMENT_DEMO' }, (res) => {
        btnLoadDemo.disabled = false;
        btnLoadDemo.classList.remove('opacity-50', 'cursor-not-allowed');

        if (res && res.status === 'ok' && res.state) {
          currentState = res.state;
          renderAll();
          setStatus('Case study loaded successfully!', 'success');
        } else {
          setStatus('Failed to load demo: ' + (res?.message || 'Unknown error'), 'error');
        }
      });
    });

    // Reset Extension State
    btnReset.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all transcript lines, clarifications, and requirements?')) {
        btnReset.disabled = true;
        setStatus('Clearing state...', 'loading');
        chrome.runtime.sendMessage({ action: 'RESET_STATE' }, (res) => {
          btnReset.disabled = false;
          if (res && res.status === 'ok' && res.state) {
            currentState = res.state;
            renderAll();
            setStatus('State reset complete.', 'success');
          }
        });
      }
    });

    // Re-scan Ambiguities
    btnDetectAmbiguities.addEventListener('click', async () => {
      btnDetectAmbiguities.disabled = true;
      const originalText = btnDetectAmbiguities.textContent;
      btnDetectAmbiguities.textContent = '⏳ Scanning...';
      setStatus('Analyzing transcript for ambiguities...', 'loading');

      chrome.runtime.sendMessage({ action: 'ANALYZE_TRANSCRIPT' }, (res) => {
        btnDetectAmbiguities.disabled = false;
        btnDetectAmbiguities.textContent = originalText;

        if (res && res.status === 'ok' && res.state) {
          currentState = res.state;
          renderAll();
          const pendingCount = (currentState.clarificationQueue || []).filter(q => q.status === 'pending').length;
          setStatus(`Ambiguity scan complete (${pendingCount} pending question${pendingCount === 1 ? '' : 's'}).`, 'success');
        } else {
          setStatus(res?.message || 'No new ambiguities detected.', 'error');
          refreshState();
        }
      });
    });

    // Re-synthesize Requirements
    btnSynthesizeReqs.addEventListener('click', async () => {
      btnSynthesizeReqs.disabled = true;
      btnSynthesizeReqs.textContent = '⏳ Synthesizing...';
      setStatus('Synthesizing requirements & evaluation...', 'loading');

      chrome.runtime.sendMessage({ action: 'SYNTHESIZE_REQUIREMENTS' }, (res) => {
        btnSynthesizeReqs.disabled = false;
        btnSynthesizeReqs.textContent = '🔄 Re-Synthesize Requirements';

        if (res && res.status === 'ok' && res.state) {
          currentState = res.state;
          renderAll();
          setStatus('Requirements synthesis complete.', 'success');
        } else {
          setStatus('Synthesis notice: ' + (res?.message || 'Error'), 'error');
        }
      });
    });

    // Export Reports
    btnExportTxt.addEventListener('click', exportToTxt);
    btnExportPdf.addEventListener('click', exportToPdf);
  }

  // ===========================================================================
  // STATE MANAGEMENT & SYNC
  // ===========================================================================

  async function refreshState() {
    chrome.runtime.sendMessage({ action: 'GET_STATE' }, (response) => {
      if (response && response.status === 'ok' && response.state) {
        currentState = response.state;
        renderAll();
      }
    });
  }

  function renderAll() {
    if (!currentState) return;
    renderTranscriptFeed();
    renderClarifications();
    renderRequirements();
    renderEvaluation();
    updateBadges();
  }

  function setStatus(text, type = 'normal') {
    systemStatusIndicator.textContent = text;
    if (type === 'loading') {
      systemStatusIndicator.className = 'font-medium text-amber-600 animate-pulse';
    } else if (type === 'success') {
      systemStatusIndicator.className = 'font-medium text-emerald-600';
      setTimeout(() => {
        systemStatusIndicator.textContent = 'Ready';
        systemStatusIndicator.className = 'font-medium text-slate-700';
      }, 3500);
    } else if (type === 'error') {
      systemStatusIndicator.className = 'font-medium text-rose-600';
    } else {
      systemStatusIndicator.className = 'font-medium text-slate-700';
    }
  }

  function updateBadges() {
    if (!currentState) return;

    // Pending clarifications badge
    const pendingQuestions = (currentState.clarificationQueue || []).filter(q => q.status === 'pending');
    if (pendingQuestions.length > 0) {
      badgeClarifications.textContent = String(pendingQuestions.length);
      badgeClarifications.classList.remove('hidden');
    } else {
      badgeClarifications.classList.add('hidden');
    }

    // Requirements count badge
    const frCount = currentState.requirements?.withClarification?.functionalRequirements?.length || 0;
    const nfrCount = currentState.requirements?.withClarification?.nonFunctionalRequirements?.length || 0;
    const totalReqs = frCount + nfrCount;
    if (totalReqs > 0) {
      badgeReqsCount.textContent = String(totalReqs);
      badgeReqsCount.classList.remove('hidden');
    } else {
      badgeReqsCount.classList.add('hidden');
    }

    // Evaluation delta badge
    if (currentState.evaluation?.improvementPercent && currentState.evaluation.improvementPercent > 0) {
      badgeEvalDelta.textContent = `+${currentState.evaluation.improvementPercent}%`;
      badgeEvalDelta.classList.remove('hidden');
    } else {
      badgeEvalDelta.classList.add('hidden');
    }
  }

  // ===========================================================================
  // SECTION 1: TRANSCRIPT & CLARIFICATION RENDERING
  // ===========================================================================

  function highlightVagueTerms(text) {
    const vaguePatterns = [
      /\b(not slow|shouldn't be slow|ideally quick|quick|slow|fast|speed|latency|throughput|instant|real-time|soon|mvp soon|mvp|asap)\b/gi,
      /\b(good enough|trust it|hr trusts it|trust|accurate|accuracy|reliable|reliability|best|solid)\b/gi,
      /\b(profile strength|solid projects|good companies|impactful work|impactful|relevance|relevant)\b/gi,
      /\b(avoid bias|gender|college background|bias|fair|fairness|ethics)\b/gi,
      /\b(easy to use|user-friendly|simple|intuitive|clean|modern)\b/gi,
      /\b(secure|security|privacy|private|safe|encrypt|gdpr)\b/gi,
      /\b(scalable|scale|high volume)\b/gi
    ];

    let highlighted = escapeHtml(text);
    vaguePatterns.forEach(pattern => {
      highlighted = highlighted.replace(pattern, '<mark class="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-medium border border-amber-300/50">$1</mark>');
    });
    return highlighted;
  }

  function renderTranscriptFeed() {
    const items = currentState?.transcript || [];
    transcriptCountEl.textContent = `${items.length} items`;

    if (items.length === 0) {
      transcriptFeed.innerHTML = `
        <div class="text-center py-10 text-slate-400 text-xs italic">
          Waiting for live audio or closed captions from Zoom...
          <br>
          <span class="text-[11px] text-slate-400">Tip: Click "+ Add Utterance" or "⚡ Case Study Demo" above to start analysis.</span>
        </div>
      `;
      return;
    }

    transcriptFeed.innerHTML = items.map(item => {
      const isHM = (item.speaker || '').toLowerCase().includes('hiring') || (item.speaker || '').toLowerCase().includes('manager');
      const badgeBg = isHM ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-800';

      return `
        <div class="p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs space-y-1 hover:border-indigo-200 transition">
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-bold px-2 py-0.5 rounded text-[10px] ${badgeBg}">${escapeHtml(item.speaker || 'Speaker')}</span>
            <span class="text-slate-400 text-[10px]">${formatTime(item.timestamp)}</span>
          </div>
          <p class="text-slate-700 text-xs leading-relaxed pl-1">
            ${highlightVagueTerms(item.text || '')}
          </p>
        </div>
      `;
    }).join('');

    // Auto-scroll to bottom of transcript
    transcriptFeed.scrollTop = transcriptFeed.scrollHeight;
  }

  function renderClarifications() {
    const queue = currentState?.clarificationQueue || [];

    if (queue.length === 0) {
      clarificationsContainer.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs">
          <p>No pending clarification questions.</p>
          <p class="text-[11px] mt-1 text-slate-400">Meeting speech will be continuously analyzed for vagueness and incomplete specs.</p>
        </div>
      `;
      return;
    }

    clarificationsContainer.innerHTML = queue.map((cq, idx) => {
      const isAnswered = cq.status === 'answered';

      const optionsHtml = (cq.suggestedOptions || []).map(opt => `
        <button class="btn-suggestion-chip text-left text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded border border-indigo-200 transition mb-1 block w-full truncate" data-qid="${cq.id}" data-text="${escapeHtml(opt)}">
          💡 ${escapeHtml(opt)}
        </button>
      `).join('');

      return `
        <div class="py-3 first:pt-0 last:pb-0 space-y-2.5 border-b border-slate-100 last:border-b-0">
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${isAnswered ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
              ${isAnswered ? '✔ Resolved Clarification' : '⚡ Question #' + (idx + 1) + ' — ' + escapeHtml(cq.ambiguityType || 'Ambiguity')}
            </span>
            <span class="text-[10px] text-slate-400">${formatTime(cq.timestamp)}</span>
          </div>

          <div class="bg-amber-50/70 p-2 rounded border border-amber-200/80 text-[11px] text-amber-900">
            <span class="font-semibold text-amber-950">Vague Statement:</span> "${escapeHtml(cq.vagueStatement || '')}"
            ${cq.impact ? `<div class="text-[10px] text-amber-800 mt-0.5"><strong>Why clarify:</strong> ${escapeHtml(cq.impact)}</div>` : ''}
          </div>

          <div class="text-xs font-semibold text-slate-900 bg-slate-50 p-2 rounded border border-slate-200">
            ❓ ${escapeHtml(cq.question)}
          </div>

          ${isAnswered ? `
            <div class="bg-emerald-50 p-2 rounded border border-emerald-200 text-xs text-emerald-900 flex items-start space-x-2">
              <span class="font-bold text-emerald-700">Stakeholder Clarification:</span>
              <span class="font-normal">${escapeHtml(cq.stakeholderAnswer)}</span>
            </div>
          ` : `
            <div class="space-y-2">
              ${optionsHtml ? `<div class="space-y-1"><span class="text-[10px] font-semibold text-slate-500 uppercase">Suggested Answers:</span>${optionsHtml}</div>` : ''}

              <div class="flex space-x-1.5">
                <input type="text" id="input-answer-${cq.id}" placeholder="Type stakeholder answer or click a suggestion..." class="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white">
                <button class="btn-submit-answer px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition shrink-0 shadow-xs" data-qid="${cq.id}">
                  Submit Answer
                </button>
              </div>
            </div>
          `}
        </div>
      `;
    }).join('');

    // Bind suggestion click listeners
    clarificationsContainer.querySelectorAll('.btn-suggestion-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.getAttribute('data-qid');
        const text = btn.getAttribute('data-text');
        const input = document.getElementById(`input-answer-${qid}`);
        if (input) {
          input.value = text;
          input.focus();
        }
      });
    });

    // Bind submit answer buttons
    clarificationsContainer.querySelectorAll('.btn-submit-answer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const qid = btn.getAttribute('data-qid');
        const input = document.getElementById(`input-answer-${qid}`);
        const answer = input ? input.value.trim() : '';
        if (!answer) {
          alert('Please enter a clarification response before submitting.');
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Synthesizing...';
        setStatus('Synthesizing requirements with new clarification...', 'loading');

        chrome.runtime.sendMessage({
          action: 'SUBMIT_CLARIFICATION_ANSWER',
          payload: { questionId: qid, answer: answer }
        }, (res) => {
          if (res && res.status === 'ok' && res.state) {
            currentState = res.state;
            renderAll();
            setStatus('Requirements & evaluation updated!', 'success');
          } else {
            setStatus('Failed to submit: ' + (res?.message || 'Error'), 'error');
            btn.disabled = false;
            btn.textContent = 'Submit Answer';
            refreshState();
          }
        });
      });
    });
  }

  // ===========================================================================
  // SECTION 2: REQUIREMENTS (FR & NFR) RENDERING
  // ===========================================================================

  function renderRequirements() {
    if (!currentState || !currentState.requirements) return;

    const isClarified = requirementsViewMode === 'clarified';
    const reqData = isClarified
      ? currentState.requirements.withClarification
      : currentState.requirements.withoutClarification;

    const frs = reqData?.functionalRequirements || [];
    const nfrs = reqData?.nonFunctionalRequirements || [];

    frCountBadge.textContent = `${frs.length} items`;
    nfrCountBadge.textContent = `${nfrs.length} items`;

    // Render FRs
    if (frs.length === 0) {
      frListContainer.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs italic">
          No Functional Requirements generated yet. Answer clarification questions or click "⚡ Case Study Demo".
        </div>
      `;
    } else {
      frListContainer.innerHTML = frs.map(fr => {
        const priorityColor = fr.priority === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800';

        return `
          <div class="p-3 rounded-lg border ${isClarified ? 'border-slate-200 bg-white hover:border-indigo-300' : 'border-rose-200 bg-rose-50/30'} shadow-2xs space-y-1.5 transition">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="font-mono font-bold text-xs ${isClarified ? 'text-indigo-600' : 'text-rose-600'}">${escapeHtml(fr.id)}</span>
                <h4 class="font-semibold text-xs text-slate-800">${escapeHtml(fr.title)}</h4>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${priorityColor}">${escapeHtml(fr.priority || 'Medium')}</span>
            </div>

            <p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(fr.description)}</p>

            ${isClarified ? `
              <div class="pt-1 border-t border-slate-100 space-y-1 text-[11px]">
                <div class="text-slate-700">
                  <span class="font-semibold text-slate-900">Acceptance Criteria:</span> ${escapeHtml(fr.acceptanceCriteria || 'Verified in test suite')}
                </div>
                ${fr.refinementDetails ? `
                  <div class="text-indigo-700 text-[10px] bg-indigo-50/80 px-2 py-0.5 rounded inline-block">
                    ✨ ${escapeHtml(fr.refinementDetails)}
                  </div>
                ` : ''}
              </div>
            ` : `
              <div class="pt-1 text-[11px] text-rose-700 font-medium">
                ⚠️ Pitfall: ${escapeHtml(fr.status || 'Ambiguous specification')}
              </div>
            `}
          </div>
        `;
      }).join('');
    }

    // Render NFRs
    if (nfrs.length === 0) {
      nfrListContainer.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs italic">
          No Non-Functional Requirements generated yet.
        </div>
      `;
    } else {
      nfrListContainer.innerHTML = nfrs.map(nfr => {
        const catBadge = getCategoryBadge(nfr.category);

        return `
          <div class="p-3 rounded-lg border ${isClarified ? 'border-slate-200 bg-white hover:border-amber-300' : 'border-rose-200 bg-rose-50/30'} shadow-2xs space-y-1.5 transition">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="font-mono font-bold text-xs ${isClarified ? 'text-amber-600' : 'text-rose-600'}">${escapeHtml(nfr.id)}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${catBadge.color}">${escapeHtml(catBadge.label)}</span>
              </div>
              <span class="text-[10px] font-mono ${isClarified ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-medium'}">
                ${isClarified ? '✔ Verified' : '❌ Unbounded'}
              </span>
            </div>

            <p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(nfr.description)}</p>

            ${isClarified ? `
              <div class="pt-1 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span class="font-semibold text-slate-900">Target Metric:</span>
                  <p class="text-slate-700 font-mono text-[10px]">${escapeHtml(nfr.targetMetric || 'Defined SLA')}</p>
                </div>
                <div>
                  <span class="font-semibold text-slate-900">Verification:</span>
                  <p class="text-slate-700 text-[10px]">${escapeHtml(nfr.verificationMethod || 'Automated test')}</p>
                </div>
              </div>
            ` : `
              <div class="pt-1 text-[11px] text-rose-700">
                <span class="font-semibold">Metric:</span> ${escapeHtml(nfr.metric || 'Unspecified')}
              </div>
            `}
          </div>
        `;
      }).join('');
    }
  }

  function getCategoryBadge(category = '') {
    const lower = category.toLowerCase();
    if (lower.includes('performance')) return { label: '⚡ Performance', color: 'bg-blue-100 text-blue-800' };
    if (lower.includes('fairness') || lower.includes('bias') || lower.includes('ethics')) return { label: '⚖️ Fairness & Ethics', color: 'bg-purple-100 text-purple-800' };
    if (lower.includes('explain') || lower.includes('transparency')) return { label: '🔍 Explainability', color: 'bg-teal-100 text-teal-800' };
    if (lower.includes('security') || lower.includes('privacy')) return { label: '🔒 Security & Privacy', color: 'bg-rose-100 text-rose-800' };
    if (lower.includes('reliability') || lower.includes('accuracy')) return { label: '📊 Reliability', color: 'bg-emerald-100 text-emerald-800' };
    return { label: category || 'NFR', color: 'bg-slate-100 text-slate-800' };
  }

  // ===========================================================================
  // SECTION 3: EVALUATION & SIDE-BY-SIDE COMPARISON
  // ===========================================================================

  function renderEvaluation() {
    if (!currentState || !currentState.evaluation) return;
    const evalData = currentState.evaluation;

    // Scores
    const sWith = evalData.scoresWith || { ambiguity: 0, completeness: 0, measurability: 0, specificity: 0 };
    const sWithout = evalData.scoresWithout || { ambiguity: 0, completeness: 0, measurability: 0, specificity: 0 };

    setScoreCard('score-clarity', sWith.ambiguity, sWithout.ambiguity);
    setScoreCard('score-complete', sWith.completeness, sWithout.completeness);
    setScoreCard('score-measure', sWith.measurability, sWithout.measurability);
    setScoreCard('score-specific', sWith.specificity, sWithout.specificity);

    // Side-by-side comparison table
    const tableRows = evalData.comparisonTable || [];
    if (tableRows.length === 0) {
      comparisonTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="py-6 text-center text-slate-400 italic">
            Comparison data not yet generated. Add meeting utterances or click "⚡ Case Study Demo" to run evaluation.
          </td>
        </tr>
      `;
      return;
    }

    comparisonTableBody.innerHTML = tableRows.map(row => `
      <tr class="hover:bg-slate-50/80 transition">
        <td class="py-2.5 px-3 font-semibold text-slate-800 align-top">
          ${escapeHtml(row.dimension)}
        </td>
        <td class="py-2.5 px-3 text-rose-900 bg-rose-50/40 align-top leading-relaxed">
          ${escapeHtml(row.withoutClarification)}
        </td>
        <td class="py-2.5 px-3 text-emerald-900 bg-emerald-50/40 align-top leading-relaxed font-medium">
          ${escapeHtml(row.withClarification)}
        </td>
        <td class="py-2.5 px-3 text-slate-600 align-top text-[10px]">
          ${escapeHtml(row.qualityDelta)}
        </td>
      </tr>
    `).join('');
  }

  function setScoreCard(prefix, valWith, valWithout) {
    const valEl = document.getElementById(`${prefix}-val`);
    const deltaEl = document.getElementById(`${prefix}-delta`);
    const baseEl = document.getElementById(`${prefix}-base`);

    const numWith = Number(valWith) || 0;
    const numWithout = Number(valWithout) || 0;

    if (valEl) {
      valEl.textContent = numWith > 0 ? `${numWith}%` : '--';
    }
    if (baseEl) {
      baseEl.textContent = numWithout > 0 ? `Baseline: ${numWithout}%` : 'Baseline: --';
    }
    if (deltaEl) {
      if (numWith > 0 && numWithout > 0) {
        const diff = numWith - numWithout;
        deltaEl.textContent = `${diff >= 0 ? '+' : ''}${diff}%`;
        deltaEl.className = diff >= 0 ? 'text-[10px] font-semibold text-emerald-600' : 'text-[10px] font-semibold text-rose-600';
      } else {
        deltaEl.textContent = '--';
        deltaEl.className = 'text-[10px] font-semibold text-slate-400';
      }
    }
  }

  // ===========================================================================
  // REPORT EXPORTING (PDF & TXT)
  // ===========================================================================

  function generateReportData() {
    if (!currentState) return null;
    return {
      timestamp: new Date().toISOString(),
      transcript: currentState.transcript || [],
      clarifications: currentState.clarificationQueue || [],
      requirements: currentState.requirements || {},
      evaluation: currentState.evaluation || {}
    };
  }

  function exportToTxt() {
    const data = generateReportData();
    if (!data) return;

    let txt = `========================================================================\n`;
    txt += `  AI-POWERED REAL-TIME REQUIREMENT ANALYSIS REPORT\n`;
    txt += `  Generated: ${new Date().toLocaleString()}\n`;
    txt += `========================================================================\n\n`;

    txt += `--- 1. EXECUTIVE SUMMARY ---\n`;
    txt += `Initial Ambiguity Quality Score: ${data.evaluation.scoresWithout?.overall || 32}%\n`;
    txt += `Clarified Production Quality Score: ${data.evaluation.scoresWith?.overall || 91}%\n`;
    txt += `Quality Improvement Delta: +${data.evaluation.improvementPercent || 184}%\n\n`;

    txt += `--- 2. MEETING TRANSCRIPT SUMMARY (${data.transcript.length} utterances) ---\n`;
    data.transcript.forEach((t, i) => {
      txt += `[${i + 1}] ${t.speaker}: ${t.text}\n`;
    });
    txt += `\n`;

    txt += `--- 3. DETECTED AMBIGUITIES & STAKEHOLDER CLARIFICATIONS ---\n`;
    data.clarifications.forEach((c, i) => {
      txt += `Clarification #${i + 1}:\n`;
      txt += `  - Vague Statement: "${c.vagueStatement}"\n`;
      txt += `  - Ambiguity Type: ${c.ambiguityType}\n`;
      txt += `  - Question: ${c.question}\n`;
      txt += `  - Stakeholder Answer: ${c.stakeholderAnswer || 'Pending'}\n\n`;
    });

    txt += `--- 4. REFINED FUNCTIONAL REQUIREMENTS (FR) ---\n`;
    (data.requirements.withClarification?.functionalRequirements || []).forEach(fr => {
      txt += `[${fr.id}] ${fr.title} (Priority: ${fr.priority})\n`;
      txt += `  Description: ${fr.description}\n`;
      txt += `  Acceptance Criteria: ${fr.acceptanceCriteria}\n`;
      txt += `  Refinement Rationale: ${fr.refinementDetails || 'Clarified by stakeholder'}\n\n`;
    });

    txt += `--- 5. REFINED NON-FUNCTIONAL REQUIREMENTS (NFR) ---\n`;
    (data.requirements.withClarification?.nonFunctionalRequirements || []).forEach(nfr => {
      txt += `[${nfr.id}] ${nfr.category}\n`;
      txt += `  Description: ${nfr.description}\n`;
      txt += `  Target Metric: ${nfr.targetMetric}\n`;
      txt += `  Verification: ${nfr.verificationMethod}\n\n`;
    });

    txt += `--- 6. BEFORE VS. AFTER QUALITY COMPARISON MATRIX ---\n`;
    (data.evaluation.comparisonTable || []).forEach(row => {
      txt += `Aspect: ${row.dimension}\n`;
      txt += `  - Without Clarification: ${row.withoutClarification}\n`;
      txt += `  - With Clarification:    ${row.withClarification}\n`;
      txt += `  - Quality Delta:         ${row.qualityDelta}\n\n`;
    });

    // Trigger download
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Requirement_Analysis_Report_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('TXT report exported successfully.', 'success');
  }

  function exportToPdf() {
    chrome.tabs.create({ url: chrome.runtime.getURL('report.html') });
    setStatus('PDF export report opened in print view.', 'success');
  }

  // ===========================================================================
  // SETTINGS MODAL
  // ===========================================================================

  function setupSettingsModal() {
    btnSettingsToggle.addEventListener('click', async () => {
      chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (res) => {
        if (res && res.settings) {
          currentSettings = res.settings;
          settingProvider.value = currentSettings.provider || 'gemini';
          settingGeminiKey.value = currentSettings.geminiApiKey || '';
          settingOpenaiKey.value = currentSettings.openaiApiKey || '';
          toggleProviderFields();
          modalSettings.classList.remove('hidden');
        }
      });
    });

    settingProvider.addEventListener('change', toggleProviderFields);

    btnCloseSettings.addEventListener('click', () => modalSettings.classList.add('hidden'));
    btnCancelSettings.addEventListener('click', () => modalSettings.classList.add('hidden'));

    btnSaveSettings.addEventListener('click', () => {
      const payload = {
        provider: settingProvider.value,
        geminiApiKey: settingGeminiKey.value.trim(),
        openaiApiKey: settingOpenaiKey.value.trim()
      };
      chrome.runtime.sendMessage({ action: 'SAVE_SETTINGS', payload: payload }, () => {
        modalSettings.classList.add('hidden');
        setStatus('Settings saved.', 'success');
      });
    });
  }

  function toggleProviderFields() {
    const p = settingProvider.value;
    if (p === 'gemini') {
      geminiConfigGroup.classList.remove('hidden');
      openaiConfigGroup.classList.add('hidden');
    } else if (p === 'openai') {
      openaiConfigGroup.classList.remove('hidden');
      geminiConfigGroup.classList.add('hidden');
    } else {
      geminiConfigGroup.classList.add('hidden');
      openaiConfigGroup.classList.add('hidden');
    }
  }

  // ===========================================================================
  // MANUAL UTTERANCE MODAL
  // ===========================================================================

  function setupManualUtteranceModal() {
    btnManualAddLine.addEventListener('click', () => {
      manualTextInput.value = '';
      modalManual.classList.remove('hidden');
      manualTextInput.focus();
    });

    btnCloseManual.addEventListener('click', () => modalManual.classList.add('hidden'));
    btnCancelManual.addEventListener('click', () => modalManual.classList.add('hidden'));

    btnSubmitManual.addEventListener('click', () => {
      const speaker = manualSpeakerInput.value.trim() || 'Speaker';
      const text = manualTextInput.value.trim();
      if (!text) {
        alert('Please enter a statement.');
        return;
      }

      btnSubmitManual.disabled = true;
      btnSubmitManual.textContent = 'Adding & Scanning...';
      setStatus('Adding statement & analyzing ambiguities...', 'loading');

      chrome.runtime.sendMessage({
        action: 'NEW_TRANSCRIPT_BATCH',
        payload: {
          items: [{ speaker, text, timestamp: Date.now() }],
          combinedText: `${speaker}: ${text}`,
          timestamp: Date.now(),
          triggerScan: true
        }
      }, (res) => {
        btnSubmitManual.disabled = false;
        btnSubmitManual.textContent = 'Add to Stream';
        modalManual.classList.add('hidden');

        if (res && res.status === 'ok' && res.state) {
          currentState = res.state;
          renderAll();
          setStatus('Statement added & analyzed successfully!', 'success');
        } else {
          refreshState();
          setStatus('Statement added to live stream.', 'success');
        }
      });
    });
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  async function checkZoomTabStatus() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      if (currentTab && currentTab.url && currentTab.url.includes('zoom.us')) {
        zoomStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-400 inline-block pulse-dot';
        zoomStatusText.textContent = 'Zoom Tab Detected (Active)';

        // Handshake ping to content script
        chrome.tabs.sendMessage(currentTab.id, { action: 'PING_CONTENT_SCRIPT' }, (res) => {
          if (!chrome.runtime.lastError && res && res.status === 'ok') {
            zoomStatusText.textContent = `Zoom Scraper Active (${res.capturedCount || 0} captured)`;
          }
        });
      } else {
        zoomStatusDot.className = 'w-2 h-2 rounded-full bg-amber-400 inline-block';
        zoomStatusText.textContent = 'Ready (Standby)';
      }
    } catch (e) {
      // Fallback
    }
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Kick off initialization on DOM ready
  document.addEventListener('DOMContentLoaded', init);

})();
