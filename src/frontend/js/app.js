document.addEventListener('DOMContentLoaded', async () => {
  console.log('[ANDHRA PRADESH INTELLIGENCE SYSTEM] Initializing Phase 3 Investigator Workspace...');

  // User credentials map for synthetic user context switcher
  const USER_CREDENTIALS = {
    'USR-101': { username: 'analyst_lead', password: 'pass_lead_101' },
    'USR-102': { username: 'case_manager', password: 'pass_mgr_102' },
    'USR-103': { username: 'compliance_auditor', password: 'pass_audit_103' },
    'USR-104': { username: 'sys_admin', password: 'pass_admin_104' },
    'USR-105': { username: 'unassigned_analyst', password: 'pass_foreign_105' }
  };

  // Perform initial default login for USR-101
  try {
    const defaultUser = USER_CREDENTIALS['USR-101'];
    const authRes = await API.post('/auth/login', defaultUser);
    if (authRes && authRes.token) {
      API.setToken(authRes.token);
    }
  } catch (err) {
    console.warn('[APIS AUTH] Initial auto-login warning:', err.message);
  }

  // User Switcher listener for authentic OIDC/JWT context switching
  const userSwitcher = document.getElementById('user-switcher');
  if (userSwitcher) {
    userSwitcher.addEventListener('change', async (e) => {
      const selectedId = e.target.value;
      const creds = USER_CREDENTIALS[selectedId];
      if (creds) {
        try {
          const res = await API.post('/auth/login', creds);
          API.setToken(res.token);
          alert(`Switched operational context to: ${res.user.name} (${res.user.role} / ${res.user.organization})`);
          
          // Refresh components with new security clearance
          await CasesComponent.init();
          await ImportComponent.init();
          await ResolutionComponent.init();
          await Subject360Component.init();
          await EvidenceComponent.init();
          await ReviewComponent.init();
          await AuditComponent.init();
        } catch (err) {
          alert(`Authentication switch failed: ${err.message}`);
        }
      }
    });
  }

  // Global Search Input Listener for Phase 3 Investigator Search
  const globalSearchInput = document.getElementById('global-search-input');
  if (globalSearchInput) {
    globalSearchInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const query = globalSearchInput.value.trim();
        if (!query) return;
        
        // Switch to Subject 360 tab and execute search
        const tabBtn = document.querySelector('.nav-tab[data-tab="subject360"]');
        if (tabBtn) tabBtn.click();

        const subjInput = document.getElementById('subject-search-input');
        if (subjInput) {
          subjInput.value = query;
          const searchBtn = document.getElementById('btn-search-subject');
          if (searchBtn) searchBtn.click();
        }
      }
    });
  }

  // Global window references for cross-component calls
  window.CasesComponent = CasesComponent;
  window.ImportComponent = ImportComponent;
  window.ResolutionComponent = ResolutionComponent;
  window.Subject360Component = Subject360Component;
  window.GraphComponent = GraphComponent;
  window.MapComponent = MapComponent;
  window.EvidenceComponent = EvidenceComponent;
  window.ReviewComponent = ReviewComponent;
  window.AuditComponent = AuditComponent;

  // Initialize components
  await CasesComponent.init();
  await ImportComponent.init();
  await ResolutionComponent.init();
  await Subject360Component.init();
  await EvidenceComponent.init();
  await ReviewComponent.init();
  await AuditComponent.init();

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

      // Lazy load heavy canvas / map components upon tab activation
      if (targetTabId === 'graph') {
        setTimeout(() => GraphComponent.init(), 100);
      } else if (targetTabId === 'geospatial') {
        setTimeout(() => MapComponent.init(), 100);
      }
    });
  });

  console.log('[ANDHRA PRADESH INTELLIGENCE SYSTEM] Investigator Workspace initialization complete. Phase 3 operational.');
});
