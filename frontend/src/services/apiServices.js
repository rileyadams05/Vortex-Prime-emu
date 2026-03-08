const API = "/api";

export const themeApi = {
  async listThemes() {
    const r = await fetch(`${API}/themes`);
    return r.json();
  },

  async getActiveTheme() {
    const r = await fetch(`${API}/themes/active`);
    return r.json();
  },

  async getLayout(folderName) {
    const r = await fetch(`${API}/themes/layout/${folderName}`);
    return r.json();
  },

  async activateTheme(folderName) {
    const r = await fetch(`${API}/themes/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_name: folderName }),
    });
    return r.json();
  },

  async deactivateTheme(folderName) {
    const r = await fetch(`${API}/themes/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_name: folderName }),
    });
    return r.json();
  },

  async createTheme(data) {
    const r = await fetch(`${API}/themes/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return r.json();
  },

  async deleteTheme(folderName) {
    const r = await fetch(`${API}/themes/${folderName}`, { method: "DELETE" });
    return r.json();
  },
};

export const steamGridApi = {
  async searchGames(term) {
    const r = await fetch(`${API}/steamgriddb/search/${encodeURIComponent(term)}`);
    return r.json();
  },

  async getAssets(gameId) {
    const r = await fetch(`${API}/steamgriddb/assets/${gameId}`);
    return r.json();
  },
};

export const vibeDesignApi = {
  async generate(prompt) {
    const r = await fetch(`${API}/vibe-design/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    return r.json();
  },
};

export const coreConfigApi = {
  async get(gamePath = null) {
    let endpoint = `${API}/config/core`;
    if (gamePath) {
      endpoint = `${API}/config/game?path=${encodeURIComponent(gamePath)}`;
    }

    const r = await fetch(endpoint);
    if (!r.ok) {
      throw new Error("Failed to fetch Core Config");
    }
    return r.json();
  },

  async update(settings, gameId = null) {
    const endpoint = gameId ? `${API}/config/game` : `${API}/config/core`;
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
  },

  async browse() {
    const r = await fetch(`${API}/config/browse`);
    if (!r.ok) {
      throw new Error("Failed to open file browser");
    }
    return r.json();
  },

  async browseFolder() {
    const r = await fetch(`${API}/games/browse-folder`);
    if (!r.ok) {
      throw new Error("Failed to open folder browser");
    }
    return r.json();
  }
};

export const settingsApi = {
  async get() {
    const r = await fetch(`${API}/settings`);
    return r.json();
  },
  async update(settings) {
    const r = await fetch(`${API}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return r.json();
  }
};
