const AuditComponent = {
  async init() {
    await this.renderAuditTable();
  },

  async renderAuditTable() {
    const tableBody = document.getElementById('audit-table-body');
    const chainStatus = document.getElementById('audit-chain-status');
    if (!tableBody) return;

    try {
      const data = await API.get('/audit');
      tableBody.innerHTML = '';

      if (chainStatus) {
        if (data.isCryptographicChainValid) {
          chainStatus.className = 'badge-status badge-low';
          chainStatus.innerHTML = '<i class="fa-solid fa-check-double"></i> HASH CHAIN VERIFIED';
        } else {
          chainStatus.className = 'badge-status badge-critical';
          chainStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> CHAIN CORRUPTED';
        }
      }

      data.auditLogs.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="mono" style="color: var(--accent-cyan); font-size: 0.75rem;">${log.id}</td>
          <td class="mono" style="font-size: 0.75rem;">${new Date(log.timestamp).toLocaleString()}</td>
          <td><strong>${log.username}</strong></td>
          <td><span class="badge-status badge-medium">${log.action}</span></td>
          <td>${log.module}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${log.details}</td>
          <td class="mono" style="font-size: 0.7rem; color: var(--accent-emerald); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${log.hash}</td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7">Failed to load audit ledger logs.</td></tr>`;
    }
  }
};
