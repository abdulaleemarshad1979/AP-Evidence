const API = {
  activeUserId: 'USR-101',
  activeToken: 'TOKEN-USR-101-INIT',

  setUserId(id) {
    this.activeUserId = id;
    this.activeToken = `TOKEN-${id}-${Date.now()}`;
  },

  // Safe HTML Escaping Helper to eliminate Stored-XSS risks
  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  async get(endpoint) {
    try {
      const res = await fetch(`/api${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${this.activeToken}`,
          'X-User-Id': this.activeUserId
        }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: `HTTP Error ${res.status}` }));
        throw new Error(errJson.message || errJson.error || `HTTP Error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`API GET error on ${endpoint}:`, err);
      throw err;
    }
  },

  async post(endpoint, data) {
    try {
      const res = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.activeToken}`,
          'X-User-Id': this.activeUserId
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: `HTTP Error ${res.status}` }));
        throw new Error(errJson.message || errJson.error || `HTTP Error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`API POST error on ${endpoint}:`, err);
      throw err;
    }
  }
};
