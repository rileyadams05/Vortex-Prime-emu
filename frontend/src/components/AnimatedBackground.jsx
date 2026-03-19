import React, { useEffect, useRef } from 'react';
import '../styles/AnimatedBackground.css';

const AnimatedBackground = ({ backgroundImage }) => {
  const starsLayerRef = useRef(null);

  useEffect(() => {
    if (starsLayerRef.current) {
      const starsLayer = starsLayerRef.current;
      starsLayer.innerHTML = '';

      const starCount = 150;
      const twinkleClasses = ['star-twinkle-1', 'star-twinkle-2', 'star-twinkle-3', 'star-twinkle-4'];
      const sizeClasses = ['star-small', 'star-medium', 'star-large'];

      for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        
        const sizeClass = sizeClasses[Math.floor(Math.random() * sizeClasses.length)];
        star.classList.add(sizeClass);
        
        if (Math.random() > 0.5) {
          const twinkleClass = twinkleClasses[Math.floor(Math.random() * twinkleClasses.length)];
          star.classList.add(twinkleClass);
        }
        
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        
        starsLayer.appendChild(star);
      }
    }
  }, []);

  return (
    <div className="animated-background-container">
      <div 
        className="background-layer" 
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      
      <div className="stars-layer" ref={starsLayerRef}></div>
      
      <div className="portal-overlay">
        <div className="portal portal-center">
          <div className="portal-inner"></div>
        </div>
        <div className="portal portal-top-left">
          <div className="portal-inner"></div>
        </div>
        <div className="portal portal-top-right">
          <div className="portal-inner"></div>
        </div>
        <div className="portal portal-bottom-left">
          <div className="portal-inner"></div>
        </div>
        <div className="portal portal-bottom-right">
          <div className="portal-inner"></div>
        </div>
      </div>
      
      <div className="energy-particles">
        <div className="particle particle-1"></div>
        <div className="particle particle-2"></div>
        <div className="particle particle-3"></div>
        <div className="particle particle-4"></div>
        <div className="particle particle-5"></div>
      </div>
      
      <div className="dark-overlay"></div>
    </div>
  );
};

export default AnimatedBackground;
