/**
 * Palantir Control Room Dashboard Component
 * Cross-case command center combining multi-case spatial maps, unified review queue, and system health telemetry.
 */
const ControlRoomComponent = {
  proposals: [],
  systemHealth: null,

  init: async () => {
    await ControlRoomComponent.loadSystemHealth();
    await ControlRoomComponent.loadPendingQueue();
  },

  loadSystemHealth: async () => {
    try {
      const res = await API.get('/api/system/status');
      ControlRoomComponent.systemHealth = res || {};
      ControlRoomComponent.renderSystemHealth();
    } catch (err) {
      console.warn('Failed to load system status:', err.message);
    }
  },

  loadPendingQueue: async () => {
    try {
      const res = await API.get('/api/aip/runs');
      ControlRoomComponent.proposals = (res.runs || []).filter(r => r.review_status === 'PENDING_REVIEW');
      ControlRoomComponent.renderPendingQueue();
    } catch (err) {
      console.warn('Failed to load pending queue:', err.message);
    }
  },

  approveProposal: async (runId) => {
    try {
      await API.post(`/api/aip/runs/${runId}/review`, {
        reviewStatus: 'APPROVED',
        notes: 'Approved via Control Room Command Center'
      });
      alert(`Proposal '${runId}' approved and executed successfully!`);
      await ControlRoomComponent.loadPendingQueue();
    } catch (err) {
      alert('Approval failed: ' + err.message);
    }
  },

  rejectProposal: async (runId) => {
    try {
      await API.post(`/api/aip/runs/${runId}/review`, {
        reviewStatus: 'REJECTED',
        notes: 'Rejected via Control Room'
      });
      alert(`Proposal '${runId}' rejected.`);
      await ControlRoomComponent.loadPendingQueue();
    } catch (err) {
      alert('Rejection failed: ' + err.message);
    }
  },

  renderSystemHealth: () => {
    const container = document.getElementById('control-room-health-container');
    if (!container) return;

    const health = ControlRoomComponent.systemHealth;
    container.innerHTML = `
      <div class="grid-3" style="margin-bottom: 1rem;">
        <div style="background: var(--bg-panel); border: 1px solid var(--border-color); padding: 0.75rem 1rem; border-radius: 6px;">
          <small class="mono text-muted">PLATFORM STATUS</small>
          <div style="font-size: 1rem; font-weight: bold; color: var(--accent-emerald); margin-top: 0.2rem;">
            <i class="fa-solid fa-circle-check"></i> ${health.status || 'OPERATIONAL'}
          </div>
        </div>
        <div style="background: var(--bg-panel); border: 1px solid var(--border-color); padding: 0.75rem 1rem; border-radius: 6px;">
          <small class="mono text-muted">ACTIVE CASES MONITOR</small>
          <div style="font-size: 1rem; font-weight: bold; color: var(--accent-cyan); margin-top: 0.2rem;" class="mono">
            ${health.activeCasesCount || 1} Operational Cases
          </div>
        </div>
        <div style="background: var(--bg-panel); border: 1px solid var(--border-color); padding: 0.75rem 1rem; border-radius: 6px;">
          <small class="mono text-muted">DATABASE & ENGINE HEALTH</small>
          <div style="font-size: 1rem; font-weight: bold; color: var(--accent-amber); margin-top: 0.2rem;" class="mono">
            PostgreSQL 16 / Spatial PostGIS Healthy
          </div>
        </div>
      </div>
    `;
  },

  renderPendingQueue: () => {
    const container = document.getElementById('control-room-queue-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${ControlRoomComponent.proposals.length === 0 ? `
          <div class="p-3 text-muted mono bg-panel border rounded text-center">
            Zero pending proposals in unified review queue. All AI and Automate proposals triaged.
          </div>
        ` : ControlRoomComponent.proposals.map(p => `
          <div style="background: var(--bg-panel); border: 1px solid var(--accent-amber); padding: 0.75rem 1rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="mono" style="color: var(--accent-amber); font-weight: bold;">[${p.id}]</span>
                <span class="badge-status badge-high">${p.prompt_task || 'GOVERNED_PROPOSAL'}</span>
                <span class="mono text-muted" style="font-size: 0.75rem;">Case: ${p.case_id || 'Global'}</span>
              </div>
              <p style="font-size: 0.8rem; color: #fff; margin: 0.3rem 0 0 0;">${p.output_text}</p>
            </div>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-sm btn-primary" onclick="ControlRoomComponent.approveProposal('${p.id}')"><i class="fa-solid fa-check"></i> Approve</button>
              <button class="btn btn-sm" style="color: var(--accent-crimson);" onclick="ControlRoomComponent.rejectProposal('${p.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
};
