const CasesComponent = {
  async init() {
    await this.renderCasesTable();
    this.bindEvents();
  },

  async renderCasesTable() {
    const tableBody = document.getElementById('cases-table-body');
    if (!tableBody) return;

    try {
      const data = await API.get('/cases');
      tableBody.innerHTML = '';

      data.cases.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="mono" style="color: var(--accent-cyan); font-weight: 600;">${c.id}</td>
          <td><strong>${c.title}</strong><br><small style="color: var(--text-muted);">${c.codeName}</small></td>
          <td><span class="clearance-badge">${c.classification}</span></td>
          <td><span class="badge-status badge-${c.threatLevel.toLowerCase()}">${c.threatLevel}</span></td>
          <td><span class="mono">${c.targetEntityIds ? c.targetEntityIds.length : 0} Target(s)</span></td>
          <td>
            <button class="btn btn-primary btn-sm btn-select-case" data-id="${c.id}" data-title="${c.title}">
              <i class="fa-solid fa-folder-open"></i> Open Case
            </button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="6" style="color: var(--accent-crimson);">Failed to load cases.</td></tr>`;
    }
  },

  bindEvents() {
    const form = document.getElementById('create-case-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const caseData = {
          title: document.getElementById('case-title').value,
          codeName: document.getElementById('case-codename').value,
          classification: document.getElementById('case-classification').value,
          threatLevel: document.getElementById('case-threat').value,
          description: document.getElementById('case-desc').value
        };

        try {
          await API.post('/cases', caseData);
          form.reset();
          await this.renderCasesTable();
          if (window.AuditComponent) window.AuditComponent.renderAuditTable();
        } catch (err) {
          alert('Error creating case: ' + err.message);
        }
      });
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-select-case');
      if (btn) {
        const id = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        document.getElementById('current-case-title').innerText = `CASE: ${title.toUpperCase()} (${id})`;
        alert(`Active case set to: ${title} (${id})`);
      }
    });
  }
};
