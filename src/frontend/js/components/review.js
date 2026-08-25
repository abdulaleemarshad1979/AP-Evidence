const ReviewComponent = {
  async init() {
    await this.renderReviewCards();
  },

  async renderReviewCards() {
    const container = document.getElementById('review-cards-container');
    if (!container) return;

    try {
      const data = await API.get('/resolution/candidates');
      const candidates = data.candidates;
      const pending = candidates.filter(c => c.status === 'PENDING_REVIEW');

      const badge = document.getElementById('nav-review-badge');
      if (badge) badge.innerText = pending.length;

      container.innerHTML = '';

      if (candidates.length === 0) {
        container.innerHTML = `<div class="card" style="text-align: center; color: var(--accent-emerald);">No candidate resolution pairs found.</div>`;
        return;
      }

      // Render Candidates Queue
      candidates.forEach(cand => {
        const card = document.createElement('div');
        card.className = 'card';

        const eA = cand.entityADetails || { id: cand.entityA, name: 'Target Entity A' };
        const eB = cand.entityBDetails || { id: cand.entityB, name: 'Target Entity B' };
        const scorePct = Math.round(cand.matchScore * 100);

        const comparedFieldsStr = API.escapeHTML((cand.comparedFields || []).join(', '));
        const scoresStr = API.escapeHTML(JSON.stringify(cand.individualScores || {}));
        const conflictsStr = (cand.conflicts || []).map(c => `• Conflict on ${API.escapeHTML(c.field)}: ${API.escapeHTML(c.valA)} vs ${API.escapeHTML(c.valB)}`).join('<br>');

        card.innerHTML = `
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-code-compare"></i> Candidate Pair #${API.escapeHTML(cand.id)} (Rule: <code>${API.escapeHTML(cand.ruleVersion || 'v2.2')}</code>)</div>
            <span class="badge-status ${cand.status === 'APPROVED_MERGED' ? 'badge-low' : (cand.status === 'REVERSED' ? 'badge-high' : 'badge-critical')}">${API.escapeHTML(cand.status)} (${scorePct}% MATCH)</span>
          </div>

          <div class="comparison-container">
            <div class="comparison-box target">
              <h4 style="color: var(--accent-cyan);">${API.escapeHTML(eA.name)}</h4>
              <div class="mono" style="font-size: 0.8rem;">ID: ${API.escapeHTML(eA.id)} | Type: ${API.escapeHTML(eA.type)}</div>
              <div style="font-size: 0.85rem; margin-top: 0.5rem;">
                Status: ${API.escapeHTML(eA.evidenceStatus || 'VERIFIED_RAW')}<br>
                Assertion Class: ${API.escapeHTML(eA.assertionClass || 'CONFIRMED_FACT')}
              </div>
            </div>

            <div class="comparison-box">
              <h4 style="color: var(--accent-amber);">${API.escapeHTML(eB.name)}</h4>
              <div class="mono" style="font-size: 0.8rem;">ID: ${API.escapeHTML(eB.id)} | Type: ${API.escapeHTML(eB.type)}</div>
              <div style="font-size: 0.85rem; margin-top: 0.5rem;">
                Status: ${API.escapeHTML(eB.evidenceStatus || 'DERIVED_ANALYSIS')}<br>
                Assertion Class: ${API.escapeHTML(eB.assertionClass || 'ALGORITHMIC_CANDIDATE')}
              </div>
            </div>
          </div>

          <div style="background: var(--bg-panel); padding: 0.75rem; border-radius: 4px; font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.4rem;">
            <div><strong>Compared Attributes:</strong> <code>[${comparedFieldsStr}]</code></div>
            <div><strong>Attribute Match Scores:</strong> <code>${scoresStr}</code></div>
            ${conflictsStr ? `<div style="color: var(--accent-crimson);"><strong>Attribute Conflicts Detected:</strong><br>${conflictsStr}</div>` : '<div style="color: var(--accent-emerald);"><strong>Attribute Conflicts:</strong> None detected</div>'}
          </div>

          <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 0.5rem;">
            ${cand.status === 'PENDING_REVIEW' ? `
              <button class="btn btn-danger btn-reject-merge" data-id="${API.escapeHTML(cand.id)}">
                <i class="fa-solid fa-xmark"></i> Flag as Distinct (Reject)
              </button>
              <button class="btn btn-primary btn-confirm-merge" data-id="${API.escapeHTML(cand.id)}" data-pa="${API.escapeHTML(eA.id)}" data-pb="${API.escapeHTML(eB.id)}">
                <i class="fa-solid fa-code-merge"></i> Confirm & Merge Records
              </button>
            ` : (cand.status === 'APPROVED_MERGED' ? `
              <button class="btn btn-warning btn-reverse-merge" data-id="${API.escapeHTML(cand.id)}" data-pa="${API.escapeHTML(eA.id)}">
                <i class="fa-solid fa-rotate-left"></i> Reversible Merge (Unmerge / Split)
              </button>
            ` : `<span style="color: var(--text-muted); font-size: 0.85rem;">Review Decision Finalized (${API.escapeHTML(cand.status)})</span>`)}
          </div>
        `;
        container.appendChild(card);
      });

      this.bindCardEvents();

    } catch (err) {
      container.innerHTML = `<div class="card">Failed to load review queue: ${API.escapeHTML(err.message)}</div>`;
    }
  },

  bindCardEvents() {
    document.querySelectorAll('.btn-confirm-merge').forEach(btn => {
      btn.addEventListener('click', async () => {
        const candId = btn.getAttribute('data-id');
        const primaryId = btn.getAttribute('data-pa');
        const secondaryId = btn.getAttribute('data-pb');

        try {
          await API.post('/review/merge', {
            candidateId: candId,
            primaryId,
            secondaryId,
            rationale: 'Analyst verified candidate correlation with high confidence'
          });
          alert(`Merged entity ${secondaryId} into canonical profile ${primaryId}`);
          await this.renderReviewCards();
          if (window.ResolutionComponent) window.ResolutionComponent.renderCandidatesTable();
          if (window.AuditComponent) window.AuditComponent.renderAuditTable();
        } catch (err) {
          alert('Merge error: ' + err.message);
        }
      });
    });

    document.querySelectorAll('.btn-reverse-merge').forEach(btn => {
      btn.addEventListener('click', async () => {
        const candId = btn.getAttribute('data-id');

        try {
          const res = await API.post('/review/reverse', {
            candidateId: candId,
            rationale: 'Analyst executed reversible unmerge/split from review queue'
          });
          alert(`Reversible Split Completed cleanly!\n${res.message}`);
          await this.renderReviewCards();
          if (window.ResolutionComponent) window.ResolutionComponent.renderCandidatesTable();
          if (window.AuditComponent) window.AuditComponent.renderAuditTable();
        } catch (err) {
          alert('Reversal error: ' + err.message);
        }
      });
    });

    document.querySelectorAll('.btn-reject-merge').forEach(btn => {
      btn.addEventListener('click', async () => {
        const candId = btn.getAttribute('data-id');

        try {
          await API.post('/review/reject', {
            candidateId: candId,
            rationale: 'Analyst confirmed entities are distinct'
          });
          alert(`Flagged candidate pair ${candId} as distinct false positive`);
          await this.renderReviewCards();
          if (window.ResolutionComponent) window.ResolutionComponent.renderCandidatesTable();
          if (window.AuditComponent) window.AuditComponent.renderAuditTable();
        } catch (err) {
          alert('Rejection error: ' + err.message);
        }
      });
    });
  }
};
