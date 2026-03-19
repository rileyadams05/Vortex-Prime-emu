import React, { useEffect, useRef } from 'react';
import '../styles/AnimatedBackground.css';

const AnimatedBackground = ({ backgroundImage }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const stars = [];
    const starCount = 300;
    
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2.5 + 0.5,
        opacity: Math.random(),
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleDirection: Math.random() > 0.5 ? 1 : -1
      });
    }

    const portals = [
      { x: 0.5, y: 0.5, size: 180, speed: 0.3, reverse: false },
      { x: 0.18, y: 0.15, size: 100, speed: 0.4, reverse: true },
      { x: 0.82, y: 0.15, size: 100, speed: 0.35, reverse: false },
      { x: 0.18, y: 0.85, size: 100, speed: 0.38, reverse: false },
      { x: 0.82, y: 0.85, size: 100, speed: 0.42, reverse: true }
    ];

    let rotation = 0;

    const drawPortal = (x, y, size, angle, reverse) => {
      const centerX = x * canvas.width;
      const centerY = y * canvas.height;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(reverse ? -angle : angle);

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
      gradient.addColorStop(0, 'rgba(0, 255, 200, 0.4)');
      gradient.addColorStop(0.3, 'rgba(0, 217, 255, 0.3)');
      gradient.addColorStop(0.6, 'rgba(0, 150, 200, 0.2)');
      gradient.addColorStop(1, 'rgba(0, 100, 150, 0)');

      for (let i = 0; i < 8; i++) {
        const spiralAngle = (Math.PI * 2 / 8) * i;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        
        for (let r = 0; r < size; r += 5) {
          const angle = spiralAngle + (r / size) * Math.PI * 2;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          ctx.lineTo(x, y);
        }
        
        ctx.strokeStyle = `rgba(0, ${200 + Math.sin(spiralAngle) * 55}, 255, ${0.3 - (i * 0.03)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.restore();
    };

    const drawNebula = () => {
      const nebulaRegions = [
        { x: 0.3, y: 0.3, size: 200, color: 'rgba(100, 0, 150, 0.15)' },
        { x: 0.7, y: 0.4, size: 250, color: 'rgba(0, 100, 200, 0.15)' },
        { x: 0.5, y: 0.7, size: 180, color: 'rgba(150, 0, 200, 0.12)' }
      ];

      nebulaRegions.forEach(region => {
        const gradient = ctx.createRadialGradient(
          region.x * canvas.width, region.y * canvas.height, 0,
          region.x * canvas.width, region.y * canvas.height, region.size
        );
        gradient.addColorStop(0, region.color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      });
    };

    const drawCenterLogo = () => {
      const centerX = canvas.width * 0.5;
      const centerY = canvas.height * 0.5;
      const radius = Math.min(canvas.width, canvas.height) * 0.25;

      ctx.save();
      
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - (i * 15), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, ${200 + i * 20}, 255, ${0.6 - i * 0.15})`;
        ctx.lineWidth = 8 - i * 2;
        ctx.stroke();
      }

      ctx.font = `bold ${radius * 0.35}px Arial`;
      ctx.fillStyle = 'rgba(100, 255, 200, 0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.fillText('VORTEX', centerX, centerY - radius * 0.15);
      
      ctx.font = `bold ${radius * 0.3}px Arial`;
      ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
      ctx.fillText('PRIME', centerX, centerY + radius * 0.15);
      
      ctx.font = `${radius * 0.12}px Arial`;
      ctx.fillStyle = 'rgba(150, 255, 200, 0.8)';
      ctx.fillText('EMULATOR', centerX, centerY + radius * 0.4);

      ctx.restore();
    };

    const drawCornerLogo = () => {
      const x = canvas.width * 0.92;
      const y = canvas.height * 0.88;
      const size = Math.min(canvas.width, canvas.height) * 0.08;

      ctx.save();
      
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 220, 255, 0.7)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = `bold ${size * 0.4}px Arial`;
      ctx.fillStyle = 'rgba(100, 255, 200, 0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VP', x, y - size * 0.1);
      
      ctx.font = `${size * 0.2}px Arial`;
      ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
      ctx.fillText('PRIME', x, y + size * 0.25);

      ctx.restore();
    };

    const animate = () => {
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawNebula();

      stars.forEach(star => {
        star.opacity += star.twinkleSpeed * star.twinkleDirection;
        if (star.opacity >= 1 || star.opacity <= 0.2) {
          star.twinkleDirection *= -1;
        }

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();

        if (star.size > 1.5) {
          ctx.shadowBlur = 4;
          ctx.shadowColor = `rgba(255, 255, 255, ${star.opacity})`;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      rotation += 0.005;
      portals.forEach(portal => {
        drawPortal(portal.x, portal.y, portal.size, rotation * portal.speed, portal.reverse);
      });

      drawCenterLogo();
      drawCornerLogo();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="animated-background-container">
      <canvas ref={canvasRef} className="background-canvas" />
    </div>
  );
};

export default AnimatedBackground;
