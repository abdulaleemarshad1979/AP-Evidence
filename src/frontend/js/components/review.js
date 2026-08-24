const ReviewComponent = {
  async init() {
    await this.renderReviewCards();
  },

  async renderReviewCards() {
    const container = document.getElementById('review-cards-container');
    if (!container) return;

    try {
      const data = await API.get('/resolution/candidates');
      const pending = data.candidates.filter(c => c.status === 'PENDING_REVIEW');

      const badge = document.getElementById('nav-review-badge');
      if (badge) badge.innerText = pending.length;

      if (pending.length === 0) {
        container.innerHTML = `<div class="card" style="text-align: center; color: var(--accent-emerald);">All candidate resolution pairs have been reviewed by analysts. Queue clear!</div>`;
        return;
      }

      container.innerHTML = '';

      pending.forEach(cand => {
        const card = document.createElement('div');
        card.className = 'card';

        const eA = cand.entityADetails || { id: cand.entityA, name: 'Target A' };
        const eB = cand.entityBDetails || { id: cand.entityB, name: 'Target B' };
        const scorePct = Math.round(cand.matchScore * 100);

        card.innerHTML = `
          <div class="card-header">
            <div class="card-title"><i class="fa-solid fa-code-compare"></i> Candidate Resolution Pair #${cand.id}</div>
            <span class="badge-status badge-critical">${scorePct}% CONFIDENCE MATCH</span>
          </div>

          <div class="comparison-container">
            <div class="comparison-box target">
              <h4 style="color: var(--accent-cyan);">${eA.name}</h4>
              <div class="mono" style="font-size: 0.8rem;">ID: ${eA.id} | Type: ${eA.type}</div>
              <div style="font-size: 0.85rem; margin-top: 0.5rem;">
                Phone: ${eA.primaryPhone || 'N/A'}<br>
                Passport: ${eA.passportNo || 'N/A'}<br>
                Location: ${eA.primaryLocation || 'N/A'}
              </div>
            </div>

            <div class="comparison-box">
              <h4 style="color: var(--accent-amber);">${eB.name}</h4>
              <div class="mono" style="font-size: 0.8rem;">ID: ${eB.id} | Type: ${eB.type}</div>
              <div style="font-size: 0.85rem; margin-top: 0.5rem;">
                Phone: ${eB.primaryPhone || 'N/A'}<br>
                Passport: ${eB.passportNo || 'N/A'}<br>
                Location: ${eB.primaryLocation || 'N/A'}
              </div>
            </div>
          </div>

          <div style="background: var(--bg-panel); padding: 0.75rem; border-radius: 4px; font-size: 0.85rem;">
            <strong>Algorithmic Correlation Factors:</strong>
            <ul style="margin-left: 1.2rem; margin-top: 0.3rem;">
              ${cand.reasons.map(r => `<li>${r.feature}: ${r.note} (Score: ${r.score})</li>`).join('')}
            </ul>
          </div>

          <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button class="btn btn-danger btn-reject-merge" data-id="${cand.id}">
              <i class="fa-solid fa-xmark"></i> Flag as Distinct (Reject)
            </button>
            <button class="btn btn-primary btn-confirm-merge" data-id="${cand.id}" data-pa="${eA.id}" data-pb="${eB.id}">
              <i class="fa-solid fa-code-merge"></i> Confirm & Merge Entity Records
            </button>
          </div>
        `;
        container.appendChild(card);
      });

      this.bindCardEvents();

    } catch (err) {
      container.innerHTML = `<div class="card">Failed to load review queue: ${err.message}</div>`;
    }
  },

  bindCardEvents() {
    document.querySelectorAll('.btn-confirm-merge').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const candId = btn.getAttribute('data-id');
        const primaryId = btn.getAttribute('data-pa');
        const secondaryId = btn.getAttribute('data-pb');

        try {
          await API.post('/review/merge', {
            candidateId: candId,
            primaryId,
            secondaryId,
            rationale: 'Analyst verified high-confidence correlation features'
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

    document.querySelectorAll('.btn-reject-merge').forEach(btn => {
      btn.addEventListener('click', async (e) => {
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
