import React from 'react';
import '../styles/AnimatedBackground.css';

const AnimatedBackground = ({ backgroundImage }) => {
  return (
    <div className="animated-background-container">
      <div 
        className="background-layer" 
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
    </div>
  );
};

export default AnimatedBackground;
