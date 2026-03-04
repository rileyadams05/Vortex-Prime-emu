const API = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

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

export const coreConfigApi = {
  async get(gamePath = null) {
    let endpoint = `${API}/api/config/core`;
    if (gamePath) {
        endpoint = `${API}/api/config/game?path=${encodeURIComponent(gamePath)}`;
    }
    
    const r = await fetch(endpoint);
    if (!r.ok) {
        throw new Error("Failed to fetch Core Config");
    }
    return r.json();
  },

  async update(settings, gameId = null) {
    const endpoint = gameId ? `${API}/api/config/game` : `${API}/api/config/core`;
    // gameId here can be a Title ID OR an absolute path
    const body = gameId ? { game_id: gameId, settings } : { settings };
    
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
        throw new Error("Core Config Update Failed");
    }
    return r.json();
  }
};
