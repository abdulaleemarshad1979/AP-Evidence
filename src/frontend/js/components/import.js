const ImportComponent = {
  async init() {
    await this.renderHistoryTable();
    this.bindEvents();
  },

  async renderHistoryTable() {
    const tableBody = document.getElementById('import-history-table');
    if (!tableBody) return;

    try {
      const data = await API.get('/import/history');
      tableBody.innerHTML = '';

      data.imports.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="mono" style="color: var(--accent-cyan); font-weight: 600;">${b.batchId}</td>
          <td><strong>${b.sourceFeed}</strong><br><small style="color: var(--text-muted);">${b.feedType}</small></td>
          <td><span class="badge-status badge-low">${b.acceptedRecords} Accepted</span></td>
          <td><span class="badge-status ${b.quarantinedRecords > 0 ? 'badge-critical' : 'badge-low'}">${b.quarantinedRecords} Quarantined</span></td>
          <td><span class="badge-status ${b.duplicateRecords > 0 ? 'badge-high' : 'badge-low'}">${b.duplicateRecords} Duplicates</span></td>
          <td><span class="badge-status badge-low">${b.status}</span></td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="6" style="color: var(--accent-crimson);">${err.message}</td></tr>`;
    }
  },

  bindEvents() {
    const form = document.getElementById('ingest-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const feedName = document.getElementById('import-feed-name').value;
        const jsonStr = document.getElementById('import-json-payload').value;

        let records = [];
        try {
          records = JSON.parse(jsonStr);
        } catch (err) {
          alert('Invalid JSON formatting in telemetry records payload.');
          return;
        }

        try {
          const res = await API.post('/import/ingest', {
            sourceFeed: feedName,
            feedType: 'LIVE_TELEMETRY',
            records
          });
          alert(`Ingestion Executed cleanly!\nAccepted: ${res.summary.acceptedRecords}\nQuarantined: ${res.summary.quarantinedRecords}\nDuplicates: ${res.summary.duplicateRecords}`);
          document.getElementById('import-json-payload').value = '';
          await this.renderHistoryTable();
          if (window.AuditComponent) window.AuditComponent.renderAuditTable();
        } catch (err) {
          alert('Ingestion error: ' + err.message);
        }
      });
    }
  }
};
