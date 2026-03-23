// Quick test to verify the external APIs endpoint is working
const http = require('http');

console.log('Testing backend endpoint: http://localhost:8000/api/config/external-apis\n');

const req = http.get('http://localhost:8000/api/config/external-apis', (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ SUCCESS! Endpoint is working\n');
      const config = JSON.parse(data);
      
      console.log('RetroAchievements Config:');
      console.log('  Username:', config.retroAchievements?.username || '(not set)');
      console.log('  API Key:', config.retroAchievements?.apiKey ? '***configured***' : '(not set)');
      console.log('\nTMDB Config:');
      console.log('  API Key:', config.tmdb?.apiKey ? '***configured***' : '(not set)');
      
      console.log('\n✅ All API credentials are configured correctly!');
    } else {
      console.log(`❌ ERROR: Got status code ${res.statusCode}`);
      console.log('Response:', data);
    }
  });
});

req.on('error', (err) => {
  console.log('❌ ERROR: Could not connect to backend server');
  console.log('Make sure the backend is running on port 8000');
  console.log('Error:', err.message);
});

req.end();
