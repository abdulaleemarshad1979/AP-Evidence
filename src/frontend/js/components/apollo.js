/**
 * Palantir Apollo Control Plane Component
 * Environment release orchestration, config diff viewer, and deployment plan manager.
 */
const ApolloComponent = {
  environments: [],
  plans: [],

  init: async () => {
    await ApolloComponent.loadEnvironments();
    await ApolloComponent.loadPlans();
  },

  loadEnvironments: async () => {
    try {
      const res = await API.get('/api/apollo/environments');
      ApolloComponent.environments = res.environments || [];
      ApolloComponent.renderEnvironments();
      ApolloComponent.renderConfigDiff();
    } catch (err) {
      console.error('Failed to load Apollo environments:', err.message);
    }
  },

  loadPlans: async () => {
    try {
      const res = await API.get('/api/apollo/plans');
      ApolloComponent.plans = res.plans || [];
      ApolloComponent.renderPlans();
    } catch (err) {
      console.error('Failed to load Apollo release plans:', err.message);
    }
  },

  createReleasePlan: async (envId, currentVer) => {
    const toVersion = prompt(`Enter target version to upgrade environment ${envId} (Current: ${currentVer}):`, '2.1.0');
    if (!toVersion) return;

    try {
      await API.post('/api/apollo/plans', {
        environmentId: envId,
        fromVersion: currentVer,
        toVersion
      });
      alert(`Release Plan to upgrade ${envId} to v${toVersion} created successfully!`);
      await ApolloComponent.loadEnvironments();
      await ApolloComponent.loadPlans();
    } catch (err) {
      alert('Create release plan failed: ' + err.message);
    }
  },

  triggerRollback: async (planId) => {
    if (!confirm('Execute immediate emergency rollback on this environment?')) return;
    try {
      const res = await API.post(`/api/apollo/plans/${planId}/rollback`, {});
      alert(`Rollback executed! Environment reverted to v${res.revertedVersion}.`);
      await ApolloComponent.loadEnvironments();
      await ApolloComponent.loadPlans();
    } catch (err) {
      alert('Rollback failed: ' + err.message);
    }
  },

  renderEnvironments: () => {
    const container = document.getElementById('apollo-environments-list-container');
    if (!container) return;

    container.innerHTML = `
      <div class="grid-3">
        ${ApolloComponent.environments.map(e => `
          <div style="background: var(--bg-panel); border: 1px solid var(--border-color); padding: 0.85rem 1rem; border-radius: 6px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <strong style="color: #fff; font-size: 0.9rem;">${e.name}</strong>
                <span class="badge-status ${e.healthStatus === 'HEALTHY' ? 'badge-low' : 'badge-high'}">${e.healthStatus}</span>
              </div>
              <div class="mono" style="font-size: 0.76rem; color: var(--accent-cyan);">
                Type: <strong>${e.environmentType}</strong> | ID: ${e.id}
              </div>
              <div style="margin-top: 0.5rem; background: var(--bg-main); padding: 0.5rem; border-radius: 4px;" class="mono">
                <div style="font-size: 0.78rem; color: var(--text-bright);">Active Version: <span style="color: var(--accent-emerald); font-weight: bold;">v${e.currentVersion}</span></div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">Target Version: <span style="color: var(--accent-amber);">v${e.targetVersion}</span></div>
              </div>
            </div>
            <div style="margin-top: 0.8rem; display: flex; gap: 0.4rem;">
              <button class="btn btn-sm btn-primary" style="flex: 1;" onclick="ApolloComponent.createReleasePlan('${e.id}', '${e.currentVersion}')">
                <i class="fa-solid fa-upload"></i> Deploy Upgrade
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderConfigDiff: () => {
    const container = document.getElementById('apollo-config-diff-container');
    if (!container) return;

    const devEnv = ApolloComponent.environments.find(e => e.environmentType === 'DEV') || ApolloComponent.environments[0];
    const prodEnv = ApolloComponent.environments.find(e => e.environmentType === 'PROD') || ApolloComponent.environments[1];

    if (!devEnv || !prodEnv) {
      container.innerHTML = `<div class="p-3 text-muted mono">Select environments to view configuration diff.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="grid-2">
        <div style="background: var(--bg-panel); border: 1px solid var(--border-color); padding: 0.75rem 1rem; border-radius: 6px;">
          <h5 class="mono" style="color: var(--accent-cyan); margin-bottom: 0.5rem;"><i class="fa-solid fa-code"></i> ${devEnv.name} (DEV Config)</h5>
          <pre class="mono" style="font-size: 0.78rem; color: #a5f3fc; background: var(--bg-main); padding: 0.5rem; border-radius: 4px; overflow-x: auto;">${JSON.stringify(devEnv.configJson, null, 2)}</pre>
        </div>
        <div style="background: var(--bg-panel); border: 1px solid var(--border-color); padding: 0.75rem 1rem; border-radius: 6px;">
          <h5 class="mono" style="color: var(--accent-amber); margin-bottom: 0.5rem;"><i class="fa-solid fa-code"></i> ${prodEnv.name} (PROD Config)</h5>
          <pre class="mono" style="font-size: 0.78rem; color: #fde68a; background: var(--bg-main); padding: 0.5rem; border-radius: 4px; overflow-x: auto;">${JSON.stringify(prodEnv.configJson, null, 2)}</pre>
        </div>
      </div>
    `;
  },

  renderPlans: () => {
    const container = document.getElementById('apollo-plans-list-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${ApolloComponent.plans.length === 0 ? `
          <div class="p-3 text-muted mono bg-panel border rounded text-center">No active release plans recorded.</div>
        ` : ApolloComponent.plans.map(p => `
          <div style="background: var(--bg-panel); border: 1px solid var(--border-color); padding: 0.75rem 1rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <strong class="mono" style="color: #fff; font-size: 0.88rem;">[${p.id}]</strong>
                <span class="badge-status ${p.status === 'SUCCESS' ? 'badge-low' : p.status === 'ROLLED_BACK' ? 'badge-high' : 'badge-medium'}">${p.status}</span>
                <span class="mono text-muted" style="font-size: 0.75rem;">Env: ${p.environmentId}</span>
              </div>
              <p style="font-size: 0.8rem; color: var(--accent-cyan); margin: 0.3rem 0 0 0;" class="mono">
                Migration Path: <strong>v${p.fromVersion}</strong> &rarr; <strong style="color: var(--accent-emerald);">v${p.toVersion}</strong>
              </p>
              <div class="mono text-muted" style="font-size: 0.72rem; margin-top: 0.2rem;">
                Approved By: ${p.approvedBy || 'System'} | Created: ${new Date(p.createdAt).toLocaleTimeString()}
              </div>
            </div>
            <div>
              ${p.status !== 'ROLLED_BACK' ? `
                <button class="btn btn-sm" style="color: var(--accent-crimson); border-color: var(--accent-crimson);" onclick="ApolloComponent.triggerRollback('${p.id}')">
                  <i class="fa-solid fa-rotate-left"></i> Emergency Rollback
                </button>
              ` : `
                <span class="mono text-muted" style="font-size: 0.75rem;">ROLLED BACK</span>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
};
