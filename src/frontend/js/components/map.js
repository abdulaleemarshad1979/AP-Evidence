const MapComponent = {
  map: null,
  markers: [],
  trajectoryLine: null,
  events: [],
  isPlaying: false,
  scrubberIndex: 0,
  playbackInterval: null,

  async init() {
    const container = document.getElementById('leaflet-map-container');
    if (!container || this.map) return;

    // Initialize Leaflet Map centered on Europe / Middle East
    this.map = L.map('leaflet-map-container').setView([51.5074, -0.1478], 5);

    // Dark Map Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    await this.loadTrajectory();
    this.bindEvents();
  },

  async loadTrajectory() {
    try {
      const data = await API.get('/geospatial/trajectory');
      this.events = data.events;

      this.renderMapPoints();
    } catch (err) {
      console.error('Failed to load geospatial trajectory:', err);
    }
  },

  renderMapPoints(maxIndex = this.events.length) {
    if (!this.map) return;

    // Clear existing markers & lines
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];
    if (this.trajectoryLine) this.map.removeLayer(this.trajectoryLine);

    const activeEvents = this.events.slice(0, maxIndex);
    const latLngs = [];

    activeEvents.forEach((ev, idx) => {
      const lat = ev.latitude;
      const lng = ev.longitude;
      latLngs.push([lat, lng]);

      // Custom Glowing Cyan Marker Icon
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="
          width: 14px; 
          height: 14px; 
          background: #00f0ff; 
          border: 2px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 0 12px #00f0ff;
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(this.map);
      marker.bindPopup(`
        <div style="font-family: var(--font-sans); color: #07090e; font-size: 0.85rem;">
          <strong style="color: #00f0ff;">${ev.eventType}</strong><br>
          <b>${ev.locationName}</b><br>
          <small>${new Date(ev.timestamp).toLocaleString()}</small><br>
          <p style="margin-top: 0.4rem; font-size: 0.8rem;">${ev.description}</p>
        </div>
      `);

      this.markers.push(marker);

      // Update scrubber time readout
      const timeDisplay = document.getElementById('scrubber-time-display');
      if (timeDisplay && idx === activeEvents.length - 1) {
        timeDisplay.innerText = new Date(ev.timestamp).toUTCString();
      }
    });

    // Draw trajectory vector polyline
    if (latLngs.length > 1) {
      this.trajectoryLine = L.polyline(latLngs, {
        color: '#00f0ff',
        weight: 3,
        opacity: 0.8,
        dashArray: '6, 8'
      }).addTo(this.map);

      // Fit map bounds to trajectory
      this.map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50] });
    }
  },

  bindEvents() {
    const playBtn = document.getElementById('btn-play-timeline');
    const slider = document.getElementById('timeline-slider');

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
          playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
          this.startPlayback();
        } else {
          playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
          this.stopPlayback();
        }
      });
    }

    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        const index = Math.ceil((val / 100) * this.events.length);
        this.renderMapPoints(index);
      });
    }
  },

  startPlayback() {
    this.playbackInterval = setInterval(() => {
      this.scrubberIndex = (this.scrubberIndex + 1) % (this.events.length + 1);
      if (this.scrubberIndex === 0) this.scrubberIndex = 1;

      const slider = document.getElementById('timeline-slider');
      if (slider) {
        slider.value = Math.round((this.scrubberIndex / this.events.length) * 100);
      }

      this.renderMapPoints(this.scrubberIndex);
    }, 1500);
  },

  stopPlayback() {
    if (this.playbackInterval) clearInterval(this.playbackInterval);
  }
};
