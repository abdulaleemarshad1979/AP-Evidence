/**
 * Palantir Quiver Analysis Canvas Component
 * Drag-and-drop analytical card canvas supporting canvas mode and graph mode per case.
 */
const QuiverComponent = {
  currentMode: 'CANVAS', // CANVAS | GRAPH
  currentCanvasId: null,
  cards: [],

  init: async () => {
    await QuiverComponent.loadCanvases();
  },

  loadCanvases: async () => {
    const select = document.getElementById('quiver-canvas-select');
    if (!select) return;

    try {
      const res = await API.get('/api/quiver/canvases');
      if (res && res.canvases && res.canvases.length > 0) {
        select.innerHTML = res.canvases.map(c => `<option value="${c.id}">${c.title} (${c.mode})</option>`).join('');
        QuiverComponent.loadCanvasById(res.canvases[0].id);
      } else {
        select.innerHTML = `<option value="">No Saved Canvases</option>`;
      }
    } catch (err) {
      console.warn('Failed to load Quiver canvases:', err.message);
    }
  },

  loadCanvasById: async (canvasId) => {
    if (!canvasId) return;
    try {
      const res = await API.get(`/api/quiver/canvases/${canvasId}`);
      if (res && res.canvas) {
        QuiverComponent.currentCanvasId = res.canvas.id;
        QuiverComponent.currentMode = res.canvas.mode || 'CANVAS';
        QuiverComponent.cards = res.canvas.canvasData?.cards || [];
        QuiverComponent.render();
      }
    } catch (err) {
      console.error('Failed to load canvas by ID:', err.message);
    }
  },

  switchMode: (mode) => {
    QuiverComponent.currentMode = mode;
    QuiverComponent.render();
  },

  addCard: (cardType) => {
    const cardId = `CARD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let title = 'Object Set Card';
    let content = { objectType: 'Person', filter: 'ALL' };

    if (cardType === 'CHART') {
      title = 'Property Distribution Chart';
      content = { chartType: 'BAR', groupBy: 'status' };
    } else if (cardType === 'GRAPH_NODE') {
      title = 'Entity Relationship Node';
      content = { entityId: 'SUB-00001' };
    }

    QuiverComponent.cards.push({
      id: cardId,
      type: cardType,
      title,
      content,
      x: 20 + (QuiverComponent.cards.length * 30),
      y: 20 + (QuiverComponent.cards.length * 20)
    });

    QuiverComponent.render();
  },

  saveCanvas: async () => {
    const titleInput = document.getElementById('quiver-canvas-title-input');
    const title = titleInput?.value || 'Analyst Quiver Canvas';

    try {
      const res = await API.post('/api/quiver/canvases', {
        id: QuiverComponent.currentCanvasId || undefined,
        caseId: 'CASE-AP-2026-0001',
        title,
        mode: QuiverComponent.currentMode,
        canvasData: { cards: QuiverComponent.cards }
      });

      if (res && res.canvas) {
        QuiverComponent.currentCanvasId = res.canvas.id;
        alert('Quiver canvas saved successfully!');
        await QuiverComponent.loadCanvases();
      }
    } catch (err) {
      alert('Failed to save Quiver canvas: ' + err.message);
    }
  },

  render: () => {
    const container = document.getElementById('quiver-workspace-container');
    if (!container) return;

    if (QuiverComponent.currentMode === 'GRAPH') {
      container.innerHTML = `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 1rem; border-radius: 6px; height: 450px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <h4 style="font-size: 0.85rem; color: var(--accent-cyan);"><i class="fa-solid fa-diagram-project"></i> Quiver Graph Mode Analysis</h4>
            <span class="mono" style="font-size: 0.75rem; color: var(--accent-emerald);">Linked Node Mesh Active</span>
          </div>
          <div id="quiver-graph-render-area" style="background: #05080E; height: 380px; border-radius: 4px; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; color: var(--text-muted);" class="mono">
            [Graph Renderer Mode — Reusing Knowledge Graph Visualizer]
          </div>
        </div>
      `;
      if (window.GraphComponent && typeof window.GraphComponent.loadGraphData === 'function') {
        setTimeout(() => window.GraphComponent.loadGraphData('quiver-graph-render-area'), 100);
      }
      return;
    }

    // Free-form Canvas Mode
    container.innerHTML = `
      <div style="position: relative; width: 100%; min-height: 480px; background: #05080E; border: 1px dashed var(--border-color); border-radius: 6px; padding: 1rem; display: flex; flex-wrap: wrap; gap: 1rem;">
        ${QuiverComponent.cards.length === 0 ? `
          <div style="margin: auto; text-align: center; color: var(--text-muted);" class="mono">
            Canvas is empty. Click "+ Add Object Card" or "+ Add Chart Card" to add analytical blocks.
          </div>
        ` : QuiverComponent.cards.map((c, idx) => `
          <div class="card" style="width: 280px; background: var(--bg-panel); border: 1px solid var(--accent-cyan); box-shadow: var(--shadow-glow);">
            <div class="card-header" style="padding: 0.5rem;">
              <strong style="font-size: 0.8rem; color: var(--accent-cyan);"><i class="fa-solid ${c.type === 'CHART' ? 'fa-chart-pie' : 'fa-cube'}"></i> ${c.title}</strong>
              <button class="btn btn-sm" onclick="QuiverComponent.removeCard(${idx})" style="padding: 0 0.4rem; font-size: 0.7rem; color: var(--accent-crimson);">&times;</button>
            </div>
            <div style="font-size: 0.78rem; padding: 0.5rem; color: var(--text-muted);" class="mono">
              <div>Card ID: ${c.id}</div>
              <div>Type: ${c.type}</div>
              <div style="margin-top: 0.3rem; color: var(--text-bright);">${JSON.stringify(c.content)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  removeCard: (index) => {
    QuiverComponent.cards.splice(index, 1);
    QuiverComponent.render();
  }
};
