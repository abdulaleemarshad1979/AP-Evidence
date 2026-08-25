const MapComponent = {
  map: null,
  markers: [],
  trajectoryLine: null,
  waypoints: [],
  isPlaying: false,
  scrubberIndex: 0,
  playbackInterval: null,

  async init() {
    const container = document.getElementById('leaflet-map-container');
    if (!container || this.map) return;

    // Initialize Leaflet Map centered on Andhra Pradesh corridor (Vijayawada)
    this.map = L.map('leaflet-map-container').setView([16.5062, 80.6480], 9);

    // Dark Map Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    await this.loadTrajectory();
    this.bindEvents();
  },

  async loadTrajectory(entityId) {
    try {
      const targetId = entityId || window.Subject360Component?.activeSubjectId || '';
      if (!targetId) {
        this.waypoints = [];
        this.renderMapPoints(0);
        return;
      }
      const data = await API.get(`/geospatial/trajectory?entity_id=${encodeURIComponent(targetId)}`);
      this.waypoints = data.waypoints || [];
      this.renderMapPoints(this.waypoints.length);
    } catch (err) {
      console.error('Failed to load geospatial trajectory:', err);
    }
  },

  renderMapPoints(maxIndex = this.waypoints.length) {
    if (!this.map) return;

    // Clear existing markers & lines
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];
    if (this.trajectoryLine) this.map.removeLayer(this.trajectoryLine);

    const activeWaypoints = this.waypoints.slice(0, maxIndex);
    const latLngs = [];

    activeWaypoints.forEach((ev, idx) => {
      const lat = parseFloat(ev.latitude);
      const lng = parseFloat(ev.longitude);
      latLngs.push([lat, lng]);

      // Pulsing Neon Marker Icon
      const isLatest = idx === activeWaypoints.length - 1;
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="
          width: ${isLatest ? '18px' : '12px'}; 
          height: ${isLatest ? '18px' : '12px'}; 
          background: ${isLatest ? '#00F0FF' : '#0070F3'}; 
          border: 2px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 0 ${isLatest ? '16px #00F0FF' : '8px #0070F3'};
        " class="${isLatest ? 'radar-pulse-ring' : ''}"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(this.map);
      marker.bindPopup(`
        <div style="font-family: var(--font-sans); color: #080B10; font-size: 0.85rem; padding: 0.2rem;">
          <strong style="color: #0070F3;">${API.escapeHTML(ev.location_name)}</strong><br>
          <small class="mono">${new Date(ev.timestamp).toUTCString()}</small><br>
          <div style="margin-top: 0.4rem; font-size: 0.78rem;">
            <span>Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}</span><br>
            <span>Confidence Score: ${Math.round(ev.confidence_score * 100)}%</span>
          </div>
        </div>
      `);

      this.markers.push(marker);

      // Update scrubber time readout
      const timeDisplay = document.getElementById('scrubber-timestamp-display');
      if (timeDisplay && idx === activeWaypoints.length - 1) {
        timeDisplay.innerText = new Date(ev.timestamp).toUTCString();
      }
    });

    // Draw trajectory polyline vector
    if (latLngs.length > 1) {
      this.trajectoryLine = L.polyline(latLngs, {
        color: '#00F0FF',
        weight: 3,
        opacity: 0.95,
        dashArray: '8, 8'
      }).addTo(this.map);

      this.map.fitBounds(L.latLngBounds(latLngs), { padding: [60, 60] });
    }
  },

  bindEvents() {
    const playBtn = document.getElementById('btn-chrono-play');
    const prevBtn = document.getElementById('btn-chrono-step-prev');
    const nextBtn = document.getElementById('btn-chrono-step-next');
    const slider = document.getElementById('chrono-slider');
    const centerVja = document.getElementById('btn-center-vijayawada');
    const centerVsk = document.getElementById('btn-center-visakhapatnam');

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
          playBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
          this.startPlayback();
        } else {
          playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Play';
          this.stopPlayback();
        }
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.scrubberIndex = Math.max(1, this.scrubberIndex - 1);
        this.updateSlider();
        this.renderMapPoints(this.scrubberIndex);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.scrubberIndex = Math.min(this.waypoints.length, this.scrubberIndex + 1);
        this.updateSlider();
        this.renderMapPoints(this.scrubberIndex);
      });
    }

    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.scrubberIndex = Math.max(1, Math.ceil((val / 100) * this.waypoints.length));
        this.renderMapPoints(this.scrubberIndex);
      });
    }

    if (centerVja && this.map) {
      centerVja.addEventListener('click', () => {
        this.map.setView([16.5062, 80.6480], 12);
      });
    }

    if (centerVsk && this.map) {
      centerVsk.addEventListener('click', () => {
        this.map.setView([17.6868, 83.2185], 12);
      });
    }
  },

  updateSlider() {
    const slider = document.getElementById('chrono-slider');
    if (slider && this.waypoints.length > 0) {
      slider.value = Math.round((this.scrubberIndex / this.waypoints.length) * 100);
    }
  },

  startPlayback() {
    this.playbackInterval = setInterval(() => {
      this.scrubberIndex = (this.scrubberIndex % this.waypoints.length) + 1;
      this.updateSlider();
      this.renderMapPoints(this.scrubberIndex);
    }, 1800);
  },

  stopPlayback() {
    if (this.playbackInterval) clearInterval(this.playbackInterval);
  }
};
