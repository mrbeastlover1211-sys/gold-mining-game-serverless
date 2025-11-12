// Debug endpoint to check wallet state
export default function handler(req, res) {
  res.json({
    message: 'Debug endpoint working',
    instructions: 'Open browser console and check wallet state logs when clicking buy pickaxe',
    debug_steps: [
      '1. Open browser console (F12)',
      '2. Click buy pickaxe button', 
      '3. Look for wallet state logs',
      '4. Check if state.address is undefined'
    ]
  });
}