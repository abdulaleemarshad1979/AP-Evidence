const WorkshopComponent = {
  render: async () => {
    return `
      <div class="card p-4">
        <h2 class="h4 font-weight-bold text-primary mb-3">
          <i class="fas fa-th-large mr-2"></i>Phase 10: Workshop Custom App Builder
        </h2>
        <p class="text-muted small">
          Low-code dashboard builder. Drag and assemble modular widgets (Map, Timeline, Relationship Graph, Evidence Ledger, Alert Queue) into custom case workspaces.
        </p>

        <div class="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h6 class="font-weight-bold text-dark mb-0">Active Workshop Workspace: Operation AP-VANGUARD</h6>
            <small class="text-muted">Case ID: CASE-AP-2026-0001</small>
          </div>
          <button class="btn btn-sm btn-primary" onclick="WorkshopComponent.saveLayout()">
            <i class="fas fa-save mr-1"></i>Save Workshop Dashboard
          </button>
        </div>

        <div class="row">
          <div class="col-md-6 mb-3">
            <div class="card border-primary shadow-sm h-100 p-3">
              <h6 class="font-weight-bold text-primary"><i class="fas fa-map-marked-alt mr-2"></i>Widget 1: Geo-Temporal Map Workspace</h6>
              <p class="small text-muted mb-2">Live PostGIS spatial observation tracks and cell tower hits.</p>
              <div class="bg-light border rounded p-3 text-center small text-muted">
                Spatial Coordinate Stream Grid (16.5062°N, 80.6480°E) Active
              </div>
            </div>
          </div>

          <div class="col-md-6 mb-3">
            <div class="card border-info shadow-sm h-100 p-3">
              <h6 class="font-weight-bold text-info"><i class="fas fa-project-diagram mr-2"></i>Widget 2: Subject Relationship Graph</h6>
              <p class="small text-muted mb-2">Multi-hop associative link analysis between subjects and assets.</p>
              <div class="bg-light border rounded p-3 text-center small text-muted">
                Entity Node Mesh: SUB-00001 (K. Rajesh) &rarr; ASSOCIATE_OF &rarr; SUB-00004
              </div>
            </div>
          </div>

          <div class="col-md-6 mb-3">
            <div class="card border-warning shadow-sm h-100 p-3">
              <h6 class="font-weight-bold text-warning"><i class="fas fa-bell mr-2"></i>Widget 3: Spatial Detection Alert Feed</h6>
              <p class="small text-muted mb-2">Real-time co-location & speed plausibility alert queue.</p>
              <div class="bg-light border rounded p-3 text-center small text-muted">
                Active Rule Monitors: Co-location 500m window (3 alerts triaged)
              </div>
            </div>
          </div>

          <div class="col-md-6 mb-3">
            <div class="card border-secondary shadow-sm h-100 p-3">
              <h6 class="font-weight-bold text-dark"><i class="fas fa-shield-alt mr-2"></i>Widget 4: Cryptographic Evidence Vault</h6>
              <p class="small text-muted mb-2">WORM evidence custody ledger & SHA-256 verification status.</p>
              <div class="bg-light border rounded p-3 text-center small text-muted">
                Chain of Custody Ledger: 100% SHA-256 Verified Stream Integrity
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  saveLayout: async () => {
    const title = prompt('Enter a title for this Workshop Dashboard:', 'Investigator Control Workspace');
    if (!title) return;

    try {
      await API.post('/api/workshop/dashboards', {
        title,
        caseId: 'CASE-AP-2026-0001',
        layoutConfig: [
          { widget: 'MAP', position: 1 },
          { widget: 'GRAPH', position: 2 },
          { widget: 'ALERTS', position: 3 },
          { widget: 'EVIDENCE', position: 4 }
        ]
      });
      alert('Workshop dashboard layout saved successfully!');
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  }
};
