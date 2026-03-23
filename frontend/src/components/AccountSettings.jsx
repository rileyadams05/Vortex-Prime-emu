import React from 'react';
import { User, LogOut, Shield, Mail, Key } from 'lucide-react';
import playSound from '../utils/soundManager';

const AccountSettings = ({ userProfile, isLoggedIn, onLogout, isActive, onBack }) => {
  if (!isActive) return null;

  return (
    <div className="account-settings-panel animate-scale-in" style={{ padding: '0px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {isLoggedIn ? (
          <>
            {/* Discord HeaderCard */}
            <div style={{ 
              background: 'linear-gradient(135deg, #5865F2 0%, #313338 100%)',
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              position: 'relative',
              overflow: 'hidden'
            }}>
               <div style={{
                 position: 'absolute',
                 top: '-20px',
                 right: '-20px',
                 opacity: 0.1,
                 transform: 'rotate(-15deg)'
               }}>
                 <svg viewBox="0 0 24 24" fill="white" width="120" height="120">
                   <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2758-3.68-.2758-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1971.3728.2914a.077.077 0 01-.0066.1277 12.2986 12.2986 0 01-1.8732.8923.076.076 0 00-.0416.1057c.3604.698.7719 1.3628 1.226 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
                 </svg>
               </div>

               <div style={{ position: 'relative' }}>
                 <img 
                   src={userProfile?.profilePicture} 
                   alt="Avatar" 
                   style={{ 
                     width: '96px', 
                     height: '96px', 
                     borderRadius: '50%', 
                     border: '4px solid white',
                     boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                   }} 
                 />
                 <div style={{
                   position: 'absolute',
                   bottom: '0',
                   right: '0',
                   background: '#23a559',
                   width: '24px',
                   height: '24px',
                   borderRadius: '50%',
                   border: '4px solid #313338'
                 }}></div>
               </div>

               <div style={{ flex: 1 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <span style={{ fontSize: '28px', fontWeight: '800', color: 'white' }}>{userProfile?.name}</span>
                   <span style={{ 
                     padding: '2px 8px', 
                     background: 'rgba(255,255,255,0.1)', 
                     borderRadius: '4px', 
                     fontSize: '10px', 
                     color: 'white',
                     textTransform: 'uppercase',
                     letterSpacing: '1px',
                     fontWeight: '700'
                   }}>Verified</span>
                 </div>
                 <div style={{ 
                    marginTop: '8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '14px'
                 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                     <Shield size={14} />
                     <span>Discord Integrated</span>
                   </div>
                   <div style={{ width: '4px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }}></div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                     <Mail size={14} />
                     <span>{userProfile?.email || 'Authenticated'}</span>
                   </div>
                 </div>
               </div>
            </div>

            {/* Account Management Group */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <h4 style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1.5px', marginBottom: '8px', paddingLeft: '4px' }}>Account Privacy & Security</h4>
               
               <div className="account-action-item" style={{ 
                 display: 'flex', 
                 alignItems: 'center', 
                 justifyContent: 'space-between',
                 background: 'rgba(255,255,255,0.03)',
                 padding: '16px 20px',
                 borderRadius: '8px',
                 border: '1px solid rgba(255,255,255,0.05)'
               }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                   <div style={{ background: 'rgba(88, 101, 242, 0.1)', padding: '10px', borderRadius: '8px' }}>
                     <Key size={20} color="#5865F2" />
                   </div>
                   <div>
                     <div style={{ color: '#fff', fontWeight: '600' }}>Authentication Token</div>
                     <div style={{ color: '#888', fontSize: '12px' }}>Vortex Prime Secure Handshake Active</div>
                   </div>
                 </div>
                 <span style={{ color: '#23a559', fontSize: '11px', fontWeight: '800', background: 'rgba(35, 165, 89, 0.1)', padding: '4px 10px', borderRadius: '4px' }}>SECURE</span>
               </div>

               <button 
                onClick={() => { playSound('back'); onLogout(); }}
                className="logout-button-nxe"
                style={{ 
                  marginTop: '10px',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '12px',
                  background: 'rgba(255, 67, 67, 0.1)',
                  color: '#ff4343',
                  border: '1px solid rgba(255, 67, 67, 0.2)',
                  padding: '18px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '700',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  width: '100%',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}
               >
                 <LogOut size={20} />
                 Log out of Vortex Prime
               </button>
               <p style={{ textAlign: 'center', fontSize: '12px', color: '#666', marginTop: '4px' }}>
                 Logging out will remove your profile data from the local storage.
               </p>
            </div>
          </>
        ) : (
          <div style={{ 
            height: '400px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            textAlign: 'center',
            padding: '40px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '16px',
            border: '2px dashed rgba(255,255,255,0.05)'
          }}>
            <User size={64} color="rgba(255,255,255,0.1)" style={{ marginBottom: '24px' }} />
            <h3 style={{ color: '#fff', marginBottom: '12px' }}>Not Logged In</h3>
            <p style={{ color: '#888', fontSize: '14px', maxWidth: '300px', lineHeight: '1.6' }}>
              You are currently using the dashboard in guest mode. Log in with Discord at the home screen to enable account settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSettings;
