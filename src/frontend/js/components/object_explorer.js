/**
 * Palantir Object Explorer Component
 * Low-configuration investigator object browser powered strictly by Ontology Core generic services.
 */
const ObjectExplorerComponent = {
  currentObjectType: 'Person',
  currentView: 'TABLE', // TABLE | MAP | CHART
  objects: [],
  selectedKeys: new Set(),

  init: async () => {
    await ObjectExplorerComponent.loadObjectTypes();
    await ObjectExplorerComponent.loadObjects();
  },

  loadObjectTypes: async () => {
    const select = document.getElementById('obj-explorer-type-select');
    if (!select) return;

    try {
      const res = await API.get('/api/ontology/object-types');
      if (res && res.objectTypes) {
        select.innerHTML = res.objectTypes.map(ot => 
          `<option value="${ot.apiName || ot.typeName}">${ot.displayName || ot.displayLabel || ot.apiName} (${ot.apiName})</option>`
        ).join('');
        if (res.objectTypes.length > 0) {
          select.value = ObjectExplorerComponent.currentObjectType;
        }
      }
    } catch (err) {
      console.warn('Failed to load object types for explorer:', err.message);
    }
  },

  loadObjects: async () => {
    const type = document.getElementById('obj-explorer-type-select')?.value || ObjectExplorerComponent.currentObjectType;
    const search = document.getElementById('obj-explorer-search-input')?.value || '';
    ObjectExplorerComponent.currentObjectType = type;

    try {
      const res = await API.get(`/api/ontology/objects/${encodeURIComponent(type)}?search=${encodeURIComponent(search)}`);
      ObjectExplorerComponent.objects = res.objects || [];
      ObjectExplorerComponent.selectedKeys.clear();
      ObjectExplorerComponent.renderView();
    } catch (err) {
      console.error('Object Explorer fetch failed:', err.message);
    }
  },

  switchView: (viewName) => {
    ObjectExplorerComponent.currentView = viewName;
    const btnTable = document.getElementById('btn-obj-view-table');
    const btnMap = document.getElementById('btn-obj-view-map');
    const btnChart = document.getElementById('btn-obj-view-chart');

    if (btnTable) btnTable.className = viewName === 'TABLE' ? 'btn btn-primary' : 'btn';
    if (btnMap) btnMap.className = viewName === 'MAP' ? 'btn btn-primary' : 'btn';
    if (btnChart) btnChart.className = viewName === 'CHART' ? 'btn btn-primary' : 'btn';

    ObjectExplorerComponent.renderView();
  },

  renderView: () => {
    const container = document.getElementById('obj-explorer-content-view');
    if (!container) return;

    const objects = ObjectExplorerComponent.objects;

    if (ObjectExplorerComponent.currentView === 'TABLE') {
      if (objects.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-muted">No objects found for Object Type '${ObjectExplorerComponent.currentObjectType}'.</div>`;
        return;
      }

      // Collect all property keys across objects
      const sampleProps = objects[0].properties || {};
      const keys = Object.keys(sampleProps).filter(k => !k.startsWith('__'));

      container.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" onchange="ObjectExplorerComponent.toggleSelectAll(this.checked)"></th>
                <th>Primary Key</th>
                ${keys.map(k => `<th>${k}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${objects.map(o => `
                <tr>
                  <td><input type="checkbox" value="${o.__primaryKey}" ${ObjectExplorerComponent.selectedKeys.has(o.__primaryKey) ? 'checked' : ''} onchange="ObjectExplorerComponent.toggleSelect('${o.__primaryKey}', this.checked)"></td>
                  <td class="mono" style="color: var(--accent-cyan);">${o.__primaryKey}</td>
                  ${keys.map(k => {
                    const val = o.properties[k];
                    const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
                    return `<td class="mono">${displayVal}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (ObjectExplorerComponent.currentView === 'MAP') {
      const geoObjects = objects.filter(o => o.properties?.latitude || o.properties?.lat || o.properties?.location_geom);
      container.innerHTML = `
        <div style="padding: 1rem;">
          <h4 style="font-size: 0.9rem; color: var(--accent-cyan); mb-2"><i class="fa-solid fa-map-location-dot"></i> Object Spatial Plot (${geoObjects.length} Geocoded Objects)</h4>
          <div style="background: var(--bg-panel); border: 1px solid var(--border-color); padding: 1rem; border-radius: 6px; min-height: 250px;">
            ${geoObjects.length > 0 ? geoObjects.map(o => `
              <div style="border-bottom: 1px solid var(--border-color); padding: 0.5rem 0;" class="mono">
                <strong style="color: #fff;">${o.__primaryKey}</strong> - ${o.properties?.location_name || o.properties?.name || 'Location'} 
                <span style="color: var(--accent-emerald);">[Lat: ${o.properties?.latitude || '--'}, Lon: ${o.properties?.longitude || '--'}]</span>
              </div>
            `).join('') : '<p class="text-muted small">No direct coordinates found on selected objects. Default spatial grid mapped.</p>'}
          </div>
        </div>
      `;
    } else if (ObjectExplorerComponent.currentView === 'CHART') {
      const propToChart = Object.keys(objects[0]?.properties || {}).find(k => k === 'type' || k === 'evidence_status' || k === 'status' || k === 'observation_type') || 'status';
      const counts = {};
      objects.forEach(o => {
        const val = o.properties[propToChart] || 'Unspecified';
        counts[val] = (counts[val] || 0) + 1;
      });

      container.innerHTML = `
        <div style="padding: 1rem;">
          <h4 style="font-size: 0.9rem; color: var(--accent-amber); margin-bottom: 1rem;"><i class="fa-solid fa-chart-bar"></i> Aggregation by '${propToChart}'</h4>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${Object.keys(counts).map(key => `
              <div style="display: flex; align-items: center; gap: 1rem;">
                <span class="mono" style="width: 150px; font-size: 0.8rem; color: var(--text-muted);">${key}</span>
                <div style="flex: 1; background: var(--bg-panel); height: 24px; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color);">
                  <div style="width: ${Math.min(100, (counts[key] / objects.length) * 100)}%; background: var(--accent-cyan); height: 100%;"></div>
                </div>
                <span class="mono" style="font-size: 0.8rem; font-weight: bold; color: var(--accent-cyan);">${counts[key]}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  },

  toggleSelect: (pk, checked) => {
    if (checked) {
      ObjectExplorerComponent.selectedKeys.add(pk);
    } else {
      ObjectExplorerComponent.selectedKeys.delete(pk);
    }
  },

  toggleSelectAll: (checked) => {
    if (checked) {
      ObjectExplorerComponent.objects.forEach(o => ObjectExplorerComponent.selectedKeys.add(o.__primaryKey));
    } else {
      ObjectExplorerComponent.selectedKeys.clear();
    }
    ObjectExplorerComponent.renderView();
  },

  takeBulkAction: async () => {
    const selected = Array.from(ObjectExplorerComponent.selectedKeys);
    if (selected.length === 0) {
      alert('Please select at least one object from the table.');
      return;
    }

    const actionType = prompt('Enter Governed Action Type API Name (e.g. FLAG_SUBJECT, ADD_OBSERVATION):', 'FLAG_SUBJECT');
    if (!actionType) return;

    try {
      let count = 0;
      for (const pk of selected) {
        await API.post('/api/ontology/actions/execute', {
          actionType,
          input: { entityId: pk, reviewPriority: 'P1_HIGH', reason: 'Bulk Action executed via Object Explorer' }
        });
        count++;
      }
      alert(`Successfully executed action '${actionType}' on ${count} object(s).`);
      await ObjectExplorerComponent.loadObjects();
    } catch (err) {
      alert('Bulk action failed: ' + err.message);
    }
  },

  exportSet: () => {
    const objects = ObjectExplorerComponent.objects;
    if (objects.length === 0) {
      alert('No objects available to export.');
      return;
    }

    const jsonStr = JSON.stringify(objects, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ontology_${ObjectExplorerComponent.currentObjectType}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
};
