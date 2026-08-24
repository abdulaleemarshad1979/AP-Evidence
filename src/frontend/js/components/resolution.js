const ResolutionComponent = {
  async init() {
    await this.renderCandidatesTable();
    this.bindEvents();
  },

  async renderCandidatesTable() {
    const tableBody = document.getElementById('resolution-candidates-table');
    if (!tableBody) return;

    try {
      const data = await API.get('/resolution/candidates');
      tableBody.innerHTML = '';

      let pendingCount = 0;

      data.candidates.forEach(cand => {
        if (cand.status === 'PENDING_REVIEW') pendingCount++;

        const tr = document.createElement('tr');
        const scorePct = Math.round(cand.matchScore * 100);
        const badgeClass = scorePct >= 85 ? 'badge-critical' : 'badge-high';

        const reasonsList = cand.reasons.map(r => `• ${r.feature}: ${r.note}`).join('<br>');

        tr.innerHTML = `
          <td class="mono" style="color: var(--accent-cyan); font-weight: 600;">${cand.id}</td>
          <td><strong>${cand.entityADetails ? cand.entityADetails.name : cand.entityA}</strong><br><small class="mono">${cand.entityA}</small></td>
          <td><strong>${cand.entityBDetails ? cand.entityBDetails.name : cand.entityB}</strong><br><small class="mono">${cand.entityB}</small></td>
          <td><span class="badge-status ${badgeClass}">${scorePct}% MATCH</span></td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${reasonsList}</td>
          <td><span class="badge-status ${cand.status === 'MERGED' ? 'badge-low' : 'badge-high'}">${cand.status}</span></td>
          <td>
            ${cand.status === 'PENDING_REVIEW' ? `
              <button class="btn btn-primary btn-sm btn-review-cand" data-id="${cand.id}">
                <i class="fa-solid fa-code-compare"></i> Review Merge
              </button>
            ` : `<span style="color: var(--text-muted); font-size: 0.8rem;">Completed</span>`}
          </td>
        `;
        tableBody.appendChild(tr);
      });

      const badgeRes = document.getElementById('nav-res-badge');
      if (badgeRes) badgeRes.innerText = pendingCount;

    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7">Failed to load resolution candidates.</td></tr>`;
    }
  },

  bindEvents() {
    const scanBtn = document.getElementById('btn-run-resolution');
    if (scanBtn) {
      scanBtn.addEventListener('click', async () => {
        try {
          const res = await API.post('/resolution/run-scan', {});
          alert(`Scan Finished: Found ${res.newCandidatesCount} new candidate pairs.`);
          await this.renderCandidatesTable();
          if (window.ReviewComponent) window.ReviewComponent.renderReviewCards();
          if (window.AuditComponent) window.AuditComponent.renderAuditTable();
        } catch (err) {
          alert('Resolution scan error: ' + err.message);
        }
      });
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-review-cand');
      if (btn) {
        // Switch to Review Tab
        const tabBtn = document.querySelector('.nav-tab[data-tab="review"]');
        if (tabBtn) tabBtn.click();
      }
    });
  }
};
