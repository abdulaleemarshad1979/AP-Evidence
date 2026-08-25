/**
 * Palantir Dossier Living Reports Component
 * Analyst report editor where inserted objects retain live links back to Ontology sources.
 */
const DossierComponent = {
  currentDossierId: null,
  sections: [],
  linkedObjectRefs: [],
  resolvedObjects: {},

  init: async () => {
    await DossierComponent.loadDossiers();
  },

  loadDossiers: async () => {
    const select = document.getElementById('dossier-report-select');
    if (!select) return;

    try {
      const res = await API.get('/api/dossier/reports');
      if (res && res.dossiers && res.dossiers.length > 0) {
        select.innerHTML = res.dossiers.map(d => `<option value="${d.id}">${d.title} (${d.status})</option>`).join('');
        await DossierComponent.loadDossierById(res.dossiers[0].id);
      } else {
        select.innerHTML = `<option value="">No Saved Living Dossiers</option>`;
      }
    } catch (err) {
      console.warn('Failed to load dossiers:', err.message);
    }
  },

  loadDossierById: async (dossierId) => {
    if (!dossierId) return;
    try {
      const res = await API.get(`/api/dossier/reports/${dossierId}`);
      if (res && res.dossier) {
        const d = res.dossier;
        DossierComponent.currentDossierId = d.id;
        DossierComponent.sections = d.sections || [];
        DossierComponent.linkedObjectRefs = d.linkedObjectRefs || [];
        DossierComponent.resolvedObjects = d.resolvedObjects || {};

        const titleInput = document.getElementById('dossier-title-input');
        const summaryInput = document.getElementById('dossier-summary-input');
        if (titleInput) titleInput.value = d.title;
        if (summaryInput) summaryInput.value = d.summary || '';

        DossierComponent.render();
      }
    } catch (err) {
      console.error('Failed to load dossier by ID:', err.message);
    }
  },

  addSection: () => {
    const heading = prompt('Enter Section Heading:', 'Analytical Findings');
    if (!heading) return;

    DossierComponent.sections.push({
      id: `SEC-${Date.now()}`,
      heading,
      notes: 'Write notes and reference live Ontology objects below...'
    });
    DossierComponent.render();
  },

  linkObject: () => {
    const refId = prompt('Enter Ontology Object Primary Key to link dynamically by reference (e.g. SUB-00001, EVI-001):', 'SUB-00001');
    if (!refId) return;

    if (!DossierComponent.linkedObjectRefs.includes(refId)) {
      DossierComponent.linkedObjectRefs.push(refId);
    }
    DossierComponent.render();
  },

  saveDossier: async () => {
    const titleInput = document.getElementById('dossier-title-input');
    const summaryInput = document.getElementById('dossier-summary-input');
    const title = titleInput?.value || 'Living Intelligence Dossier';
    const summary = summaryInput?.value || '';

    try {
      const res = await API.post('/api/dossier/reports', {
        id: DossierComponent.currentDossierId || undefined,
        caseId: 'CASE-AP-2026-0001',
        title,
        summary,
        sections: DossierComponent.sections,
        linkedObjectRefs: DossierComponent.linkedObjectRefs,
        status: 'PUBLISHED'
      });

      if (res && res.dossier) {
        DossierComponent.currentDossierId = res.dossier.id;
        alert('Living Intelligence Dossier saved successfully!');
        await DossierComponent.loadDossiers();
      }
    } catch (err) {
      alert('Save dossier failed: ' + err.message);
    }
  },

  exportReport: () => {
    const title = document.getElementById('dossier-title-input')?.value || 'Living Dossier Report';
    let docContent = `# ${title}\n\n`;
    docContent += `**Summary:** ${document.getElementById('dossier-summary-input')?.value || ''}\n\n`;
    docContent += `---\n\n## Live Referenced Ontology Objects\n`;

    DossierComponent.linkedObjectRefs.forEach(refId => {
      const liveObj = DossierComponent.resolvedObjects[refId];
      docContent += `- **Ref: ${refId}**\n`;
      if (liveObj) {
        docContent += `  - Object Type: ${liveObj.__type || liveObj.type}\n`;
        docContent += `  - Live Properties: ${JSON.stringify(liveObj.properties || liveObj)}\n`;
      }
    });

    docContent += `\n---\n\n## Report Sections\n`;
    DossierComponent.sections.forEach(sec => {
      docContent += `### ${sec.heading}\n${sec.notes}\n\n`;
    });

    const blob = new Blob([docContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dossier_${title.toLowerCase().replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  },

  render: () => {
    const container = document.getElementById('dossier-sections-container');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <!-- Live Referenced Objects Panel -->
        <div style="background: var(--bg-panel); border: 1px solid var(--accent-cyan); padding: 1rem; border-radius: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong style="font-size: 0.85rem; color: var(--accent-cyan);"><i class="fa-solid fa-link"></i> Live Dynamic Referenced Ontology Objects</strong>
            <button class="btn btn-sm btn-primary" onclick="DossierComponent.linkObject()"><i class="fa-solid fa-plus"></i> Link Object by Reference</button>
          </div>
          ${DossierComponent.linkedObjectRefs.length === 0 ? `
            <p class="mono text-muted small mb-0">No objects linked by reference yet. Click "+ Link Object by Reference".</p>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 0.5rem;" class="mono">
              ${DossierComponent.linkedObjectRefs.map(refId => {
                const liveObj = DossierComponent.resolvedObjects[refId];
                return `
                  <div style="background: #05080E; border: 1px solid var(--border-color); padding: 0.5rem; border-radius: 4px; font-size: 0.78rem;">
                    <div style="display: flex; justify-content: space-between;">
                      <span style="color: var(--accent-cyan); font-weight: bold;">[LIVE SOURCE LINK] Key: ${refId}</span>
                      <span class="badge-status badge-low">UPDATES AUTOMATICALLY</span>
                    </div>
                    <div style="margin-top: 0.3rem; color: var(--text-bright);">
                      ${liveObj ? `Type: ${liveObj.__type || liveObj.type} | Name/Title: ${liveObj.name || liveObj.title || liveObj.properties?.name || 'N/A'} | Status: ${liveObj.status || liveObj.properties?.status || 'N/A'}` : 'Resolving live properties from Ontology Engine...'}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Sections Editor -->
        ${DossierComponent.sections.map((sec, idx) => `
          <div style="background: var(--bg-panel); border: 1px solid var(--border-color); padding: 1rem; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <strong style="font-size: 0.85rem; color: #fff;">${sec.heading}</strong>
              <button class="btn btn-sm" onclick="DossierComponent.sections.splice(${idx}, 1); DossierComponent.render();" style="color: var(--accent-crimson);">&times;</button>
            </div>
            <textarea class="form-textarea mono" style="width: 100%; height: 80px; font-size: 0.8rem;" onchange="DossierComponent.sections[${idx}].notes = this.value">${sec.notes}</textarea>
          </div>
        `).join('')}
      </div>
    `;
  }
};
