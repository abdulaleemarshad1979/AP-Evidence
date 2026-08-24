document.addEventListener('DOMContentLoaded', async () => {
  console.log('[AP PLATFORM] Initializing Enterprise Intelligence Dashboard...');

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

  console.log('[AP PLATFORM] Platform initialization complete. All systems nominal.');
});
