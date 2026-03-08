import axios from 'axios';
import { msalConfig } from '../authConfig';
import { PublicClientApplication } from '@azure/msal-browser';

const BACKEND_URL = '';
const msalInstance = new PublicClientApplication(msalConfig);

export const initializeMsal = async () => {
    await msalInstance.initialize();

    // Handle redirect promise to ensure no stuck states
    try {
        await msalInstance.handleRedirectPromise();
    } catch (e) {
        console.error("Handle Redirect Promise Error:", e);
    }
};

export const loginAndFetchProfile = async () => {
    try {
        // 1. MSAL Login
        // Try popup first
        let loginResponse;
        try {
            loginResponse = await msalInstance.loginPopup({
                scopes: ["XboxLive.signin", "User.Read"]
            });
        } catch (err) {
            // Check if popup was blocked
            if (err.errorCode === "popup_window_error" || err.message.includes("popup")) {
                console.warn("Popup blocked, falling back to redirect (or warning user)");
                throw new Error("Popup blocked. Please allow popups or use the desktop app.");
            }
            throw err;
        }

        const accessToken = loginResponse.accessToken;

        // 2. Exchange Token at Backend
        const response = await axios.post(`${BACKEND_URL}/api/xbox/auth/exchange`, {
            access_token: accessToken
        });

        return response.data;
    } catch (error) {
        console.error("Xbox Login Failed:", error);
        throw error;
    }
};

export const logout = () => {
    msalInstance.logoutPopup();
    localStorage.removeItem('xboxProfile');
};
