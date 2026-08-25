const GraphComponent = {
  canvas: null,
  ctx: null,
  nodes: [],
  edges: [],
  selectedNode: null,
  draggedNode: null,
  isDragging: false,
  animFrame: null,

  async init() {
    const container = document.getElementById('graph-canvas-container');
    if (!container) return;

    let canvasElem = document.getElementById('graph-canvas');
    if (!canvasElem) {
      canvasElem = document.createElement('canvas');
      canvasElem.id = 'graph-canvas';
      canvasElem.style.width = '100%';
      canvasElem.style.height = '100%';
      container.appendChild(canvasElem);
    }

    this.canvas = canvasElem;
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    window.addEventListener('resize', () => this.resizeCanvas());

    await this.loadNetwork();
    this.setupInteractions();
    this.startLoop();
  },

  resizeCanvas() {
    const container = document.getElementById('graph-canvas-container');
    if (!container || !this.canvas) return;
    this.canvas.width = container.clientWidth || 800;
    this.canvas.height = container.clientHeight || 550;
  },

  async loadNetwork(centerId = '', maxHops = 2) {
    try {
      if (!centerId) {
        this.nodes = [];
        this.edges = [];
        const statsBadge = document.getElementById('graph-stats-badge');
        if (statsBadge) statsBadge.innerText = '0 Nodes • 0 Edges';
        return;
      }
      const endpoint = `/graph/network?centerId=${encodeURIComponent(centerId)}&maxHops=${maxHops}`;
      const data = await API.get(endpoint);

      const width = this.canvas.width || 800;
      const height = this.canvas.height || 550;
      const cx = width / 2;
      const cy = height / 2;

      this.nodes = (data.nodes || []).map((n, i) => {
        const angle = (i / (data.nodes.length || 1)) * Math.PI * 2;
        const radius = 180 + (i % 3) * 40;
        return {
          ...n,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
          radius: n.type === 'Person' ? 22 : 18
        };
      });

      this.edges = data.edges || [];

      const statsBadge = document.getElementById('graph-stats-badge');
      if (statsBadge) {
        statsBadge.innerText = `${this.nodes.length} Nodes • ${this.edges.length} Edges`;
      }

      this.renderCentralityTable();
    } catch (err) {
      console.error('Failed to load graph network:', err);
    }
  },

  renderCentralityTable() {
    const centralityList = document.getElementById('graph-centrality-list');
    if (!centralityList) return;

    centralityList.innerHTML = '';
    const sorted = [...this.nodes].sort((a, b) => (b.betweennessCentrality || 0) - (a.betweennessCentrality || 0));

    sorted.slice(0, 5).forEach(node => {
      const div = document.createElement('div');
      div.style.marginBottom = '0.3rem';
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.innerHTML = `
        <span style="color: var(--accent-cyan);">${API.escapeHTML(node.id)} (${API.escapeHTML(node.label)})</span>
        <span style="color: var(--accent-amber);">BC: ${node.betweennessCentrality || 0}</span>
      `;
      centralityList.appendChild(div);
    });
  },

  getNodeColor(type, isMasked) {
    if (isMasked) return '#64748B';
    switch (type) {
      case 'Person': return '#00F0FF';
      case 'Vehicle': return '#F59E0B';
      case 'Telecom': return '#8B5CF6';
      case 'FinancialAccount': return '#10B981';
      case 'Location': return '#EF4444';
      default: return '#0070F3';
    }
  },

  startLoop() {
    const render = () => {
      this.updatePhysics();
      this.draw();
      this.animFrame = requestAnimationFrame(render);
    };
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    render();
  },

  updatePhysics() {
    const cx = (this.canvas.width || 800) / 2;
    const cy = (this.canvas.height || 550) / 2;

    for (let i = 0; i < this.nodes.length; i++) {
      const n1 = this.nodes[i];
      if (n1 === this.draggedNode) continue;

      n1.vx += (cx - n1.x) * 0.0004;
      n1.vy += (cy - n1.y) * 0.0004;

      for (let j = i + 1; j < this.nodes.length; j++) {
        const n2 = this.nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < 160) {
          const force = (160 - dist) / dist * 0.15;
          n1.vx -= dx * force;
          n1.vy -= dy * force;
          if (n2 !== this.draggedNode) {
            n2.vx += dx * force;
            n2.vy += dy * force;
          }
        }
      }

      n1.x += n1.vx;
      n1.y += n1.vy;
      n1.vx *= 0.85;
      n1.vy *= 0.85;
    }
  },

  draw() {
    if (!this.ctx) return;
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.clearRect(0, 0, width, height);

    // Draw Edges
    this.edges.forEach(e => {
      const sourceNode = this.nodes.find(n => n.id === e.source);
      const targetNode = this.nodes.find(n => n.id === e.target);

      if (sourceNode && targetNode) {
        this.ctx.beginPath();
        this.ctx.moveTo(sourceNode.x, sourceNode.y);
        this.ctx.lineTo(targetNode.x, targetNode.y);
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        const midX = (sourceNode.x + targetNode.x) / 2;
        const midY = (sourceNode.y + targetNode.y) / 2;
        this.ctx.fillStyle = '#94A3B8';
        this.ctx.font = '10px JetBrains Mono';
        this.ctx.fillText(e.label || e.type, midX, midY);
      }
    });

    // Draw Nodes
    this.nodes.forEach(n => {
      const color = this.getNodeColor(n.type, n.isMasked);

      if (n === this.selectedNode) {
        this.ctx.beginPath();
        this.ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
        this.ctx.fill();
      }

      this.ctx.beginPath();
      this.ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#0F141C';
      this.ctx.fill();
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2.5;
      this.ctx.stroke();

      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '500 11px Inter';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(n.label, n.x, n.y + n.radius + 14);

      this.ctx.fillStyle = color;
      this.ctx.font = '10px JetBrains Mono';
      this.ctx.fillText(n.id, n.x, n.y + n.radius + 26);
    });
  },

  setupInteractions() {
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const hit = this.nodes.find(n => {
        const dx = n.x - mx;
        const dy = n.y - my;
        return Math.sqrt(dx * dx + dy * dy) <= n.radius;
      });

      if (hit) {
        this.selectedNode = hit;
        this.draggedNode = hit;
        this.isDragging = true;

        if (window.Subject360Component) {
          window.Subject360Component.loadSubjectProfile(hit.id);
        }
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging && this.draggedNode) {
        const rect = this.canvas.getBoundingClientRect();
        this.draggedNode.x = e.clientX - rect.left;
        this.draggedNode.y = e.clientY - rect.top;
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.draggedNode = null;
    });

    const centerSelect = document.getElementById('graph-center-select');
    const hopsSelect = document.getElementById('graph-hops-select');
    const pathBtn = document.getElementById('btn-run-shortest-path');

    if (centerSelect) {
      centerSelect.addEventListener('change', () => {
        this.loadNetwork(centerSelect.value, hopsSelect ? hopsSelect.value : 2);
      });
    }

    if (hopsSelect) {
      hopsSelect.addEventListener('change', () => {
        this.loadNetwork(centerSelect ? centerSelect.value : '', hopsSelect.value);
      });
    }

    if (pathBtn) {
      pathBtn.addEventListener('click', async () => {
        const startId = prompt('Enter Start Entity ID:') || '';
        const endId = prompt('Enter Target Entity ID:') || '';
        if (!startId || !endId) return;
        try {
          const res = await API.get(`/graph/shortest-path?startId=${encodeURIComponent(startId)}&endId=${encodeURIComponent(endId)}`);
          if (res.pathFound) {
            alert(`Shortest Path Found (Length ${res.path.length}): ${res.path.join(' ➔ ')}`);
          } else {
            alert('No path connecting the target entities in current graph scope.');
          }
        } catch (err) {
          alert('Shortest path error: ' + err.message);
        }
      });
    }
  }
};
