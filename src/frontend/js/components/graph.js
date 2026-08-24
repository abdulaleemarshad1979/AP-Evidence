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
    this.canvas = document.getElementById('graph-canvas');
    if (!this.canvas) return;

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
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
  },

  async loadNetwork(centerId = null) {
    try {
      const endpoint = centerId ? `/graph/network?centerId=${centerId}` : '/graph/network';
      const data = await API.get(endpoint);

      // Assign initial circular / random coordinates
      const width = this.canvas.width;
      const height = this.canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      this.nodes = data.nodes.map((n, i) => {
        const angle = (i / data.nodes.length) * Math.PI * 2;
        const radius = 180 + Math.random() * 80;
        return {
          ...n,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
          radius: n.type === 'Person' ? 22 : 18
        };
      });

      this.edges = data.edges;
    } catch (err) {
      console.error('Failed to load graph network:', err);
    }
  },

  getNodeColor(type) {
    switch (type) {
      case 'Person': return '#00f0ff';
      case 'Vehicle': return '#f59e0b';
      case 'Telecom': return '#a855f7';
      case 'FinancialAccount': return '#10b981';
      case 'Location': return '#ef4444';
      default: return '#3b82f6';
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
    // Simple force-directed repulsion & attraction towards center
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    for (let i = 0; i < this.nodes.length; i++) {
      const n1 = this.nodes[i];
      if (n1 === this.draggedNode) continue;

      // Center gravity
      n1.vx += (cx - n1.x) * 0.0005;
      n1.vy += (cy - n1.y) * 0.0005;

      // Node repulsion
      for (let j = i + 1; j < this.nodes.length; j++) {
        const n2 = this.nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < 150) {
          const force = (150 - dist) / dist * 0.15;
          n1.vx -= dx * force;
          n1.vy -= dy * force;
          if (n2 !== this.draggedNode) {
            n2.vx += dx * force;
            n2.vy += dy * force;
          }
        }
      }

      // Update positions
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

        // Edge label
        const midX = (sourceNode.x + targetNode.x) / 2;
        const midY = (sourceNode.y + targetNode.y) / 2;
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '10px JetBrains Mono';
        this.ctx.fillText(e.type, midX, midY);
      }
    });

    // Draw Nodes
    this.nodes.forEach(n => {
      const color = this.getNodeColor(n.type);

      // Glow effect for selected
      if (n === this.selectedNode) {
        this.ctx.beginPath();
        this.ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
        this.ctx.fill();
      }

      // Outer Circle
      this.ctx.beginPath();
      this.ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#0d121f';
      this.ctx.fill();
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2.5;
      this.ctx.stroke();

      // Node Label
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '500 11px Inter';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(n.label, n.x, n.y + n.radius + 14);

      // Node ID
      this.ctx.fillStyle = '#64748b';
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

        // Open Subject 360 if Person
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

    const resetBtn = document.getElementById('btn-graph-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.loadNetwork());
    }
  }
};
