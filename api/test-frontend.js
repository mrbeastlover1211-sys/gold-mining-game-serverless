// Simple endpoint to test if frontend JavaScript is working
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Frontend Test</title>
</head>
<body>
    <h1>🧪 Frontend JavaScript Test</h1>
    
    <button onclick="testAPI()">Test API Connection</button>
    <button onclick="testMiningEngine()">Test Mining Engine</button>
    <button onclick="testWallet()">Test Wallet</button>
    
    <div id="results"></div>
    
    <script src="https://unpkg.com/@solana/web3.js@1.95.3/lib/index.iife.min.js"></script>
    <script src="/mining-engine.js"></script>
    <script>
        const log = (msg) => {
            document.getElementById('results').innerHTML += '<p>' + msg + '</p>';
            console.log(msg);
        };
        
        async function testAPI() {
            log('🧪 Testing API...');
            try {
                const response = await fetch('/api/config');
                const data = await response.json();
                log('✅ API works: ' + JSON.stringify(data));
            } catch (error) {
                log('❌ API failed: ' + error.message);
            }
        }
        
        async function testMiningEngine() {
            log('⛏️ Testing mining engine...');
            try {
                if (window.MiningEngine) {
                    log('✅ MiningEngine class exists');
                } else {
                    log('❌ MiningEngine class missing');
                }
                
                if (window.optimizedMiningEngine) {
                    log('✅ optimizedMiningEngine instance exists');
                } else {
                    log('❌ optimizedMiningEngine instance missing');
                }
            } catch (error) {
                log('❌ Mining engine test failed: ' + error.message);
            }
        }
        
        async function testWallet() {
            log('👛 Testing wallet...');
            try {
                if (window.solana && window.solana.isPhantom) {
                    log('✅ Phantom wallet detected');
                    
                    const response = await window.solana.connect();
                    log('✅ Wallet connected: ' + response.publicKey.toString());
                    
                    // Test API call with wallet
                    const status = await fetch('/api/status?address=' + response.publicKey.toString());
                    const data = await status.json();
                    log('✅ Status API: ' + JSON.stringify(data));
                    
                } else {
                    log('❌ Phantom wallet not found');
                }
            } catch (error) {
                log('❌ Wallet test failed: ' + error.message);
            }
        }
        
        // Auto-run basic tests
        window.addEventListener('load', () => {
            log('🚀 Page loaded, running basic tests...');
            testAPI();
            testMiningEngine();
        });
    </script>
</body>
</html>
  `);
}