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

  async getLayout(folderName) {
    const r = await fetch(`${API}/api/themes/layout/${folderName}`);
    return r.json();
  },

  async activateTheme(folderName) {
    const r = await fetch(`${API}/api/themes/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_name: folderName }),
    });
    return r.json();
  },

  async deactivateTheme(folderName) {
    const r = await fetch(`${API}/api/themes/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_name: folderName }),
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

  async deleteTheme(folderName) {
    const r = await fetch(`${API}/api/themes/${folderName}`, { method: "DELETE" });
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
};

export const vibeDesignApi = {
  async generate(prompt) {
    const r = await fetch(`${API}/api/vibe-design/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    return r.json();
  },
};
