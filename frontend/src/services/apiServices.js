const API = process.env.REACT_APP_BACKEND_URL;

export const themeApi = {
  async listThemes() {
    const r = await fetch(`${API}/api/themes`);
    return r.json();
  },

  async getActiveTheme() {
    const r = await fetch(`${API}/api/themes/active`);
    return r.json();
  },

  async activateTheme(filename) {
    const r = await fetch(`${API}/api/themes/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    });
    return r.json();
  },

  async deactivateTheme(filename) {
    const r = await fetch(`${API}/api/themes/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    });
    return r.json();
  },

  async createTheme(data) {
    const r = await fetch(`${API}/api/themes/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return r.json();
  },

  async deleteTheme(filename) {
    const r = await fetch(`${API}/api/themes/${filename}`, { method: "DELETE" });
    return r.json();
  },
};

export const steamGridApi = {
  async searchGames(term) {
    const r = await fetch(`${API}/api/steamgriddb/search/${encodeURIComponent(term)}`);
    return r.json();
  },

  async getAssets(gameId) {
    const r = await fetch(`${API}/api/steamgriddb/assets/${gameId}`);
    return r.json();
  },

  async getGrids(gameId, limit = 10) {
    const r = await fetch(`${API}/api/steamgriddb/grids/${gameId}?limit=${limit}`);
    return r.json();
  },

  async getHeroes(gameId, limit = 10) {
    const r = await fetch(`${API}/api/steamgriddb/heroes/${gameId}?limit=${limit}`);
    return r.json();
  },

  async getLogos(gameId, limit = 10) {
    const r = await fetch(`${API}/api/steamgriddb/logos/${gameId}?limit=${limit}`);
    return r.json();
  },
};
