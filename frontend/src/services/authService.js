import { discordAuthConfig } from '../authConfig';

const isDesktopWrapper = () =>
    navigator.userAgent.includes('Electron') ||
    !!window.process?.versions?.electron;

const buildDiscordAuthorizeUrl = () => {
    const params = new URLSearchParams({
        client_id: discordAuthConfig.clientId,
        redirect_uri: discordAuthConfig.redirectUri,
        response_type: 'token',
        scope: discordAuthConfig.scopes.join(' '),
        prompt: 'consent',
    });

    return `https://discord.com/oauth2/authorize?${params.toString()}`;
};

const loginViaPopup = () => {
    const authUrl = buildDiscordAuthorizeUrl();
    const popup = window.open(
        authUrl,
        'discord_oauth',
        'width=700,height=860,menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes'
    );

    if (!popup) {
        if (isDesktopWrapper()) {
            throw new Error('Discord popup was blocked. Please allow popups and try again.');
        }
        window.location.href = authUrl;
        return Promise.resolve(null);
    }

    popup.focus();

    return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            window.removeEventListener('message', onMessage);
            reject(new Error('Discord login timed out'));
        }, 120000);

        const onMessage = (event) => {
            if (event.origin !== window.location.origin) return;

            if (event.data?.type === 'DISCORD_AUTH_SUCCESS') {
                window.clearTimeout(timeout);
                window.removeEventListener('message', onMessage);
                resolve(event.data.profile);
                return;
            }

            if (event.data?.type === 'DISCORD_AUTH_ERROR') {
                window.clearTimeout(timeout);
                window.removeEventListener('message', onMessage);
                reject(new Error(event.data.error || 'Discord authentication failed'));
            }
        };

        window.addEventListener('message', onMessage);
    });
};

export const loginDiscord = async () => {
    try {
        // Hosted web mode: use OAuth popup flow
        if (!window.__TAURI__) {
            return loginViaPopup();
        }

        // Desktop mode: use Tauri invoke
        let invokeFn;
        try {
            const tauriCore = await import('@tauri-apps/api/core');
            invokeFn = tauriCore.invoke;
        } catch (e) {
            invokeFn = window.__TAURI__?.core?.invoke || window.__TAURI__?.tauri?.invoke;
        }

        if (!invokeFn) {
            throw new Error("Tauri invoke function not found. Are you running in the desktop app?");
        }

        const profile = await invokeFn('start_discord_auth');
        return profile;
    } catch (error) {
        console.error('Discord Auth Error:', error);
        throw new Error(error.toString() || "Discord Authentication failed");
    }
};

export const logout = () => {
    localStorage.removeItem('userProfile');
    window.location.reload();
};
