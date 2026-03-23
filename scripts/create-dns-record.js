/**
 * Cloudflare DNS Record Creator
 * 
 * Usage: node scripts/create-dns-record.js <API_TOKEN> <IP_ADDRESS>
 */

const https = require('https');

const DOMAIN = 'vortex-prime-emu.com';
const SUBDOMAIN = 'discord';
const API_TOKEN = process.argv[2];
const IP_ADDRESS = process.argv[3];

if (!API_TOKEN || !IP_ADDRESS) {
  console.error('Usage: node scripts/create-dns-record.js <API_TOKEN> <IP_ADDRESS>');
  process.exit(1);
}

const apiRequest = (path, method = 'GET', body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400 || !json.success) {
            reject(json);
          } else {
            resolve(json.result);
          }
        } catch (e) {
          reject(new Error('Failed to parse API response'));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

async function run() {
  try {
    console.log(`Connecting to Cloudflare API...`);
    
    // 1. Get Zone ID
    const zones = await apiRequest(`/zones?name=${DOMAIN}`);
    if (zones.length === 0) {
      throw new Error(`Zone ${DOMAIN} not found`);
    }
    const zoneId = zones[0].id;
    console.log(`✅ Found Zone ID for ${DOMAIN}: ${zoneId}`);

    // 2. Check for existing record
    const records = await apiRequest(`/zones/${zoneId}/dns_records?name=${SUBDOMAIN}.${DOMAIN}`);
    const existingRecord = records.find(r => r.name === `${SUBDOMAIN}.${DOMAIN}`);

    if (existingRecord) {
      console.log(`Updating existing record ${existingRecord.id}...`);
      await apiRequest(`/zones/${zoneId}/dns_records/${existingRecord.id}`, 'PUT', {
        type: 'A',
        name: SUBDOMAIN,
        content: IP_ADDRESS,
        ttl: 1, // Auto
        proxied: false // DNS Only
      });
      console.log(`✅ Successfully updated DNS record for ${SUBDOMAIN}.${DOMAIN} -> ${IP_ADDRESS}`);
    } else {
      console.log(`Creating new A record...`);
      await apiRequest(`/zones/${zoneId}/dns_records`, 'POST', {
        type: 'A',
        name: SUBDOMAIN,
        content: IP_ADDRESS,
        ttl: 1, // Auto
        proxied: false // DNS Only
      });
      console.log(`✅ Successfully created DNS record for ${SUBDOMAIN}.${DOMAIN} -> ${IP_ADDRESS}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.errors ? JSON.stringify(error.errors, null, 2) : error.message);
    process.exit(1);
  }
}

run();
