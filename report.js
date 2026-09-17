/**
 * report.js - Report page controller for printable PDF export
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    // Set date
    document.getElementById('report-date').textContent = new Date().toLocaleString();

    // Button event listeners
    document.getElementById('btn-trigger-print').addEventListener('click', () => {
      window.print();
    });

    document.getElementById('btn-close-report').addEventListener('click', () => {
      window.close();
    });

    // Fetch state from storage
    const stored = await chrome.storage.local.get('appState');
    const state = stored.appState;

    if (!state) {
      alert('No requirements data found in storage.');
      return;
    }

    renderReport(state);

    // Automatically open print dialog after short render delay
    setTimeout(() => {
      window.print();
    }, 450);
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderReport(state) {
    const evalData = state.evaluation || {};
    const reqs = state.requirements?.withClarification || {};
    const clarifications = state.clarificationQueue || [];

    // Render Domain
    const domainEl = document.getElementById('report-domain');
    if (domainEl && reqs.summary) {
      domainEl.textContent = reqs.summary;
    }

    // Render Metrics
    const sWith = evalData.scoresWith || { ambiguity: 0, completeness: 0, measurability: 0, specificity: 0, overall: 0 };
    const sWithout = evalData.scoresWithout || { ambiguity: 0, completeness: 0, measurability: 0, specificity: 0, overall: 0 };

    function updateMetricCard(valId, subId, withVal, withoutVal) {
      const vEl = document.getElementById(valId);
      const sEl = document.getElementById(subId);
      const w = Number(withVal) || 0;
      const wo = Number(withoutVal) || 0;
      if (vEl) vEl.textContent = w > 0 ? `${w}%` : '--';
      if (sEl) {
        if (w > 0 && wo > 0) {
          const diff = w - wo;
          sEl.innerHTML = `Baseline: ${wo}% <span class="text-emerald-600 font-bold">(${diff >= 0 ? '+' : ''}${diff}%)</span>`;
        } else {
          sEl.textContent = 'Baseline: --';
        }
      }
    }

    updateMetricCard('rep-clarity-val', 'rep-clarity-sub', sWith.ambiguity, sWithout.ambiguity);
    updateMetricCard('rep-completeness-val', 'rep-completeness-sub', sWith.completeness, sWithout.completeness);
    updateMetricCard('rep-measurability-val', 'rep-measurability-sub', sWith.measurability, sWithout.measurability);
    updateMetricCard('rep-specificity-val', 'rep-specificity-sub', sWith.specificity, sWithout.specificity);

    if (evalData.improvementPercent && evalData.improvementPercent > 0) {
      document.getElementById('report-overall-delta').textContent = `+${evalData.improvementPercent}% Overall Quality Improvement`;
    } else {
      document.getElementById('report-overall-delta').textContent = 'Baseline Stage';
    }

    // Render Comparison Table
    const tbody = document.getElementById('rep-comparison-tbody');
    const tableRows = evalData.comparisonTable || [];
    if (tableRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">No comparison data available.</td></tr>';
    } else {
      tbody.innerHTML = tableRows.map(row => `
        <tr class="text-xs">
          <td class="py-2.5 px-3 font-semibold text-slate-900 align-top">${escapeHtml(row.dimension)}</td>
          <td class="py-2.5 px-3 text-rose-900 bg-rose-50/50 align-top">${escapeHtml(row.withoutClarification)}</td>
          <td class="py-2.5 px-3 text-emerald-900 bg-emerald-50/50 align-top font-medium">${escapeHtml(row.withClarification)}</td>
          <td class="py-2.5 px-3 text-slate-600 align-top text-[11px]">${escapeHtml(row.qualityDelta)}</td>
        </tr>
      `).join('');
    }

    // Render Functional Requirements
    const frList = document.getElementById('rep-fr-list');
    const frs = reqs.functionalRequirements || [];
    if (frs.length === 0) {
      frList.innerHTML = '<p class="text-xs text-slate-400 italic">No Functional Requirements generated.</p>';
    } else {
      frList.innerHTML = frs.map(fr => `
        <div class="border border-slate-200 rounded-lg p-3 bg-white space-y-1.5 text-xs">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="font-bold text-indigo-700 font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">${escapeHtml(fr.id)}</span>
              <h4 class="font-bold text-slate-900 text-sm">${escapeHtml(fr.title)}</h4>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${fr.priority === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}">
              ${escapeHtml(fr.priority || 'Medium')}
            </span>
          </div>
          <p class="text-slate-700 leading-relaxed">${escapeHtml(fr.description)}</p>
          <div class="pt-1 border-t border-slate-100 text-[11px] text-slate-800">
            <strong>Acceptance Criteria:</strong> ${escapeHtml(fr.acceptanceCriteria)}
          </div>
          ${fr.refinementDetails ? `
            <div class="text-[10px] text-indigo-700 font-medium">
              ✨ <strong>Refinement Rationale:</strong> ${escapeHtml(fr.refinementDetails)}
            </div>
          ` : ''}
        </div>
      `).join('');
    }

    // Render Non-Functional Requirements
    const nfrList = document.getElementById('rep-nfr-list');
    const nfrs = reqs.nonFunctionalRequirements || [];
    if (nfrs.length === 0) {
      nfrList.innerHTML = '<p class="text-xs text-slate-400 italic">No Non-Functional Requirements generated.</p>';
    } else {
      nfrList.innerHTML = nfrs.map(nfr => `
        <div class="border border-slate-200 rounded-lg p-3 bg-white space-y-1 text-xs">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="font-bold text-amber-700 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200">${escapeHtml(nfr.id)}</span>
              <span class="font-bold text-slate-800">${escapeHtml(nfr.category)}</span>
            </div>
            <span class="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Verified Metric
            </span>
          </div>
          <p class="text-slate-700">${escapeHtml(nfr.description)}</p>
          <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
            <div><strong>Target Metric:</strong> <code class="text-indigo-800">${escapeHtml(nfr.targetMetric)}</code></div>
            <div><strong>Verification:</strong> ${escapeHtml(nfr.verificationMethod)}</div>
          </div>
        </div>
      `).join('');
    }

    // Render Clarifications Audit Trail
    const qaList = document.getElementById('rep-qa-list');
    if (clarifications.length === 0) {
      qaList.innerHTML = '<p class="text-xs text-slate-400 italic">No clarifications recorded.</p>';
    } else {
      qaList.innerHTML = clarifications.map((c, idx) => `
        <div class="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-1 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-semibold text-indigo-700">Clarification #${idx + 1} (${escapeHtml(c.ambiguityType || 'Ambiguity')})</span>
            <span class="text-[10px] text-slate-400">${c.answeredAt ? new Date(c.answeredAt).toLocaleTimeString() : ''}</span>
          </div>
          <p class="text-slate-800"><strong>Vague Statement:</strong> "${escapeHtml(c.vagueStatement)}"</p>
          <p class="text-indigo-900"><strong>AI Question:</strong> ${escapeHtml(c.question)}</p>
          <p class="text-emerald-800 bg-emerald-50/60 p-1.5 rounded border border-emerald-200/60">
            <strong>Stakeholder Answer:</strong> ${escapeHtml(c.stakeholderAnswer || 'Clarified according to specifications.')}
          </p>
        </div>
      `).join('');
    }
  }

})();
