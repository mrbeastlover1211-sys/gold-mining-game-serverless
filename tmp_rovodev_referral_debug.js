// 🔍 REFERRAL SYSTEM DEBUGGING TOOL
// This script simulates the actual user flow to test the referral system

const API_BASE = 'https://gold-mining-game-serverless.vercel.app';

async function debugReferralSystem() {
    console.log('🎯 STARTING REFERRAL SYSTEM DEBUG\n');
    
    const testReferrer = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
    const testUser = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
    
    // Step 1: Simulate clicking referral link (get cookies)
    console.log('📱 Step 1: Simulating referral link click...');
    try {
        const trackResponse = await fetch(`${API_BASE}/api/track-referral?ref=${encodeURIComponent(testReferrer)}`);
        
        // Extract cookies from response
        const setCookieHeader = trackResponse.headers.get('set-cookie');
        console.log('📊 Track response status:', trackResponse.status);
        console.log('🍪 Set-Cookie header:', setCookieHeader);
        
        if (!setCookieHeader) {
            console.log('❌ PROBLEM: No cookies set by tracking API!');
            return;
        }
        
        // Parse cookies
        const sessionCookie = setCookieHeader.match(/referral_session=([^;]+)/);
        const sessionId = sessionCookie ? sessionCookie[1] : null;
        
        if (!sessionId) {
            console.log('❌ PROBLEM: No session ID found in cookies!');
            return;
        }
        
        console.log('✅ Session ID extracted:', sessionId.slice(0, 20) + '...\n');
        
        // Step 2: Simulate wallet connection (send cookies)
        console.log('👛 Step 2: Simulating wallet connection...');
        const sessionResponse = await fetch(`${API_BASE}/api/check-referral-session?address=${encodeURIComponent(testUser)}`, {
            headers: {
                'Cookie': `referral_session=${sessionId}; referral_tracked=true`
            }
        });
        
        const sessionData = await sessionResponse.json();
        console.log('📊 Session check response:', JSON.stringify(sessionData, null, 2));
        
        if (!sessionData.referrer_found) {
            console.log('❌ PROBLEM: Session not found even with cookies!');
            return;
        }
        
        console.log('✅ Referral session successfully linked!\n');
        
        // Step 3: Test completion
        console.log('🎁 Step 3: Testing referral completion...');
        const completionResponse = await fetch(`${API_BASE}/api/complete-referral?address=${encodeURIComponent(testUser)}`);
        const completionData = await completionResponse.json();
        console.log('📊 Completion response:', JSON.stringify(completionData, null, 2));
        
        if (completionData.success && completionData.referral_completed) {
            console.log('🎉 REFERRAL SYSTEM IS WORKING PERFECTLY!');
        } else {
            console.log('ℹ️ Completion not triggered (normal if requirements not met)');
            console.log('💡 User needs to buy land + pickaxe for completion to trigger');
        }
        
    } catch (error) {
        console.error('❌ DEBUG ERROR:', error.message);
    }
}

// Run the debug
debugReferralSystem();