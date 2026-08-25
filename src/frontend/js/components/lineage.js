const LineageComponent = {
  render: async () => {
    return `
      <div class="card p-4">
        <h2 class="h4 font-weight-bold text-primary mb-3">
          <i class="fas fa-project-diagram mr-2"></i>Monocle Data Lineage & Provenance Graph
        </h2>
        <p class="text-muted small">
          Inspect end-to-end data provenance for any Ontology entity or dataset to verify "where did this data come from?". Traces raw ingestion feeds, NLP mining transforms, evidence custody, and action audits.
        </p>

        <div class="form-inline mb-4">
          <label class="mr-2 font-weight-bold small">Target Entity / Subject ID:</label>
          <input type="text" id="lineageTargetId" class="form-control form-control-sm mr-2" value="SUB-00001" placeholder="e.g. SUB-00001" />
          <button class="btn btn-sm btn-primary" onclick="LineageComponent.traceLineage()">
            <i class="fas fa-search mr-1"></i>Trace Lineage
          </button>
        </div>

        <div class="border rounded bg-dark text-light p-3 position-relative" style="min-height: 400px;" id="lineageCanvas">
          <div class="text-center text-muted py-5">Enter an entity ID to display data lineage provenance tree...</div>
        </div>

        <div class="mt-3">
          <h6 class="font-weight-bold text-dark">Provenance Node Details</h6>
          <div id="lineageDetails" class="table-responsive">
            <div class="text-muted small">Select a node or trace a target to view details.</div>
          </div>
        </div>
      </div>
    `;
  },

  init: async () => {
    await LineageComponent.traceLineage();
  },

  traceLineage: async () => {
    const targetId = document.getElementById('lineageTargetId')?.value || 'SUB-00001';
    const canvas = document.getElementById('lineageCanvas');
    const details = document.getElementById('lineageDetails');
    if (!canvas) return;

    try {
      canvas.innerHTML = '<div class="text-center text-light py-5"><i class="fas fa-spinner fa-spin mr-2"></i>Tracing lineage provenance...</div>';
      const res = await API.get(`/api/lineage/${targetId}`);
      const graph = res.graph;

      if (!graph || !graph.nodes || graph.nodes.length === 0) {
        canvas.innerHTML = '<div class="text-center text-warning py-5">No lineage provenance records found for target ID.</div>';
        return;
      }

      // Render nodes as a visual flowchart pipeline
      let html = '<div class="d-flex flex-wrap align-items-center justify-content-around py-4">';
      graph.nodes.forEach((node, idx) => {
        let badgeColor = 'badge-primary';
        if (node.nodeType === 'DATASET') badgeColor = 'badge-success';
        if (node.nodeType === 'PIPELINE_TRANSFORM') badgeColor = 'badge-warning';
        if (node.nodeType === 'EVIDENCE_ITEM') badgeColor = 'badge-info';
        if (node.nodeType === 'ACTION_EXECUTION') badgeColor = 'badge-danger';

        html += `
          <div class="card bg-secondary text-white p-3 m-2 shadow-sm" style="min-width: 200px; max-width: 250px; border-left: 4px solid #007bff;">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge ${badgeColor}">${node.nodeType}</span>
              <small class="text-light">#${idx + 1}</small>
            </div>
            <strong class="small text-truncate">${node.name}</strong>
            <span class="small text-white-50 mt-1">${node.sourceRef}</span>
          </div>
        `;
        if (idx < graph.nodes.length - 1) {
          html += '<div class="text-light h4 mx-2">&rarr;</div>';
        }
      });
      html += '</div>';

      canvas.innerHTML = html;

      // Details table
      let tableHtml = '<table class="table table-sm table-striped small"><thead><tr><th>Node Name</th><th>Type</th><th>Source Ref</th><th>Metadata</th></tr></thead><tbody>';
      graph.nodes.forEach(n => {
        tableHtml += `<tr>
          <td><strong>${n.name}</strong></td>
          <td><span class="badge badge-secondary">${n.nodeType}</span></td>
          <td><code>${n.sourceRef}</code></td>
          <td>${JSON.stringify(n.metadata || {})}</td>
        </tr>`;
      });
      tableHtml += '</tbody></table>';
      details.innerHTML = tableHtml;
    } catch (err) {
      canvas.innerHTML = `<div class="text-danger p-3">Failed to trace lineage: ${err.message}</div>`;
    }
  }
};
