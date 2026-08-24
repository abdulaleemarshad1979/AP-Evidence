const Subject360Component = {
  activeSubjectId: 'PER-88219',

  async init() {
    await this.loadSubjectProfile(this.activeSubjectId);
    this.bindEvents();
  },

  async loadSubjectProfile(id) {
    this.activeSubjectId = id;
    const detailsContainer = document.getElementById('subj-profile-details');
    const eventsTable = document.getElementById('subj-events-table');
    const linksTable = document.getElementById('subj-links-table');

    if (!detailsContainer) return;

    try {
      const data = await API.get(`/subject360/${id}`);
      const s = data.subject;

      // Render Main Details Card
      detailsContainer.innerHTML = `
        <div style="font-size: 1.2rem; font-weight: 700; color: #ffffff;">${s.name}</div>
        <div class="mono" style="color: var(--accent-cyan);">${s.id} | ${s.type}</div>
        <div><strong>Aliases:</strong> ${(s.aliases || []).join(', ') || 'None'}</div>
        <div><strong>Primary Phone:</strong> <span class="mono">${s.primaryPhone || 'N/A'}</span></div>
        <div><strong>Passport:</strong> <span class="mono">${s.passportNo || 'N/A'}</span></div>
        <div><strong>DOB / Nationality:</strong> ${s.dob || 'N/A'} (${s.nationality || 'N/A'})</div>
        <div><strong>Primary Location:</strong> ${s.primaryLocation || 'N/A'}</div>
        <div><strong>Classification:</strong> <span class="clearance-badge">${s.classification}</span></div>
        <div style="background: var(--bg-panel); padding: 0.6rem; border-radius: 4px; border: 1px solid var(--border-color); margin-top: 0.5rem;">
          <strong style="color: var(--text-muted);">ANALYST NOTES:</strong><br>${s.notes || 'No analyst notes.'}
        </div>
      `;

      document.getElementById('subj-risk-badge').innerText = `RISK INDEX: ${s.riskScore || 50}`;

      // Render Event Timeline
      eventsTable.innerHTML = '';
      (data.events || []).forEach(ev => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="mono">${new Date(ev.timestamp).toLocaleString()}</td>
          <td><span class="badge-status badge-high">${ev.eventType}</span></td>
          <td>${ev.locationName}</td>
          <td><span class="mono">${Math.round((ev.confidence || 0.9) * 100)}%</span></td>
          <td class="mono" style="color: var(--accent-cyan); font-size: 0.75rem;">${ev.evidenceRef || 'N/A'}</td>
        `;
        eventsTable.appendChild(tr);
      });

      // Render Linked Network Entities
      linksTable.innerHTML = '';
      (data.relationships || []).forEach(rel => {
        const otherId = rel.source === id ? rel.target : rel.source;
        const otherEntity = (data.linkedEntities || []).find(e => e.id === otherId);

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="mono" style="color: var(--accent-cyan); cursor: pointer;" onclick="Subject360Component.loadSubjectProfile('${otherId}')">${otherId}</td>
          <td><strong>${otherEntity ? otherEntity.name : otherId}</strong></td>
          <td><span class="badge-status badge-low">${otherEntity ? otherEntity.type : 'Unknown'}</span></td>
          <td>${rel.type}</td>
          <td class="mono">${Math.round((rel.confidence || 0.85) * 100)}%</td>
        `;
        linksTable.appendChild(tr);
      });

    } catch (err) {
      detailsContainer.innerHTML = `<div style="color: var(--accent-crimson);">Failed to load profile for ${id}: ${err.message}</div>`;
    }
  },

  bindEvents() {
    const searchBtn = document.getElementById('btn-search-subject');
    const searchInput = document.getElementById('subject-search-input');

    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        if (!query) return;

        try {
          const res = await API.get(`/subject360/search?query=${encodeURIComponent(query)}`);
          if (res.entities && res.entities.length > 0) {
            await this.loadSubjectProfile(res.entities[0].id);
          } else {
            alert('No entity target found matching query: ' + query);
          }
        } catch (err) {
          alert('Search error: ' + err.message);
        }
      });
    }
  }
};
