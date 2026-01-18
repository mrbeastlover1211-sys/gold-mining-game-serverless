// Test endpoint to verify exactly what data the UI should be receiving
export default async function handler(req, res) {
  const address = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
  
  try {
    // Get the same data the frontend should receive
    const response = await fetch(`https://gold-mining-game-serverless.vercel.app/api/status?address=${address}`);
    const statusData = await response.json();
    
    return res.setHeader('Content-Type', 'text/html').send(`
<!DOCTYPE html>
<html>
<head><title>UI Data Test</title></head>
<body>
    <h1>🧪 UI Data Test for ${address.slice(0,8)}...</h1>
    
    <h2>📊 Raw API Data:</h2>
    <pre>${JSON.stringify(statusData, null, 2)}</pre>
    
    <h2>🎮 What UI Should Show:</h2>
    <div style="background: #f0f0f0; padding: 20px; margin: 10px 0;">
        <h3>💰 Gold: ${statusData.currentGold?.toLocaleString() || 0}</h3>
        <h3>⛏️ Pickaxes:</h3>
        <ul>
            <li>🥈 Silver: ${statusData.inventory?.silver || 0}</li>
            <li>🥇 Gold: ${statusData.inventory?.gold || 0}</li>
            <li>💎 Diamond: ${statusData.inventory?.diamond || 0}</li>
            <li>⚡ Netherite: ${statusData.inventory?.netherite || 0}</li>
        </ul>
        <h3>⚡ Mining Power: ${statusData.checkpoint?.total_mining_power || 0}/min</h3>
        <h3>🏠 Has Land: ${statusData.hasLand ? 'Yes' : 'No'}</h3>
    </div>
    
    <h2>🔧 Test UI Update Function:</h2>
    <button onclick="testUpdate()">Test updateDisplay()</button>
    <div id="result"></div>
    
    <script>
        const testData = ${JSON.stringify(statusData)};
        
        function testUpdate() {
            const result = document.getElementById('result');
            result.innerHTML = '<h3>Testing UI Update with this data:</h3><pre>' + JSON.stringify(testData, null, 2) + '</pre>';
            
            // Test if updateDisplay function exists
            if (typeof updateDisplay === 'function') {
                result.innerHTML += '<p style="color: green;">✅ updateDisplay function exists</p>';
                try {
                    updateDisplay({
                        gold: testData.currentGold,
                        inventory: testData.inventory,
                        checkpoint: testData.checkpoint
                    });
                    result.innerHTML += '<p style="color: green;">✅ updateDisplay called successfully</p>';
                } catch (error) {
                    result.innerHTML += '<p style="color: red;">❌ updateDisplay error: ' + error.message + '</p>';
                }
            } else {
                result.innerHTML += '<p style="color: red;">❌ updateDisplay function not found</p>';
            }
        }
        
        // Auto-show data on load
        console.log('🧪 Test data loaded:', testData);
        console.log('🎯 Inventory should show:', testData.inventory);
        console.log('💰 Gold should show:', testData.currentGold);
    </script>
</body>
</html>
    `);
    
  } catch (error) {
    return res.json({
      error: error.message,
      stack: error.stack
    });
  }
}