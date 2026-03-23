import React, { useState, useEffect } from 'react';

// Including the CSS themes directly
import '../styles/themes/ps5-theme.css';
import '../styles/themes/xbox-theme.css';
import '../styles/themes/steam-theme.css';

export default function AchievementToast() {
  const [activeAchievement, setActiveAchievement] = useState(null);

  useEffect(() => {
    // This hooks into our Universal Achievement Listener
    const handleAchievementSignal = (event) => {
      const payload = event.detail;
      console.log('Achievement signal received:', payload);
      setActiveAchievement(payload);
      
      // Auto-hide the achievement after the SAN CSS animation ends (e.g., 6 seconds)
      setTimeout(() => {
        setActiveAchievement((current) => {
          // Only clear if it's the same achievement ID
          if (current && current.id === payload.id) {
            return null;
          }
          return current;
        });
      }, 6500);
    };

    // Attach to the global UI event system
    window.addEventListener('achievementPop', handleAchievementSignal);

    // Provide a simple function on the window to test this easily via Console:
    // Try typing this in the JS console:
    // window.testAchievement('ps5')
    window.testAchievement = (skin = 'ps5') => {
      const e = new CustomEvent('achievementPop', {
        detail: {
          id: Date.now(),
          title: "Vortex Prime Unleashed",
          description: "This is a test achievement for your " + skin.toUpperCase() + " style!",
          iconUrl: "https://cdn-icons-png.flaticon.com/512/3112/3112946.png", // Example trophy icon
          targetSkin: skin,
          rarity: "platinum"
        }
      });
      window.dispatchEvent(e);
      return "Fired " + skin + " logic!";
    };

    return () => {
      window.removeEventListener('achievementPop', handleAchievementSignal);
    };
  }, []);

  // The 'targetSkin' dynamically switches the CSS class namespace to map EXACTLY to SAN theme parameters
  const skinClass = activeAchievement ? `san-theme-${activeAchievement.targetSkin}` : '';

  return (
    <>
      {activeAchievement && (
        <div className={`san-achievement-container ${skinClass}`}>
          {/* Container referencing SAN class layout logic */}
          <div className="san-popup-wrapper">
            <div className="san-icon-container">
              <img src={activeAchievement.iconUrl} alt="Trophy" className="san-trophy-icon" />
            </div>
            
            <div className="san-text-body">
              <div className="san-title">{activeAchievement.title}</div>
              <div className="san-desc">{activeAchievement.description}</div>
            </div>
            
            {/* Dynamic flair based on rarity (PS Platinum/Gold/Silver, Xbox Diamonds) */}
            {activeAchievement.targetSkin === 'ps5' && activeAchievement.rarity && (
              <div className={`san-rarity-flare ps5-${activeAchievement.rarity.toLowerCase()}`} />
            )}
          </div>
        </div>
      )}


    </>
  );
}
