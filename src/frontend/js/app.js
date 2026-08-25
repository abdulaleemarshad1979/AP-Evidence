document.addEventListener('DOMContentLoaded', async () => {
  console.log('[PALANTIR ENTERPRISE OS] Initializing Platform Pillars (Foundry, Gotham, AIP, Apollo)...');

  // Operational OIDC user credential matrix with clearance mapping
  const USER_CREDENTIALS = {
    'USR-ADMIN': { username: 'Admin', password: 'admin', clearance: 4 },
    'USR-USER': { username: 'user', password: 'user', clearance: 2 },
    'USR-101': { username: 'analyst_lead', password: 'pass_lead_101', clearance: 3 },
    'USR-102': { username: 'case_manager', password: 'pass_mgr_102', clearance: 2 },
    'USR-103': { username: 'compliance_auditor', password: 'pass_audit_103', clearance: 1 },
    'USR-104': { username: 'sys_admin', password: 'pass_admin_104', clearance: 4 },
  };

  // Helper to execute login and update session context across components
  async function performLogin(username, password) {
    try {
      const res = await API.post('/auth/login', { username, password });
      if (res && res.token) {
        API.setToken(res.token);
        if (clearanceBadge) {
          clearanceBadge.innerText = `CLEARANCE LEVEL ${res.user.role === 'Admin' ? 4 : (res.user.role === 'Auditor' ? 1 : 3)} (${res.user.role.toUpperCase()})`;
        }

        // Refresh components with new clearance context
        await Subject360Component.init();
        if (window.GraphComponent && window.GraphComponent.nodes) {
          await GraphComponent.loadNetwork();
        }
        await loadFoundryOntology();
        await CasesComponent.init();
        await ResolutionComponent.init();
        await EvidenceComponent.init();
        await AuditComponent.init();
        return res;
      }
    } catch (err) {
      throw err;
    }
  }

  // Perform initial default login for Lead Investigator (Level 3)
  try {
    const defaultUser = USER_CREDENTIALS['USR-101'];
    await performLogin(defaultUser.username, defaultUser.password);
  } catch (err) {
    console.warn('[PALANTIR AUTH] Initial auto-login warning:', err.message);
  }

  // User Switcher listener for OIDC/JWT context switching & ABAC clearance level shifts
  const userSwitcher = document.getElementById('user-switcher');
  const clearanceBadge = document.getElementById('header-clearance-badge');

  if (userSwitcher) {
    userSwitcher.addEventListener('change', async (e) => {
      const selectedId = e.target.value;
      const creds = USER_CREDENTIALS[selectedId];
      if (creds) {
        try {
          await performLogin(creds.username, creds.password);
        } catch (err) {
          alert(`Authentication switch failed: ${err.message}`);
        }
      }
    });
  }

  // Login Modal Event Listeners
  const loginModal = document.getElementById('login-modal');
  const btnHeaderLoginModal = document.getElementById('btn-header-login-modal');
  const closeLoginModalBtn = document.getElementById('close-login-modal');
  const loginForm = document.getElementById('login-form');
  const loginUsernameInput = document.getElementById('login-username-input');
  const loginPasswordInput = document.getElementById('login-password-input');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const btnQuickAdmin = document.getElementById('btn-quick-admin');
  const btnQuickUser = document.getElementById('btn-quick-user');

  if (btnHeaderLoginModal && loginModal) {
    btnHeaderLoginModal.addEventListener('click', () => {
      loginModal.classList.add('active');
      if (loginUsernameInput) loginUsernameInput.focus();
    });
  }

  if (closeLoginModalBtn && loginModal) {
    closeLoginModalBtn.addEventListener('click', () => {
      loginModal.classList.remove('active');
      if (loginErrorMsg) loginErrorMsg.style.display = 'none';
    });
  }

  if (btnQuickAdmin && loginUsernameInput && loginPasswordInput) {
    btnQuickAdmin.addEventListener('click', () => {
      loginUsernameInput.value = 'Admin';
      loginPasswordInput.value = 'admin';
      loginForm.dispatchEvent(new Event('submit'));
    });
  }

  if (btnQuickUser && loginUsernameInput && loginPasswordInput) {
    btnQuickUser.addEventListener('click', () => {
      loginUsernameInput.value = 'user';
      loginPasswordInput.value = 'user';
      loginForm.dispatchEvent(new Event('submit'));
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = loginUsernameInput.value.trim();
      const p = loginPasswordInput.value.trim();
      if (loginErrorMsg) loginErrorMsg.style.display = 'none';

      try {
        await performLogin(u, p);
        if (loginModal) loginModal.classList.remove('active');
        loginUsernameInput.value = '';
        loginPasswordInput.value = '';
      } catch (err) {
        if (loginErrorMsg) {
          loginErrorMsg.innerText = err.message || 'Invalid username or password credentials';
          loginErrorMsg.style.display = 'block';
        }
      }
    });
  }

  // Global Command Palette (Ctrl + K) & Search Bar Keyboard Shortcut Listener
  const cmdModal = document.getElementById('cmd-palette-modal');
  const globalSearchInput = document.getElementById('global-search-input');

  window.app = {
    openCmdPalette() {
      if (cmdModal) {
        cmdModal.classList.add('active');
        const input = document.getElementById('cmd-palette-input');
        if (input) input.focus();
      }
    },
    closeCmdPalette() {
      if (cmdModal) cmdModal.classList.remove('active');
    },
    switchTab(tabId) {
      const tabBtn = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
      if (tabBtn) tabBtn.click();
    }
  };

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      window.app.openCmdPalette();
    }
    if (e.key === 'Escape') {
      window.app.closeCmdPalette();
    }
  });

  if (globalSearchInput) {
    globalSearchInput.addEventListener('click', () => {
      window.app.openCmdPalette();
    });
  }

  // Navigation Tab Switching Logic
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetTabId = tab.getAttribute('data-tab');
      const targetContent = document.getElementById(`tab-${targetTabId}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      // Lazy load tab engines upon tab activation
      if (targetTabId === 'graph') {
        setTimeout(() => GraphComponent.init(), 100);
      } else if (targetTabId === 'geospatial') {
        setTimeout(() => MapComponent.init(), 100);
      } else if (targetTabId === 'foundry') {
        await loadFoundryOntology();
      }
    });
  });

  // Global Window Component Bindings
  window.CasesComponent = CasesComponent;
  window.ResolutionComponent = ResolutionComponent;
  window.Subject360Component = Subject360Component;
  window.GraphComponent = GraphComponent;
  window.MapComponent = MapComponent;
  window.EvidenceComponent = EvidenceComponent;
  window.AuditComponent = AuditComponent;

  // Initialize Core Components
  await Subject360Component.init();
  await CasesComponent.init();
  await ResolutionComponent.init();
  await EvidenceComponent.init();
  await AuditComponent.init();

  // Setup AIP Brief Execution Listener
  const aipExecBtn = document.getElementById('btn-execute-aip-run');
  if (aipExecBtn) {
    aipExecBtn.addEventListener('click', async () => {
      const task = document.getElementById('aip-task-select')?.value || 'GENERATE_GROUNDED_BRIEF';
      const entityId = document.getElementById('aip-entity-input')?.value.trim() || '';
      const textbox = document.getElementById('aip-output-textbox');
      const confTag = document.getElementById('aip-confidence-tag');

      if (textbox) textbox.value = 'Synthesizing grounded intelligence brief with cryptographic evidence citations...';

      try {
        const res = await API.post('/ai/assist', { task, entityId, caseId: API.activeCaseId });
        if (textbox) textbox.value = res.outputText;
        if (confTag) confTag.innerText = `${Math.round(res.confidenceScore * 100)}% Grounded Confidence`;
      } catch (err) {
        if (textbox) textbox.value = 'AIP Engine Error: ' + err.message;
      }
    });
  }

  // Load Foundry Dynamic Ontology Explorer Data
  async function loadFoundryOntology() {
    const tbody = document.getElementById('foundry-ontology-tbody');
    if (!tbody) return;

    try {
      const data = await API.get('/subject360/search?query=');
      tbody.innerHTML = '';
      (data.entities || []).forEach(e => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="mono" style="color: var(--accent-cyan); font-weight: bold;">${API.escapeHTML(e.id)}</td>
          <td><span class="badge-status badge-high">${API.escapeHTML(e.type || 'Subject')}</span></td>
          <td><strong>${API.escapeHTML(e.name)}</strong></td>
          <td class="mono" style="font-size: 0.75rem;">${API.escapeHTML((e.aliases || []).join(', ') || JSON.stringify(e.identifierFields || {}))}</td>
          <td><span class="badge-status badge-medium">Level ${e.metadata?.clearanceRequired || 2}</span></td>
          <td><span class="mono" style="color: var(--accent-emerald); font-size: 0.75rem;">${API.escapeHTML(e.provenanceSource || 'PostgreSQL spatial_obs')}</span></td>
          <td class="mono" style="color: var(--accent-cyan);">${Math.round((e.confidenceScore || 0.95) * 100)}%</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Failed to load Foundry ontology:', err);
    }
  }

  console.log('[PALANTIR ENTERPRISE OS] All 4 Pillars initialized successfully. Operational state ready.');
});
