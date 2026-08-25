const WorkbookComponent = {
  render: async () => {
    return `
      <div class="card p-4">
        <h2 class="h4 font-weight-bold text-primary mb-3">
          <i class="fas fa-calculator mr-2"></i>Phase 10: Foundry Code Workbook / Notebook
        </h2>
        <p class="text-muted small">
          Sandboxed, parameterized analytical workspace. Query entities, observations, assertions, and evidence rows under ABAC authorization boundaries. Every execution is audited.
        </p>

        <div class="row">
          <div class="col-md-4">
            <div class="border rounded p-3 bg-light mb-3">
              <h6 class="font-weight-bold text-dark mb-3">Query Parameters</h6>
              <div class="form-group mb-2">
                <label class="small font-weight-bold">Target Dataset</label>
                <select id="wbDataset" class="form-control form-control-sm">
                  <option value="observations">Observations (Spatial/Temporal)</option>
                  <option value="entities">Entities (Subjects, Vehicles)</option>
                  <option value="assertions">Assertions (Relationships)</option>
                  <option value="evidence">Evidence Vault Metadata</option>
                </select>
              </div>
              <div class="form-group mb-2">
                <label class="small font-weight-bold">Case Context</label>
                <input type="text" id="wbCaseId" class="form-control form-control-sm" value="CASE-AP-2026-0001" />
              </div>
              <div class="form-group mb-2">
                <label class="small font-weight-bold">Filter Field (Optional)</label>
                <input type="text" id="wbFilterField" class="form-control form-control-sm" placeholder="location_name" />
              </div>
              <div class="form-group mb-2">
                <label class="small font-weight-bold">Filter Value (Optional)</label>
                <input type="text" id="wbFilterVal" class="form-control form-control-sm" placeholder="Vijayawada" />
              </div>
              <button class="btn btn-sm btn-primary w-100 mt-2" onclick="WorkbookComponent.runQuery()">
                <i class="fas fa-play mr-1"></i>Execute Workbook Query
              </button>
            </div>
          </div>

          <div class="col-md-8">
            <div class="border rounded p-3 bg-white">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="font-weight-bold text-dark mb-0">Execution Results (<span id="wbCount">0</span> rows)</h6>
                <button class="btn btn-xs btn-outline-secondary" onclick="WorkbookComponent.saveBoard()">
                  <i class="fas fa-bookmark mr-1"></i>Save as Named Board
                </button>
              </div>
              <div id="wbResults" class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                <div class="text-muted text-center py-4 small">Configure query parameters and click "Execute Workbook Query".</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  runQuery: async () => {
    const targetDataset = document.getElementById('wbDataset').value;
    const caseId = document.getElementById('wbCaseId').value;
    const filterField = document.getElementById('wbFilterField').value;
    const filterValue = document.getElementById('wbFilterVal').value;

    try {
      const res = await API.post('/api/workbook/query', {
        targetDataset, caseId, filterField, filterValue
      });

      document.getElementById('wbCount').innerText = res.resultCount;
      const container = document.getElementById('wbResults');

      if (!res.rows.length) {
        container.innerHTML = '<div class="text-muted text-center py-4 small">Zero records returned for query parameters.</div>';
        return;
      }

      const keys = Object.keys(res.rows[0]);
      let html = '<table class="table table-sm table-striped small"><thead><tr>';
      keys.forEach(k => html += `<th>${k}</th>`);
      html += '</tr></thead><tbody>';

      res.rows.forEach(r => {
        html += '<tr>';
        keys.forEach(k => {
          let val = r[k];
          if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
          html += `<td>${API.escapeHTML(String(val || ''))}</td>`;
        });
        html += '</tr>';
      });
      html += 'tbody></table>';
      container.innerHTML = html;
    } catch (err) {
      alert('Query execution failed: ' + err.message);
    }
  },

  saveBoard: async () => {
    const title = prompt('Enter a name for this Code Workbook Board:', 'Investigative Analysis Board');
    if (!title) return;

    try {
      await API.post('/api/workbook/boards', {
        title,
        caseId: document.getElementById('wbCaseId').value,
        queryConfig: {
          targetDataset: document.getElementById('wbDataset').value,
          filterField: document.getElementById('wbFilterField').value,
          filterValue: document.getElementById('wbFilterVal').value
        }
      });
      alert('Workbook board saved successfully!');
    } catch (err) {
      alert('Failed to save board: ' + err.message);
    }
  }
};
