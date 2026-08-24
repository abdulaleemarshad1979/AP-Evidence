const EvidenceComponent = {
  async init() {
    await this.renderEvidenceTable();
    this.bindEvents();
  },

  async renderEvidenceTable() {
    const tableBody = document.getElementById('evidence-table-body');
    if (!tableBody) return;

    try {
      const data = await API.get('/evidence');
      tableBody.innerHTML = '';

      data.evidence.forEach(ev => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="mono" style="color: var(--accent-cyan); font-weight: 600;">${ev.id}</td>
          <td><strong>${ev.title}</strong><br><small style="color: var(--text-muted);">${ev.sourceDevice}</small></td>
          <td><span class="badge-status badge-medium">${ev.mediaType}</span></td>
          <td class="mono">${ev.fileSize}</td>
          <td class="mono" style="font-size: 0.72rem; color: var(--accent-emerald);">${ev.sha256}</td>
          <td>${ev.custodian}</td>
          <td>
            <button class="btn btn-primary btn-sm btn-view-ev" data-id="${ev.id}">
              <i class="fa-solid fa-shield"></i> Verify Custody
            </button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7">Failed to load evidence vault.</td></tr>`;
    }
  },

  async showModal(id) {
    const modal = document.getElementById('evidence-modal');
    const title = document.getElementById('modal-ev-title');
    const content = document.getElementById('modal-ev-content');

    try {
      const res = await API.get(`/evidence/${id}`);
      const ev = res.evidence;

      title.innerText = `EVIDENCE FILE: ${ev.id}`;
      content.innerHTML = `
        <div><strong>Title:</strong> ${ev.title}</div>
        <div><strong>Classification:</strong> <span class="clearance-badge">${ev.classification}</span></div>
        <div><strong>Source Device:</strong> ${ev.sourceDevice}</div>
        <div><strong>Current Custodian:</strong> ${ev.custodian}</div>
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid var(--accent-emerald); padding: 0.6rem; border-radius: 4px;">
          <strong style="color: var(--accent-emerald);"><i class="fa-solid fa-check-double"></i> SHA-256 INTEGRITY VERIFIED:</strong><br>
          <span class="mono" style="font-size: 0.75rem; word-break: break-all;">${ev.sha256}</span>
        </div>
        <div><strong>Chain of Custody Audit Log:</strong></div>
        <div style="max-height: 200px; overflow-y: auto; background: var(--bg-panel); border: 1px solid var(--border-color); padding: 0.5rem; border-radius: 4px;">
          ${ev.chainOfCustody.map(c => `
            <div style="border-bottom: 1px solid var(--border-color); padding: 0.4rem 0; font-size: 0.8rem;">
              <span class="mono" style="color: var(--accent-cyan);">${new Date(c.timestamp).toLocaleString()}</span> - <strong>${c.user}</strong><br>
              <span class="badge-status badge-low">${c.action}</span>: ${c.notes}
            </div>
          `).join('')}
        </div>
      `;

      modal.classList.add('active');
    } catch (err) {
      alert('Error fetching evidence: ' + err.message);
    }
  },

  bindEvents() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-view-ev');
      if (btn) {
        const id = btn.getAttribute('data-id');
        this.showModal(id);
      }

      const closeBtn = e.target.closest('#btn-close-modal');
      if (closeBtn) {
        document.getElementById('evidence-modal').classList.remove('active');
      }
    });
  }
};
