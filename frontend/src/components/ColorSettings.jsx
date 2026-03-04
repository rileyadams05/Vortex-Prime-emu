import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Check } from 'lucide-react';

const colors = [
  { name: 'Xbox Green', primary: '#91C300', secondary: '#5F8200', accent: '#4CAF50', gradient: 'linear-gradient(135deg, #91C300 0%, #5F8200 100%)' },
  { name: 'Red', primary: '#E74C3C', secondary: '#C0392B', accent: '#E74C3C', gradient: 'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)' },
  { name: 'Blue', primary: '#3498DB', secondary: '#2980B9', accent: '#3498DB', gradient: 'linear-gradient(135deg, #3498DB 0%, #2980B9 100%)' },
  { name: 'Purple', primary: '#9B59B6', secondary: '#8E44AD', accent: '#9B59B6', gradient: 'linear-gradient(135deg, #9B59B6 0%, #8E44AD 100%)' },
  { name: 'Orange', primary: '#E67E22', secondary: '#D35400', accent: '#E67E22', gradient: 'linear-gradient(135deg, #E67E22 0%, #D35400 100%)' },
  { name: 'Teal', primary: '#1ABC9C', secondary: '#16A085', accent: '#1ABC9C', gradient: 'linear-gradient(135deg, #1ABC9C 0%, #16A085 100%)' },
];

const ColorSettings = ({ isActive, onBack }) => {
  const { themeColor, changeTheme } = useTheme();

  if (!isActive) return null;

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ fontSize: '24px', marginBottom: '10px', color: '#fff' }}>Theme Color</h2>
      <p style={{ color: '#aaa', marginBottom: '30px' }}>Select an accent color for the dashboard interface.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '20px' }}>
        {colors.map((color) => (
          <div 
            key={color.name}
            onClick={() => changeTheme(color)}
            style={{
              background: '#222',
              borderRadius: '8px',
              padding: '15px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              border: themeColor.name === color.name ? `2px solid ${color.primary}` : '2px solid transparent',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: color.gradient,
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
            }}>
              {themeColor.name === color.name && <Check color="#fff" size={32} />}
            </div>
            <span style={{ color: '#fff', fontWeight: '600' }}>{color.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColorSettings;
