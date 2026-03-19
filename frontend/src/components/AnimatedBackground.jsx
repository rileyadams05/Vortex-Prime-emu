import React, { useEffect, useRef } from 'react';
import '../styles/AnimatedBackground.css';

const AnimatedBackground = ({ backgroundImage }) => {
  const starsRef = useRef(null);

  useEffect(() => {
    if (starsRef.current) {
      const container = starsRef.current;
      container.innerHTML = '';
      
      const starCount = 200;
      const sizes = ['star-tiny', 'star-small', 'star-medium', 'star-large'];
      const weights = [0.5, 0.3, 0.15, 0.05];
      
      for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        
        const rand = Math.random();
        let sizeClass;
        if (rand < weights[0]) sizeClass = sizes[0];
        else if (rand < weights[0] + weights[1]) sizeClass = sizes[1];
        else if (rand < weights[0] + weights[1] + weights[2]) sizeClass = sizes[2];
        else sizeClass = sizes[3];
        
        star.classList.add(sizeClass);
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.animationDelay = `${Math.random() * 3}s`;
        
        container.appendChild(star);
      }
    }
  }, []);

  return (
    <div className="animated-background-container">
      <div 
        className="background-layer" 
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      
      <div className="portal-effects">
        <div className="portal-spin portal-center"></div>
        <div className="portal-spin portal-top-left"></div>
        <div className="portal-spin portal-top-right"></div>
        <div className="portal-spin portal-bottom-left"></div>
        <div className="portal-spin portal-bottom-right"></div>
      </div>
      
      <div className="stars-overlay" ref={starsRef}></div>
    </div>
  );
};

export default AnimatedBackground;
