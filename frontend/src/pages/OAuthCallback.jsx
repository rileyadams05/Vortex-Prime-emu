import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = BACKEND_URL ? `${BACKEND_URL.replace(/\/$/, '')}/api` : '';
const PUBLIC_BASE = process.env.PUBLIC_URL || '';

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const handleCallback = async () => {
      // Check for Discord implicit token in hash
      const fullHash = window.location.hash;
      let accessToken = null;
        
        // Robust token extraction from hash (handles multiple hashes in HashRouter)
        // Check for error in hash (Implicit Grant)
        if (fullHash.includes('error=')) {
            const tokenPart = fullHash.split('#').find(p => p.includes('error='));
            if (tokenPart) {
                const params = new URLSearchParams(tokenPart);
                const error = params.get('error');
                const desc = params.get('error_description');
                const fullErr = desc ? `${error}: ${desc}` : error;
                if (window.opener) {
                    window.opener.postMessage({ type: 'DISCORD_AUTH_ERROR', error: fullErr }, window.location.origin);
                }
                setStatus(`Discord Error: ${fullErr}`);
                setTimeout(() => window.close(), 3000);
                return;
            }
        }

        // Robust token extraction from hash (handles multiple hashes in HashRouter)
        if (fullHash.includes('access_token=')) {
            const tokenPart = fullHash.split('#').find(p => p.includes('access_token='));
            if (tokenPart) {
                const params = new URLSearchParams(tokenPart);
                accessToken = params.get('access_token');
            }
        }
        
        if (accessToken) {
            try {
                // Fetch the user profile using the access token
                const response = await axios.get('https://discord.com/api/users/@me', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                
                const data = response.data;
                const profilePicture = data.avatar 
                    ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png` 
                    : `https://cdn.discordapp.com/embed/avatars/${parseInt(data.discriminator || '0') % 5}.png`;
                    
                const profile = {
                    name: data.global_name || data.username,
                    discordId: data.id,
                    profilePicture: profilePicture,
                    provider: 'discord',
                    accessToken: accessToken
                };

                // MISSION CRITICAL: Bridge the token to the local Rust listener if no opener exists
                if (!window.opener) {
                    console.log('🔄 Attempting loopback bridge to 127.0.0.1:8080...');
                    try {
                        const bridgeUrl = `http://127.0.0.1:8080/token?access_token=${accessToken}`;
                        await fetch(bridgeUrl, { mode: 'no-cors' });
                        console.log('✅ Bridge request sent to backend.');
                    } catch (e) {
                        console.error('❌ Loopback bridge failed:', e);
                    }
                }

                if (window.opener) {
                  window.opener.postMessage(
                    { type: 'DISCORD_AUTH_SUCCESS', profile },
                    window.location.origin
                  );
                  setStatus('Success! You can close this window.');
                  setTimeout(() => window.close(), 1000);
                } else {
                  // Fallback if not opened in a popup
                  localStorage.setItem('userProfile', JSON.stringify(profile));
                  setStatus('Authentication successful! Returning to app...');
                  setTimeout(() => {
                      window.location.href = `${window.location.origin}${PUBLIC_BASE}/`;
                  }, 1000);
                }
            } catch (err) {
                console.error('Discord API Error:', err);
                const errorMsg = err.response?.data?.message || err.message;
                if (window.opener) {
                    window.opener.postMessage({ type: 'DISCORD_AUTH_ERROR', error: errorMsg }, window.location.origin);
                }
                setStatus(`Discord API Error: ${errorMsg}`);
                setTimeout(() => window.close(), 3000);
            }
            return;
        }

      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        const desc = searchParams.get('error_description');
        const fullErr = desc ? `${error}: ${desc}` : error;
        if (window.opener) {
          window.opener.postMessage({ type: 'DISCORD_AUTH_ERROR', error: fullErr }, window.location.origin);
        }
        setStatus(`Authentication failed: ${fullErr}`);
        setTimeout(() => window.close(), 3000);
        return;
      }

      if (!code) {
        setStatus('No authorization code received');
        setTimeout(() => window.close(), 3000);
        return;
      }

      try {
        if (!API) {
          throw new Error('Backend unavailable for code exchange');
        }
        // Exchange code for profile data
        const response = await axios.post(`${API}/xbox/auth/callback`, { code });
        const profile = response.data;

        // Send profile data to parent window
        if (window.opener) {
          window.opener.postMessage(
            { type: 'XBOX_AUTH_SUCCESS', profile },
            window.location.origin
          );
          setStatus('Success! You can close this window.');
          setTimeout(() => window.close(), 1000);
        } else {
          setStatus('Authentication successful!');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('Failed to complete authentication');
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
      color: '#ffffff',
      fontFamily: 'Segoe UI, sans-serif',
      textAlign: 'center',
      padding: '20px'
    }}>
      <div>
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>🎮</div>
        <div style={{ fontSize: '18px' }}>{status}</div>
      </div>
    </div>
  );
};

export default OAuthCallback;
