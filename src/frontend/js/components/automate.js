/**
 * Palantir Automate Alerting Engine Component
 * Visual Rule Builder UI for creating background automations and monitoring proposal history.
 */
const AutomateComponent = {
  rules: [],
  proposals: [],

  init: async () => {
    await AutomateComponent.loadRules();
    await AutomateComponent.loadProposals();
  },

  loadRules: async () => {
    try {
      const res = await API.get('/api/automate/rules');
      AutomateComponent.rules = res.rules || [];
      AutomateComponent.renderRules();
    } catch (err) {
      console.error('Failed to load Automate rules:', err.message);
    }
  },

  loadProposals: async () => {
    try {
      const res = await API.get('/api/automate/proposals');
      AutomateComponent.proposals = res.proposals || [];
      AutomateComponent.renderProposals();
    } catch (err) {
      console.error('Failed to load Automate proposals:', err.message);
    }
  },

  toggleRule: async (ruleId, currentEnabled) => {
    try {
      await API.post(`/api/automate/rules/${ruleId}/toggle`, { enabled: !currentEnabled });
      await AutomateComponent.loadRules();
    } catch (err) {
      alert('Toggle rule failed: ' + err.message);
    }
  },

  triggerEvaluation: async () => {
    try {
      const res = await API.post('/api/automate/evaluate', {});
      alert(`Automate evaluation pass completed. Generated ${res.newProposalsCount} new PENDING_REVIEW proposal(s).`);
      await AutomateComponent.loadProposals();
    } catch (err) {
      alert('Evaluation pass failed: ' + err.message);
    }
  },

  createRule: async () => {
    const name = prompt('Enter Automate Rule Name:', 'Speed Plausibility Threshold Monitor');
    if (!name) return;

    const conditionType = prompt('Enter Condition Type (SPEED_PLAUSIBILITY | CO_LOCATION | WATCHLIST_MATCH):', 'SPEED_PLAUSIBILITY');
    if (!conditionType) return;

    try {
      await API.post('/api/automate/rules', {
        name,
        description: 'User-defined automated intelligence monitor',
        proposedActionType: 'FLAG_SUBJECT',
        conditionDefinition: {
          type: conditionType,
          maxSpeedKmH: 120,
          radiusMeters: 500
        },
        enabled: true
      });
      alert(`Automate rule '${name}' created successfully!`);
      await AutomateComponent.loadRules();
    } catch (err) {
      alert('Create rule failed: ' + err.message);
    }
  },

  renderRules: () => {
    const container = document.getElementById('automate-rules-list-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${AutomateComponent.rules.length === 0 ? `
          <div class="p-3 text-muted mono">No automations registered. Click "+ Create Automate Rule".</div>
        ` : AutomateComponent.rules.map(r => `
          <div style="background: var(--bg-panel); border: 1px solid ${r.enabled ? 'var(--accent-cyan)' : 'var(--border-color)'}; padding: 0.75rem 1rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <strong style="color: #fff; font-size: 0.88rem;">${r.name}</strong>
                <span class="badge-status ${r.enabled ? 'badge-low' : 'badge-high'}">${r.enabled ? 'ENABLED' : 'DISABLED'}</span>
              </div>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0.2rem 0 0 0;">${r.description || 'Condition: ' + r.conditionDefinition?.type}</p>
              <div class="mono" style="font-size: 0.72rem; color: var(--accent-cyan); margin-top: 0.2rem;">
                Proposed Action: <strong style="color: var(--accent-amber);">${r.proposedActionType}</strong> | Review Required: YES
              </div>
            </div>
            <button class="btn btn-sm ${r.enabled ? '' : 'btn-primary'}" onclick="AutomateComponent.toggleRule('${r.id}', ${r.enabled})">
              ${r.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderProposals: () => {
    const container = document.getElementById('automate-proposals-list-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${AutomateComponent.proposals.length === 0 ? `
          <div class="p-3 text-muted mono">No proposals generated yet.</div>
        ` : AutomateComponent.proposals.map(p => `
          <div style="background: var(--bg-panel); border: 1px solid var(--border-color); padding: 0.75rem 1rem; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
              <span class="mono" style="color: var(--accent-cyan); font-weight: bold;">[${p.id}] Proposal</span>
              <span class="badge-status ${p.reviewStatus === 'APPROVED' ? 'badge-low' : 'badge-medium'}">${p.reviewStatus}</span>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-bright); margin-bottom: 0.3rem;">${p.outputText}</p>
            <div class="mono text-muted" style="font-size: 0.72rem;">
              Rule: ${p.inputParams?.ruleName || 'Automate Engine'} | Created: ${new Date(p.createdAt).toLocaleTimeString()}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
};
