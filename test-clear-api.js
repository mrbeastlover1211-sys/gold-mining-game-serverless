// Test the clear database API locally
import dotenv from 'dotenv';
dotenv.config();

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me';

async function testClearAPI() {
  try {
    console.log('🧪 Testing clear database API...');
    
    // Test locally first
    const localUrl = 'http://localhost:3000/api/clear-database';
    
    console.log(`🔗 Calling: ${localUrl}`);
    console.log(`🔑 Using admin token: ${ADMIN_TOKEN}`);
    
    const response = await fetch(localUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        adminToken: ADMIN_TOKEN
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API Response:', data);
    } else {
      console.log('❌ API Error:', data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure your server is running: npm start');
  }
}

testClearAPI();