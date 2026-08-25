const AIPComponent = {
  render: async () => {
    return `
      <div class="card p-4">
        <h2 class="h4 font-weight-bold text-primary mb-3">
          <i class="fas fa-robot mr-2"></i>Palantir AIP (Artificial Intelligence Platform) Studio
        </h2>
        <p class="text-muted small">
          Interact with the Ontology Core using Natural Language. AIP uses function calling to query Object Sets, traverse typed link graphs, trace Monocle lineage, and execute governed Actions with mandatory evidence citations.
        </p>

        <div class="input-group mb-4">
          <input type="text" id="aipPromptInput" class="form-control" placeholder="e.g. Find person SUB-00001, or Trace lineage for SUB-00001, or Flag subject SUB-00001 for high review priority..." />
          <div class="input-group-append">
            <button class="btn btn-primary" onclick="AIPComponent.sendPrompt()">
              <i class="fas fa-paper-plane mr-1"></i>Ask AIP
            </button>
          </div>
        </div>

        <div class="row">
          <div class="col-md-4 mb-3">
            <div class="border rounded p-3 bg-light">
              <h6 class="font-weight-bold text-dark mb-2"><i class="fas fa-tools mr-1"></i>Registered AIP Tools</h6>
              <div id="aipToolsList" class="small text-muted">Loading registered tools...</div>
            </div>
          </div>

          <div class="col-md-8 mb-3">
            <div class="border rounded p-3 bg-dark text-light" style="min-height: 350px;" id="aipConsole">
              <div class="text-muted small">AIP reasoning trace and tool execution output will display here...</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await AIPComponent.loadTools();
  },

  loadTools: async () => {
    try {
      const res = await API.get('/api/aip/tools');
      const container = document.getElementById('aipToolsList');
      if (!container) return;

      let html = '<ul class="list-group list-group-flush">';
      (res.tools || []).forEach(t => {
        html += `<li class="list-group-item bg-transparent px-0 py-2 small">
          <strong><code>${t.name}</code></strong><br><span class="text-muted">${t.description}</span>
        </li>`;
      });
      html += '</ul>';
      container.innerHTML = html;
    } catch (err) {
      console.error(err);
    }
  },

  sendPrompt: async () => {
    const input = document.getElementById('aipPromptInput');
    const consoleDiv = document.getElementById('aipConsole');
    if (!input || !consoleDiv || !input.value.trim()) return;

    const prompt = input.value.trim();
    try {
      consoleDiv.innerHTML = '<div class="text-light"><i class="fas fa-spinner fa-spin mr-2"></i>AIP Agent reasoning over Ontology Core...</div>';
      const res = await API.post('/api/aip/query', { prompt });
      const resp = res.response;

      let html = `
        <div class="mb-3">
          <span class="badge badge-info mb-2"><i class="fas fa-user-edit mr-1"></i>Prompt</span>
          <p class="font-weight-bold text-warning">${resp.prompt}</p>
        </div>
        <div class="mb-3">
          <span class="badge badge-primary mb-2"><i class="fas fa-brain mr-1"></i>AIP Reasoning Engine</span>
          <p class="text-light small">${resp.reasoning}</p>
        </div>
        <div class="mb-3">
          <span class="badge badge-warning mb-2"><i class="fas fa-cogs mr-1"></i>Tool Invocations</span>
          <pre class="bg-secondary text-white p-2 rounded small">${JSON.stringify(resp.toolInvocations, null, 2)}</pre>
        </div>
        <div class="mb-3">
          <span class="badge badge-success mb-2"><i class="fas fa-bookmark mr-1"></i>Mandatory Evidence Citations</span>
          <div>${resp.citations.map(c => `<span class="badge badge-dark border border-secondary mr-1 mb-1">${c}</span>`).join('')}</div>
        </div>
        <div>
          <span class="badge badge-secondary mb-2"><i class="fas fa-database mr-1"></i>Ontology Core Output</span>
          <pre class="bg-secondary text-white p-2 rounded small" style="max-height: 200px; overflow-y: auto;">${JSON.stringify(resp.result, null, 2)}</pre>
        </div>
      `;
      consoleDiv.innerHTML = html;
    } catch (err) {
      consoleDiv.innerHTML = `<div class="text-danger">AIP Processing Error: ${err.message}</div>`;
    }
  }
};
