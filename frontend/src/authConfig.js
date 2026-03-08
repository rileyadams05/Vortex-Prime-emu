export const msalConfig = {
    auth: {
        clientId: "8a444c9b-2c07-46f7-916f-e3089c615371",
        authority: "https://login.microsoftonline.com/consumers", // Personal accounts
        redirectUri: "http://localhost:3005/", // Must match Azure App Registration
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
    },
};

export const loginRequest = {
    scopes: ["XboxLive.signin", "User.Read"]
};
