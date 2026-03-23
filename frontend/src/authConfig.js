const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

const redirectUri = isLocalhost
    ? "http://localhost:3005/#/oauth/callback"
    : "https://vortex-prime-emu.com/dashboard/#/oauth/callback";

export const discordAuthConfig = {
    clientId: "1481235544993431554",
    redirectUri,
    scopes: ["identify", "email"]
};
