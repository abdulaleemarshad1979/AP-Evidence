const API = {
  activeToken: typeof localStorage !== 'undefined' ? (localStorage.getItem('jwt_token') || '') : '',
  activeCaseId: typeof localStorage !== 'undefined' ? (localStorage.getItem('active_case_id') || 'CASE-SYN-0001') : 'CASE-SYN-0001',

  setToken(token) {
    this.activeToken = token;
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem('jwt_token', token);
      } else {
        localStorage.removeItem('jwt_token');
      }
    }
  },

  setCaseId(caseId) {
    this.activeCaseId = caseId;
    if (typeof localStorage !== 'undefined') {
      if (caseId) {
        localStorage.setItem('active_case_id', caseId);
      }
    }
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
      const headers = {};
      if (this.activeToken) {
        headers['Authorization'] = `Bearer ${this.activeToken}`;
      }
      if (this.activeCaseId) {
        headers['X-Case-ID'] = this.activeCaseId;
      }
      const res = await fetch(`/api${endpoint}`, { headers });
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
      const headers = { 'Content-Type': 'application/json' };
      if (this.activeToken) {
        headers['Authorization'] = `Bearer ${this.activeToken}`;
      }
      if (this.activeCaseId) {
        headers['X-Case-ID'] = this.activeCaseId;
      }
      const res = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers,
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}
