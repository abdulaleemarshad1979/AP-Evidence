const OntologyComponent = {
  render: async () => {
    return `
      <div class="card p-4">
        <h2 class="h4 font-weight-bold text-primary mb-3">
          <i class="fas fa-sitemap mr-2"></i>Palantir Ontology Manager & SDK Studio
        </h2>
        <p class="text-muted small">
          Define dynamic object types, link types, action types, and governed functions without code deploys. Every application reads and writes through this single governed contract.
        </p>

        <ul class="nav nav-tabs mb-3" id="ontologyTabs" role="tablist">
          <li class="nav-item">
            <a class="nav-link active" id="schema-tab" data-toggle="tab" href="#ontSchema" role="tab">Ontology Primitives</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" id="actions-tab" data-toggle="tab" href="#ontActions" role="tab">Action Types & Functions</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" id="sdk-tab" data-toggle="tab" href="#ontSDK" role="tab">Generated Ontology SDK</a>
          </li>
        </ul>

        <div class="tab-content" id="ontologyTabContent">
          <div class="tab-pane fade show active" id="ontSchema" role="tabpanel">
            <div class="row">
              <div class="col-md-6 mb-3">
                <div class="border rounded p-3 bg-light">
                  <h6 class="font-weight-bold text-dark mb-3">Define Object Type</h6>
                  <div class="form-group mb-2">
                    <label class="small font-weight-bold">API Name (e.g. FinancialAccount)</label>
                    <input type="text" id="ontTypeName" class="form-control form-control-sm" placeholder="FinancialAccount" />
                  </div>
                  <div class="form-group mb-2">
                    <label class="small font-weight-bold">Display Name</label>
                    <input type="text" id="ontDisplayLabel" class="form-control form-control-sm" placeholder="Bank Account Entity" />
                  </div>
                  <div class="form-group mb-2">
                    <label class="small font-weight-bold">Description</label>
                    <input type="text" id="ontDesc" class="form-control form-control-sm" placeholder="Financial bank account node" />
                  </div>
                  <button class="btn btn-sm btn-primary mt-2" onclick="OntologyComponent.createObjectType()">
                    <i class="fas fa-plus mr-1"></i>Define Object Type
                  </button>
                </div>
              </div>

              <div class="col-md-6 mb-3">
                <div class="border rounded p-3 bg-light">
                  <h6 class="font-weight-bold text-dark mb-3">Define Link Type</h6>
                  <div class="form-group mb-2">
                    <label class="small font-weight-bold">Link API Name (e.g. TRANSACTED_WITH)</label>
                    <input type="text" id="ontLinkName" class="form-control form-control-sm" placeholder="TRANSACTED_WITH" />
                  </div>
                  <div class="form-group mb-2">
                    <label class="small font-weight-bold">Display Label</label>
                    <input type="text" id="ontLinkDisplay" class="form-control form-control-sm" placeholder="Financial Transaction" />
                  </div>
                  <div class="form-group mb-2">
                    <label class="small font-weight-bold">Object A &rarr; Object B</label>
                    <div class="form-row">
                      <div class="col-6">
                        <input type="text" id="ontSrcType" class="form-control form-control-sm" value="Person" />
                      </div>
                      <div class="col-6">
                        <input type="text" id="ontDstType" class="form-control form-control-sm" value="FinancialAccount" />
                      </div>
                    </div>
                  </div>
                  <button class="btn btn-sm btn-success mt-2" onclick="OntologyComponent.createLinkType()">
                    <i class="fas fa-link mr-1"></i>Define Link Type
                  </button>
                </div>
              </div>
            </div>

            <div class="mt-3">
              <h6 class="font-weight-bold text-dark">Active Object & Link Registry</h6>
              <div id="ontologyList" class="table-responsive">
                <div class="text-muted small">Loading ontology registry...</div>
              </div>
            </div>
          </div>

          <div class="tab-pane fade" id="ontActions" role="tabpanel">
            <div id="actionTypesList" class="table-responsive">
              <div class="text-muted small">Loading action types...</div>
            </div>
          </div>

          <div class="tab-pane fade" id="ontSDK" role="tabpanel">
            <h6 class="font-weight-bold text-dark">Generated Typed Client Contract</h6>
            <pre id="sdkContractCode" class="bg-dark text-light p-3 rounded" style="max-height: 400px; overflow-y: auto;">Loading SDK contract...</pre>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await OntologyComponent.loadOntology();
    await OntologyComponent.loadActions();
    await OntologyComponent.loadSDK();
  },

  loadOntology: async () => {
    try {
      const objRes = await API.get('/api/ontology/object-types');
      const linkRes = await API.get('/api/ontology/link-types');
      const container = document.getElementById('ontologyList');
      if (!container) return;

      let html = '<div class="row"><div class="col-md-6"><h6>Object Types</h6><ul class="list-group list-group-flush">';
      (objRes.objectTypes || []).forEach(o => {
        const name = o.apiName || o.typeName;
        const label = o.displayName || o.displayLabel;
        html += `<li class="list-group-item d-flex justify-content-between align-items-center py-2 small">
          <div><strong>${label}</strong> (${name})<br><span class="text-muted">${o.description || 'Custom object type'}</span></div>
          <span class="badge badge-primary">v${o.version}</span>
        </li>`;
      });
      html += '</ul></div><div class="col-md-6"><h6>Link Types</h6><ul class="list-group list-group-flush">';
      (linkRes.linkTypes || []).forEach(l => {
        const name = l.apiName || l.linkName;
        const label = l.displayName || l.displayLabel;
        const a = l.objectTypeA || l.sourceType;
        const b = l.objectTypeB || l.targetType;
        html += `<li class="list-group-item d-flex justify-content-between align-items-center py-2 small">
          <div><strong>${label}</strong> (${name})<br><span class="text-muted">${a} &rarr; ${b}</span></div>
          <span class="badge badge-info">v${l.version}</span>
        </li>`;
      });
      html += '</ul></div></div>';
      container.innerHTML = html;
    } catch (err) {
      console.error(err);
    }
  },

  loadActions: async () => {
    try {
      const res = await API.get('/api/ontology/action-types');
      const container = document.getElementById('actionTypesList');
      if (!container) return;

      let html = '<table class="table table-sm table-striped small"><thead><tr><th>Action Type</th><th>Target Object</th><th>Attached Function</th><th>Version</th></tr></thead><tbody>';
      (res.actionTypes || []).forEach(a => {
        html += `<tr>
          <td><strong>${a.apiName}</strong><br><span class="text-muted">${a.displayName}</span></td>
          <td><span class="badge badge-secondary">${a.targetObjectType}</span></td>
          <td><code>${a.functionId}</code></td>
          <td>v${a.version}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (err) {
      console.error(err);
    }
  },

  loadSDK: async () => {
    try {
      const res = await API.get('/api/ontology/sdk');
      const container = document.getElementById('sdkContractCode');
      if (!container) return;
      container.textContent = JSON.stringify(res.contract, null, 2);
    } catch (err) {
      console.error(err);
    }
  },

  createObjectType: async () => {
    const typeName = document.getElementById('ontTypeName').value;
    const displayLabel = document.getElementById('ontDisplayLabel').value;
    const description = document.getElementById('ontDesc').value;
    try {
      await API.post('/api/ontology/object-types', { apiName: typeName, typeName, displayName: displayLabel, displayLabel, description });
      alert('Object type created successfully!');
      await OntologyComponent.loadOntology();
      await OntologyComponent.loadSDK();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  },

  createLinkType: async () => {
    const linkName = document.getElementById('ontLinkName').value;
    const displayLabel = document.getElementById('ontLinkDisplay').value;
    const sourceType = document.getElementById('ontSrcType').value;
    const targetType = document.getElementById('ontDstType').value;
    try {
      await API.post('/api/ontology/link-types', { apiName: linkName, linkName, displayName: displayLabel, displayLabel, objectTypeA: sourceType, sourceType, objectTypeB: targetType, targetType });
      alert('Link type created successfully!');
      await OntologyComponent.loadOntology();
      await OntologyComponent.loadSDK();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  }
};
