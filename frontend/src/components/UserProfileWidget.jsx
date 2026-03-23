import React from 'react';

const UserProfileWidget = ({ username, avatarUrl, isLoggedIn, onLogin, onLogout, dropzoneRootProps, dropzoneInputProps }) => {
  return (
    <div 
      className="user-profile" 
      {...dropzoneRootProps}
      style={{ cursor: 'default', zIndex: 9999, position: 'relative', pointerEvents: 'auto' }}
    >
      <input {...dropzoneInputProps} />
      {isLoggedIn ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '14px' }}>
          <span className="gamertag" style={{ 
            fontSize: '1.1rem', 
            fontWeight: '700', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            color: 'white',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
          }}>
            {username || 'Loading...'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
             <svg viewBox="0 0 24 24" fill="#9ECE6A" width="14" height="14" style={{ filter: 'drop-shadow(0 0 2px rgba(158, 206, 106, 0.5))' }}>
               <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
             </svg>
             <span style={{ 
               fontSize: '12px', 
               fontWeight: '800', 
               color: '#9ECE6A', 
               fontFamily: 'monospace' 
             }}>
               --
             </span>
             <span style={{ 
               fontSize: '9px', 
               fontWeight: '600', 
               color: 'rgba(255,255,255,0.4)', 
               textTransform: 'uppercase',
               letterSpacing: '1px'
             }}>
               G
             </span>
          </div>
        </div>
      ) : (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onLogin();
          }}
          className="gamertag" 
          style={{ 
            background: 'rgba(255,255,255,0.15)', 
            padding: '6px 18px', 
            borderRadius: '20px', 
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            pointerEvents: 'auto',
            marginRight: '12px'
          }}
        >
          <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2758-3.68-.2758-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1971.3728.2914a.077.077 0 01-.0066.1277 12.2986 12.2986 0 01-1.8732.8923.076.076 0 00-.0416.1057c.3604.698.7719 1.3628 1.226 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
          </svg>
          Log in
        </button>
      )}

      <div className="user-avatar-circle" style={{ position: 'relative' }}>
        {isLoggedIn && avatarUrl ? (
          <>
            <img src={avatarUrl} alt="Avatar" className="avatar-img" />
            <div style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              width: '14px',
              height: '14px',
              background: '#5865F2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #1a1a1a'
            }}>
              <svg viewBox="0 0 24 24" fill="white" width="10" height="10">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2758-3.68-.2758-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1971.3728.2914a.077.077 0 01-.0066.1277 12.2986 12.2986 0 01-1.8732.8923.076.076 0 00-.0416.1057c.3604.698.7719 1.3628 1.226 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
              </svg>
            </div>
          </>
        ) : (
          <div className="user-avatar-placeholder-silhouette" style={{
            width: '100%', 
            height: '100%', 
            borderRadius: '50%', 
            background: 'rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Icon removed per request */}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileWidget;
