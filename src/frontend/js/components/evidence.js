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
          <td><strong>${ev.title}</strong><br><small style="color: var(--text-muted);">${ev.mediaType} (${ev.fileSize})</small></td>
          <td><span class="badge-status badge-low">${ev.evidenceStatus}</span></td>
          <td><span class="badge-status ${ev.isOriginal ? 'badge-low' : 'badge-high'}">${ev.isOriginal ? 'ORIGINAL' : 'DERIVED'}</span></td>
          <td class="mono" style="font-size: 0.75rem; color: var(--accent-emerald);">${ev.sha256.slice(0, 16)}...</td>
          <td>${ev.custodian}</td>
          <td>
            <button class="btn btn-primary btn-sm btn-view-ev" data-id="${ev.id}">
              <i class="fa-solid fa-eye"></i> View & Hash
            </button>
            <button class="btn btn-warning btn-sm btn-export-ev" data-id="${ev.id}">
              <i class="fa-solid fa-download"></i> Export
            </button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7">${err.message}</td></tr>`;
    }
  },

  bindEvents() {
    const modal = document.getElementById('evidence-modal');
    const closeBtn = document.getElementById('btn-close-modal');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    }

    document.addEventListener('click', async (e) => {
      const viewBtn = e.target.closest('.btn-view-ev');
      if (viewBtn) {
        const evId = viewBtn.getAttribute('data-id');
        try {
          const res = await API.get(`/evidence/${evId}`);
          const ev = res.evidence;
          document.getElementById('modal-ev-title').innerText = `EVIDENCE VAULT: ${ev.id}`;
          document.getElementById('modal-ev-content').innerHTML = `
            <div><strong>Title:</strong> ${ev.title}</div>
            <div><strong>Classification:</strong> ${ev.classification}</div>
            <div><strong>Record Lineage:</strong> ${ev.isOriginal ? 'ORIGINAL SOURCE CAPTURE' : `DERIVED ANALYSIS (Parent: ${ev.parentEvidenceId})`}</div>
            <div><strong>Server-Side SHA-256:</strong> <code class="mono" style="color: var(--accent-emerald);">${ev.sha256}</code></div>
            <div><strong>Custodian:</strong> ${ev.custodian}</div>
            <div><strong>Source Device:</strong> ${ev.sourceDevice}</div>
            <div>
              <strong>Append-Only Chain of Custody Ledger:</strong>
              <div class="table-container" style="margin-top: 0.5rem;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Notes</th>
                      <th>Hash Signature</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ev.chainOfCustody.map(c => `
                      <tr>
                        <td class="mono">${c.timestamp}</td>
                        <td>${c.user}</td>
                        <td><span class="badge-status badge-low">${c.action}</span></td>
                        <td>${c.notes}</td>
                        <td class="mono" style="font-size:0.7rem;">${c.hashSignature.slice(0, 12)}...</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
          modal.classList.add('active');
          await this.renderEvidenceTable();
          if (window.AuditComponent) window.AuditComponent.renderAuditTable();
        } catch (err) {
          alert('Evidence inspection error: ' + err.message);
        }
      }

      const exportBtn = e.target.closest('.btn-export-ev');
      if (exportBtn) {
        const evId = exportBtn.getAttribute('data-id');
        try {
          const res = await API.get(`/evidence/export/${evId}`);
          alert(`Evidence export authorized!\nServer-Side SHA-256: ${res.integrityCheck.serverSideHash}\nExported by: ${res.exportedBy}`);
          if (window.AuditComponent) window.AuditComponent.renderAuditTable();
        } catch (err) {
          alert('Export ABAC Error: ' + err.message);
        }
      }
    });
  }
};
