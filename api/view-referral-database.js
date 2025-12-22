// 👁️ VIEW REFERRAL DATABASE - Direct database viewer for address storage
import { getPool } from '../database.js';

export default async function handler(req, res) {
  try {
    console.log('👁️ Viewing referral database contents...');
    
    const pool = await getPool();
    const client = await pool.connect();
    
    const { address } = req.query;
    
    try {
      // Get table structure info
      const tableInfo = await client.query(`
        SELECT column_name, character_maximum_length, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'referral_visits' 
        ORDER BY ordinal_position
      `);
      
      // Get all referral visits data
      const allVisits = await client.query(`
        SELECT 
          id,
          session_id,
          referrer_address,
          converted_address,
          LENGTH(referrer_address) as referrer_length,
          LENGTH(converted_address) as converted_length,
          visit_timestamp,
          converted,
          expires_at
        FROM referral_visits 
        ORDER BY visit_timestamp DESC 
        LIMIT 20
      `);
      
      // Get specific data for the target user
      const targetAddress = address || '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
      const mainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
      
      // Find visits for main account
      const mainAccountVisits = await client.query(`
        SELECT 
          id,
          session_id,
          referrer_address,
          converted_address,
          LENGTH(referrer_address) as referrer_length,
          LENGTH(converted_address) as converted_length,
          visit_timestamp,
          converted
        FROM referral_visits 
        WHERE referrer_address = $1
        ORDER BY visit_timestamp DESC
      `, [mainAccount]);
      
      // Find visits with target user
      const targetUserVisits = await client.query(`
        SELECT 
          id,
          session_id,
          referrer_address,
          converted_address,
          LENGTH(referrer_address) as referrer_length,
          LENGTH(converted_address) as converted_length,
          visit_timestamp,
          converted
        FROM referral_visits 
        WHERE converted_address LIKE $1 OR converted_address = $2
        ORDER BY visit_timestamp DESC
      `, [targetAddress.slice(0, 8) + '%', targetAddress]);
      
      client.release();
      await pool.end();
      
      // Create HTML response for easy viewing
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Referral Database Viewer</title>
          <style>
            body { font-family: monospace; margin: 20px; background: #1a1a1a; color: #fff; }
            .container { max-width: 1200px; margin: 0 auto; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #2d2d2d; }
            th, td { border: 1px solid #555; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #444; }
            .header { color: #4CAF50; margin: 20px 0; }
            .section { margin: 30px 0; }
            .full-address { color: #4CAF50; }
            .partial-address { color: #f44336; }
            .length { color: #2196F3; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="header">🔍 Referral Database Viewer</h1>
            
            <div class="section">
              <h2>📊 Table Structure</h2>
              <table>
                <tr><th>Column</th><th>Type</th><th>Max Length</th></tr>
                ${tableInfo.rows.map(row => 
                  `<tr><td>${row.column_name}</td><td>${row.data_type}</td><td>${row.character_maximum_length || 'unlimited'}</td></tr>`
                ).join('')}
              </table>
            </div>
            
            <div class="section">
              <h2>🎯 Your Referral Visits (Main Account: ${mainAccount.slice(0, 8)}...)</h2>
              <p>Total visits for your referral link: <strong>${mainAccountVisits.rows.length}</strong></p>
              <table>
                <tr>
                  <th>ID</th><th>Session ID</th><th>Referrer</th><th>Converted Address</th>
                  <th>Referrer Len</th><th>Converted Len</th><th>Converted</th><th>Timestamp</th>
                </tr>
                ${mainAccountVisits.rows.map(row => 
                  `<tr>
                    <td>${row.id}</td>
                    <td>${row.session_id.slice(0, 20)}...</td>
                    <td class="${row.referrer_length > 40 ? 'full-address' : 'partial-address'}">${row.referrer_address.slice(0, 8)}...${row.referrer_address.slice(-8)}</td>
                    <td class="${row.converted_length > 40 ? 'full-address' : 'partial-address'}">${row.converted_address || 'null'}</td>
                    <td class="length">${row.referrer_length}</td>
                    <td class="length">${row.converted_length || 0}</td>
                    <td>${row.converted ? '✅' : '❌'}</td>
                    <td>${row.visit_timestamp}</td>
                  </tr>`
                ).join('')}
              </table>
            </div>
            
            <div class="section">
              <h2>👤 Target User Visits (${targetAddress.slice(0, 8)}...)</h2>
              <p>Visits where this user was referred: <strong>${targetUserVisits.rows.length}</strong></p>
              <table>
                <tr>
                  <th>ID</th><th>Session ID</th><th>Referrer</th><th>Converted Address</th>
                  <th>Referrer Len</th><th>Converted Len</th><th>Converted</th><th>Timestamp</th>
                </tr>
                ${targetUserVisits.rows.map(row => 
                  `<tr>
                    <td>${row.id}</td>
                    <td>${row.session_id.slice(0, 20)}...</td>
                    <td class="${row.referrer_length > 40 ? 'full-address' : 'partial-address'}">${row.referrer_address.slice(0, 8)}...${row.referrer_address.slice(-8)}</td>
                    <td class="${row.converted_length > 40 ? 'full-address' : 'partial-address'}">${row.converted_address || 'null'}</td>
                    <td class="length">${row.referrer_length}</td>
                    <td class="length">${row.converted_length || 0}</td>
                    <td>${row.converted ? '✅' : '❌'}</td>
                    <td>${row.visit_timestamp}</td>
                  </tr>`
                ).join('')}
              </table>
            </div>
            
            <div class="section">
              <h2>📈 Latest 20 Visits (All Users)</h2>
              <table>
                <tr>
                  <th>ID</th><th>Session ID</th><th>Referrer</th><th>Converted Address</th>
                  <th>Referrer Len</th><th>Converted Len</th><th>Converted</th><th>Timestamp</th>
                </tr>
                ${allVisits.rows.map(row => 
                  `<tr>
                    <td>${row.id}</td>
                    <td>${row.session_id.slice(0, 15)}...</td>
                    <td class="${row.referrer_length > 40 ? 'full-address' : 'partial-address'}">${row.referrer_address.slice(0, 8)}...</td>
                    <td class="${row.converted_length > 40 ? 'full-address' : 'partial-address'}">${row.converted_address || 'null'}</td>
                    <td class="length">${row.referrer_length}</td>
                    <td class="length">${row.converted_length || 0}</td>
                    <td>${row.converted ? '✅' : '❌'}</td>
                    <td>${new Date(row.visit_timestamp).toLocaleString()}</td>
                  </tr>`
                ).join('')}
              </table>
            </div>
            
            <div class="section">
              <h2>🔧 Address Storage Analysis</h2>
              <p><span class="full-address">Green = Full Address (40+ chars)</span></p>
              <p><span class="partial-address">Red = Partial Address (&lt;40 chars)</span></p>
              <p><span class="length">Blue = Character Count</span></p>
              <p>Solana addresses should be 44 characters long.</p>
            </div>
            
          </div>
        </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
      
    } catch (queryError) {
      console.error('❌ Database query error:', queryError);
      throw queryError;
    }
    
  } catch (error) {
    console.error('❌ View referral database error:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
}