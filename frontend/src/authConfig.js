const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

const redirectUri = isLocalhost
    ? `${window.location.origin}/`
    : "https://vortex-prime-emu.com/dashboard/";

export const discordAuthConfig = {
    clientId: "1481235544993431554",
    redirectUri,
    scopes: ["identify", "email"]
};
