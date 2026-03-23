const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

const configuredBase =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  '';

const normalizedConfiguredBase = configuredBase
  ? configuredBase.replace(/\/$/, '')
  : '';

export const API_BASE = normalizedConfiguredBase
  ? (normalizedConfiguredBase.endsWith('/api')
      ? normalizedConfiguredBase
      : `${normalizedConfiguredBase}/api`)
  : (isLocalhost ? '/api' : '');

export const HAS_BACKEND = Boolean(API_BASE);

const withApi = (path) => `${API_BASE}${path}`;

const fetchJson = async (path, options = {}, fallback = null) => {
  if (!HAS_BACKEND) return fallback;
  try {
    const r = await fetch(withApi(path), options);
    if (!r.ok) return fallback;
    return r.json().catch(() => fallback);
  } catch {
    return fallback;
  }
};

console.log(
  `[Vortex Bridge] API mode: ${HAS_BACKEND ? API_BASE : 'hosted (no backend configured)'}`
);

export const themeApi = {
  async listThemes() {
    return fetchJson('/themes', {}, []);
  },

  async getActiveTheme() {
    return fetchJson('/themes/active', {}, null);
  },

  async getLayout(folderName) {
    return fetchJson(`/themes/layout/${folderName}`, {}, null);
  },

  async activateTheme(folderName) {
    if (!HAS_BACKEND) return { success: false, message: 'Backend unavailable' };
    const r = await fetch(withApi('/themes/activate'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_name: folderName }),
    });
    return r.json();
  },

  async deactivateTheme(folderName) {
    if (!HAS_BACKEND) return { success: false, message: 'Backend unavailable' };
    const r = await fetch(withApi('/themes/deactivate'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_name: folderName }),
    });
    return r.json();
  },

  async createTheme(data) {
    if (!HAS_BACKEND) return { success: false, message: 'Backend unavailable' };
    const r = await fetch(withApi('/themes/create'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return r.json();
  },

  async deleteTheme(folderName) {
    if (!HAS_BACKEND) return { success: false, message: 'Backend unavailable' };
    const r = await fetch(withApi(`/themes/${folderName}`), { method: "DELETE" });
    return r.json();
  },
};

export const steamGridApi = {
  async searchGames(term) {
    return fetchJson(`/steamgriddb/search/${encodeURIComponent(term)}`, {}, { results: [] });
  },

  async getAssets(gameId) {
    return fetchJson(`/steamgriddb/assets/${gameId}`, {}, {});
  },
};

export const vibeDesignApi = {
  async generate(prompt) {
    if (!HAS_BACKEND) return { success: false, message: 'Backend unavailable' };
    const r = await fetch(withApi('/vibe-design/generate'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    return r.json();
  },
};

export const coreConfigApi = {
  async get(gamePath = null) {
    if (!HAS_BACKEND) return null;
    let endpoint = withApi('/config/core');
    if (gamePath) {
      endpoint = withApi(`/config/game?path=${encodeURIComponent(gamePath)}`);
    }

    const r = await fetch(endpoint);
    if (!r.ok) {
      throw new Error("Failed to fetch Core Config");
    }
    return r.json();
  },

  async update(settings, gameId = null) {
    if (!HAS_BACKEND) {
      throw new Error('Backend unavailable');
    }
    const endpoint = gameId ? withApi('/config/game') : withApi('/config/core');
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
    if (!HAS_BACKEND) {
      throw new Error('Backend unavailable');
    }
    const r = await fetch(withApi('/config/browse'));
    if (!r.ok) {
      throw new Error("Failed to open file browser");
    }
    return r.json();
  },

  async browseFolder() {
    if (!HAS_BACKEND) {
      throw new Error('Backend unavailable');
    }
    const r = await fetch(withApi('/games/browse-folder'));
    if (!r.ok) {
      throw new Error("Failed to open folder browser");
    }
    return r.json();
  }
};

export const settingsApi = {
  async get() {
    return fetchJson('/settings', {}, {});
  },
  async update(settings) {
    if (!HAS_BACKEND) return { success: false, message: 'Backend unavailable' };
    const r = await fetch(withApi('/settings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return r.json();
  },
  async browseImage() {
    if (!HAS_BACKEND) {
      throw new Error('Backend unavailable');
    }
    const r = await fetch(withApi('/settings/browse-image'));
    if (!r.ok) throw new Error('Failed to open image browser');
    return r.json();
  }
};

export const externalApiConfig = {
  async get() {
    if (!HAS_BACKEND) {
      return {};
    }
    const r = await fetch(withApi('/config/external-apis'));
    if (!r.ok) {
      throw new Error("Failed to fetch external API configuration");
    }
    return r.json();
  }
};

export const supportApi = {
  async uploadScreenshot({ file, video, category = 'bug', summary = '', dashboardUser = 'anonymous' }) {
    if (!file) {
      throw new Error('Screenshot file is required');
    }

    const formData = new FormData();
    formData.append('screenshot', file);
    if (video) {
      formData.append('video', video);
    }
    formData.append('category', category);
    formData.append('summary', summary);
    formData.append('dashboard_user', dashboardUser);

    if (!HAS_BACKEND) {
      throw new Error('Backend unavailable');
    }

    const r = await fetch(withApi('/support/screenshots'), {
      method: 'POST',
      body: formData,
    });

    if (!r.ok) {
      const error = await r.json().catch(() => ({}));
      throw new Error(error.detail || 'Screenshot upload failed');
    }

    return r.json();
  },
};
