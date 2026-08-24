const Subject360Component = {
  activeSubjectId: 'SUB-00001',

  async init() {
    await this.loadSubjectProfile(this.activeSubjectId);
    this.bindEvents();
  },

  async loadSubjectProfile(subjectId) {
    const mainDetails = document.getElementById('subj-profile-details');
    const eventsTable = document.getElementById('subj-events-table');
    const linksTable = document.getElementById('subj-links-table');
    if (!mainDetails) return;

    try {
      const data = await API.get(`/subject360/${subjectId}`);
      const s = data.subject;

      this.activeSubjectId = s.id;

      // Header card sanitized using API.escapeHTML
      mainDetails.innerHTML = `
        <div><strong style="color: var(--accent-cyan); font-size: 1.1rem;">${API.escapeHTML(s.name)}</strong></div>
        <div class="mono" style="color: var(--text-muted);">ID: ${API.escapeHTML(s.id)} | Type: ${API.escapeHTML(s.type)}</div>
        <div><strong>Evidence Status:</strong> <span class="badge-status badge-low">${API.escapeHTML(s.evidenceStatus)}</span></div>
        <div><strong>Assertion Class:</strong> <span class="badge-status badge-high">${API.escapeHTML(s.assertionClass)}</span></div>
        <div><strong>Confidence Method:</strong> <code>${API.escapeHTML(s.confidenceMethod)}</code></div>
        <div><strong>Human Review Status:</strong> <span class="badge-status badge-low">${API.escapeHTML(s.humanReviewStatus)}</span></div>
        <div><strong>Review Priority:</strong> <span class="badge-status badge-critical">${API.escapeHTML(s.reviewPriority)}</span></div>
        <div><strong>Synthetic Label:</strong> <span style="color: var(--accent-amber);">SYNTHETIC TRAINING DATA</span></div>
        <div><strong>Aliases:</strong> ${API.escapeHTML((s.aliases || []).join(', '))}</div>
        <div><strong>Identifier Attributes:</strong> <pre class="mono" style="font-size:0.75rem; background:var(--bg-panel); padding:0.4rem;">${API.escapeHTML(JSON.stringify(s.identifierFields, null, 2))}</pre></div>
      `;

      // Events / Observations
      eventsTable.innerHTML = '';
      data.events.forEach(ev => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="mono" style="font-size: 0.8rem;">${API.escapeHTML(new Date(ev.timestamp).toUTCString())}</td>
          <td><span class="badge-status badge-high">${API.escapeHTML(ev.eventType)}</span></td>
          <td>${API.escapeHTML(ev.locationName)} <br><small class="mono">(${API.escapeHTML(ev.latitude)}, ${API.escapeHTML(ev.longitude)})</small></td>
          <td><span class="mono">${Math.round(ev.confidence * 100)}%</span></td>
          <td><span class="badge-status badge-low">${API.escapeHTML(ev.evidenceStatus)}</span></td>
        `;
        eventsTable.appendChild(tr);
      });

      // Linked Entities
      linksTable.innerHTML = '';
      data.relationships.forEach(rel => {
        const linkedId = rel.source === s.id ? rel.target : rel.source;
        const linkedObj = data.linkedEntities.find(le => le.id === linkedId) || { name: linkedId, type: 'Entity' };

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="mono" style="color: var(--accent-cyan);">${API.escapeHTML(linkedId)}</td>
          <td><strong>${API.escapeHTML(linkedObj.name)}</strong></td>
          <td><span class="mono">${API.escapeHTML(linkedObj.type)}</span></td>
          <td><span class="badge-status badge-low">${API.escapeHTML(rel.type)}</span></td>
          <td><span class="badge-status badge-high">${API.escapeHTML(rel.assertionClass || 'CORRELATED')}</span></td>
        `;
        linksTable.appendChild(tr);
      });

    } catch (err) {
      mainDetails.innerHTML = `<div style="color: var(--accent-crimson);">${API.escapeHTML(err.message)}</div>`;
    }
  },

  bindEvents() {
    const searchBtn = document.getElementById('btn-search-subject');
    const searchInput = document.getElementById('subject-search-input');

    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', async () => {
        const q = searchInput.value.trim();
        if (!q) return;
        try {
          const res = await API.get(`/subject360/search?query=${encodeURIComponent(q)}`);
          if (res.entities && res.entities.length > 0) {
            await this.loadSubjectProfile(res.entities[0].id);
          } else {
            alert(`No synthetic entity matching query: ${q}`);
          }
        } catch (err) {
          alert('Search error: ' + err.message);
        }
      });
    }
  }
};
