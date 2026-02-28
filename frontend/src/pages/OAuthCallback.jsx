import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        setStatus(`Authentication failed: ${error}`);
        setTimeout(() => window.close(), 3000);
        return;
      }

      if (!code) {
        setStatus('No authorization code received');
        setTimeout(() => window.close(), 3000);
        return;
      }

      try {
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