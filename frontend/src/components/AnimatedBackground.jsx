import React from 'react';
import '../styles/AnimatedBackground.css';

const AnimatedBackground = ({ backgroundImage }) => {
  return (
    <div className="animated-background-container">
      <div className="background-layer" />
    </div>
  );
};

export default AnimatedBackground;
