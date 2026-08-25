const Subject360Component = {
  activeSubjectId: '',

  async init() {
    if (this.activeSubjectId) {
      await this.loadSubjectProfile(this.activeSubjectId);
    } else {
      this.renderEmptyState();
    }
    this.bindEvents();
  },

  renderEmptyState() {
    const nameElem = document.getElementById('subject-name');
    const idElem = document.getElementById('subject-id');
    if (nameElem) nameElem.innerText = 'No Subject Selected';
    if (idElem) idElem.innerText = 'Search or select an operational entity';
  },

  async loadSubjectProfile(subjectId) {
    if (!subjectId) {
      this.renderEmptyState();
      return;
    }
    this.activeSubjectId = subjectId;
    const nameElem = document.getElementById('subject-name');
    const idElem = document.getElementById('subject-id');
    const photoElem = document.getElementById('subject-photo');
    const aliasesElem = document.getElementById('subject-aliases');
    const phoneElem = document.getElementById('subject-phone');
    const vehicleElem = document.getElementById('subject-vehicle');
    const riskElem = document.getElementById('subject-risk-score');
    const maskingWarning = document.getElementById('data-masking-warning');
    const clearanceTag = document.getElementById('subject-clearance-tag');
    const tbody = document.getElementById('subject-timeline-tbody');
    const anomaliesList = document.getElementById('subject-anomalies-list');
    const colocationsList = document.getElementById('subject-colocations-list');
    const obsCountBadge = document.getElementById('obs-count-badge');

    if (!nameElem) return;

    try {
      const data = await API.get(`/subject360/${subjectId}`);
      const s = data.subject;

      nameElem.innerText = s.name;
      idElem.innerText = s.canonicalId || s.id;

      if (s.metadata && s.metadata.photoUrl) {
        photoElem.src = s.metadata.photoUrl;
      }

      if (s.isMasked) {
        maskingWarning.style.display = 'block';
        maskingWarning.innerHTML = `<i class="fa-solid fa-lock" style="margin-right: 0.4rem;"></i><strong>Need-To-Know Data Masked:</strong> ${API.escapeHTML(s.metadata?.clearanceNotice || 'Clearance Level 3 required.')}`;
      } else {
        maskingWarning.style.display = 'none';
      }

      clearanceTag.innerText = `Clearance Level ${s.metadata?.clearanceRequired || 3} Required`;
      aliasesElem.innerText = (s.aliases || []).join(', ');
      phoneElem.innerText = s.identifierFields?.primaryPhone || 'N/A';
      vehicleElem.innerText = s.identifierFields?.registeredVehicles?.[0] || 'None Registered';
      riskElem.innerText = `${s.metadata?.riskScore || 85} / 100`;

      // Timeline Events Table
      tbody.innerHTML = '';
      obsCountBadge.innerText = `${data.timeline ? data.timeline.length : 0} Verified Events`;

      (data.timeline || []).forEach(ev => {
        const tr = document.createElement('tr');
        const raw = ev.rawData || {};
        const isAnomaly = Boolean(raw.isAnomaly);

        tr.innerHTML = `
          <td class="mono" style="font-size: 0.78rem;">${API.escapeHTML(new Date(ev.timestamp).toUTCString())}</td>
          <td><span class="badge-status badge-high">${API.escapeHTML(raw.sourceLabel || ev.eventType)}</span></td>
          <td>${API.escapeHTML(ev.locationName)} <br><small class="mono" style="color: var(--accent-cyan);">(${ev.latitude}, ${ev.longitude})</small></td>
          <td class="mono" style="${isAnomaly ? 'color: var(--accent-crimson); font-weight: bold;' : ''}">${raw.speedKmh ? raw.speedKmh + ' km/h' : 'Stationary'}</td>
          <td class="mono" style="color: var(--accent-emerald);">${Math.round(ev.confidence * 100)}%</td>
          <td>${isAnomaly ? `<span class="badge-status badge-critical">PATH ANOMALY</span>` : `<span class="badge-status badge-low">NORMAL</span>`}</td>
          <td class="mono"><span style="color: var(--accent-cyan); font-size: 0.75rem;">${API.escapeHTML(ev.evidenceRef)}</span></td>
        `;
        tbody.appendChild(tr);
      });

      // Anomalies List
      anomaliesList.innerHTML = '';
      if (data.anomalies && data.anomalies.length > 0) {
        data.anomalies.forEach(anom => {
          const div = document.createElement('div');
          div.style.marginBottom = '0.4rem';
          div.innerHTML = `<span style="color: var(--accent-crimson);">●</span> <strong>${API.escapeHTML(anom.location)}:</strong> ${API.escapeHTML(anom.anomalyReason)}`;
          anomaliesList.appendChild(div);
        });
      } else {
        anomaliesList.innerHTML = `<span style="color: var(--accent-emerald);">● No spatio-temporal velocity anomalies detected.</span>`;
      }

      // Co-Locations List
      colocationsList.innerHTML = '';
      if (data.coLocations && data.coLocations.length > 0) {
        data.coLocations.forEach(col => {
          const div = document.createElement('div');
          div.style.marginBottom = '0.4rem';
          div.innerHTML = `<span style="color: var(--accent-amber);">●</span> <strong>${API.escapeHTML(col.locationName)}:</strong> Converged with <code>${API.escapeHTML(col.subjects[1])}</code> within ${col.distanceMeters}m (${col.timeDiffMinutes} min window)`;
          colocationsList.appendChild(div);
        });
      } else {
        colocationsList.innerHTML = `<span style="color: var(--text-muted);">No spatial convergences recorded.</span>`;
      }

    } catch (err) {
      console.error('Error loading Subject 360 profile:', err);
    }
  },

  bindEvents() {
    const briefBtn = document.getElementById('btn-generate-aip-brief');
    if (briefBtn) {
      briefBtn.addEventListener('click', () => {
        const tabBtn = document.querySelector('.nav-tab[data-tab="aip"]');
        if (tabBtn) tabBtn.click();
        const aipInput = document.getElementById('aip-entity-input');
        if (aipInput) aipInput.value = this.activeSubjectId;
        const execBtn = document.getElementById('btn-execute-aip-run');
        if (execBtn) execBtn.click();
      });
    }
  }
};
