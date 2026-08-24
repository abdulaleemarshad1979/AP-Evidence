const ImportComponent = {
  async init() {
    await this.renderHistoryTable();
    this.bindEvents();
  },

  async renderHistoryTable() {
    const historyTable = document.getElementById('import-history-table');
    if (!historyTable) return;

    try {
      const data = await API.get('/import/history');
      historyTable.innerHTML = '';

      data.imports.forEach(imp => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="mono" style="color: var(--accent-cyan);">${imp.batchId}</td>
          <td>${imp.sourceFeed}</td>
          <td><span class="mono">${imp.ingestedEvents} Records</span></td>
          <td class="mono">${new Date(imp.timestamp).toLocaleTimeString()}</td>
          <td><span class="badge-status badge-low">${imp.status}</span></td>
        `;
        historyTable.appendChild(tr);
      });
    } catch (err) {
      historyTable.innerHTML = `<tr><td colspan="5">No import history found.</td></tr>`;
    }
  },

  bindEvents() {
    const form = document.getElementById('ingest-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedName = document.getElementById('import-feed-name').value;
      const classification = document.getElementById('import-classification').value;
      const jsonRaw = document.getElementById('import-json-payload').value;

      let records = [];
      try {
        records = JSON.parse(jsonRaw);
      } catch (err) {
        alert('Invalid JSON in payload field: ' + err.message);
        return;
      }

      try {
        const res = await API.post('/import/ingest', {
          sourceFeed: feedName,
          classification,
          records
        });
        alert(`Successfully ingested ${res.summary.ingestedEvents} records! Batch ID: ${res.summary.batchId}`);
        await this.renderHistoryTable();
        if (window.AuditComponent) window.AuditComponent.renderAuditTable();
      } catch (err) {
        alert('Ingestion error: ' + err.message);
      }
    });
  }
};
