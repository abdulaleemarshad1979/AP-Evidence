const AuditComponent = {
  async init() {
    await this.renderAuditTable();
  },

  async renderAuditTable() {
    const tableBody = document.getElementById('audit-table-body');
    const badge = document.getElementById('audit-chain-status');
    if (!tableBody) return;

    try {
      const data = await API.get('/audit');
      tableBody.innerHTML = '';

      if (badge) {
        if (data.isCryptographicChainValid) {
          badge.className = 'badge-status badge-low';
          badge.innerHTML = `<i class="fa-solid fa-check-double"></i> HASH CHAIN VERIFIED (${data.totalRecords} Logs)`;
        } else {
          badge.className = 'badge-status badge-critical';
          badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> TAMPER DETECTED AT INDEX ${data.tamperedIndex}`;
        }
      }

      data.auditLogs.forEach(log => {
        const tr = document.createElement('tr');
        const isAccessDenied = log.action === 'ACCESS_DENIED';

        tr.innerHTML = `
          <td class="mono" style="color: var(--accent-cyan); font-weight: 600;">${log.id}</td>
          <td class="mono" style="font-size: 0.8rem;">${new Date(log.timestamp).toUTCString()}</td>
          <td><strong>${log.username}</strong></td>
          <td><span class="badge-status ${isAccessDenied ? 'badge-critical' : 'badge-low'}">${log.action}</span></td>
          <td><span class="mono">${log.module}</span></td>
          <td style="font-size: 0.85rem;">${log.details}</td>
          <td class="mono" style="font-size: 0.75rem; color: var(--accent-emerald);">${log.hash ? log.hash.slice(0, 16) : ''}...</td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7">${err.message}</td></tr>`;
    }
  }
};
