import axios from 'axios';
import { discordAuthConfig } from '../authConfig';

import { invoke } from '@tauri-apps/api/core';

export const loginDiscord = async () => {
    try {
        // Use the new secondary loopback flow to bypass popup blockers
        const profile = await invoke('start_discord_auth');
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
