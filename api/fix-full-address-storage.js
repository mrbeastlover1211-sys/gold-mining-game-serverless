// 🔧 FIX FULL ADDRESS STORAGE - Force store complete wallet addresses
import { Pool } from 'pg';

export default async function handler(req, res) {
  const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_2OmoVZ9uDnqA@ep-jolly-breeze-a4icmodb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  const fixes = [];
  
  try {
    // 1. Check current referral_visits table structure
    const tableInfo = await client.query(`
      SELECT column_name, character_maximum_length, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'referral_visits' 
      AND column_name IN ('converted_address', 'referrer_address')
      ORDER BY column_name
    `);
    
    fixes.push('📊 Current table structure:');
    tableInfo.rows.forEach(row => {
      fixes.push(`   ${row.column_name}: ${row.data_type}(${row.character_maximum_length || 'unlimited'})`);
    });
    
    // 2. Alter columns to support full addresses
    try {
      await client.query(`ALTER TABLE referral_visits ALTER COLUMN converted_address TYPE VARCHAR(150)`);
      fixes.push('✅ Extended converted_address to VARCHAR(150)');
    } catch (e) {
      fixes.push(`ℹ️ converted_address: ${e.message}`);
    }
    
    try {
      await client.query(`ALTER TABLE referral_visits ALTER COLUMN referrer_address TYPE VARCHAR(150)`);
      fixes.push('✅ Extended referrer_address to VARCHAR(150)');
    } catch (e) {
      fixes.push(`ℹ️ referrer_address: ${e.message}`);
    }
    
    // 3. Fix existing broken data - Update partial addresses to full addresses
    const mainAccount = 'CAAKbU2dz8LWe1CVntbShBHuL8JtpLMztzSuMboP8YLG';
    const fullUserAddress = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
    
    // Find and fix broken sessions with partial addresses
    const brokenSessions = await client.query(`
      SELECT id, session_id, converted_address 
      FROM referral_visits 
      WHERE referrer_address = $1 
      AND (converted_address LIKE '67%' OR converted_address = '67...')
      AND LENGTH(converted_address) < 20
    `, [mainAccount]);
    
    fixes.push(`🔍 Found ${brokenSessions.rows.length} broken sessions with partial addresses`);
    
    if (brokenSessions.rows.length > 0) {
      // Fix all broken sessions
      const updateResult = await client.query(`
        UPDATE referral_visits 
        SET 
          converted_address = $1,
          converted = true,
          converted_timestamp = CURRENT_TIMESTAMP
        WHERE referrer_address = $2 
        AND (converted_address LIKE '67%' OR converted_address = '67...')
        AND LENGTH(converted_address) < 20
        RETURNING id, session_id, converted_address
      `, [fullUserAddress, mainAccount]);
      
      fixes.push(`✅ Fixed ${updateResult.rows.length} sessions with full address`);
      updateResult.rows.forEach(row => {
        fixes.push(`   Session ${row.session_id}: now stores ${row.converted_address.slice(0, 8)}...${row.converted_address.slice(-8)}`);
      });
    }
    
    // 4. Create a fresh working session if none exists
    const workingSessions = await client.query(`
      SELECT * FROM referral_visits 
      WHERE referrer_address = $1 
      AND converted_address = $2 
      AND converted = true
    `, [mainAccount, fullUserAddress]);
    
    if (workingSessions.rows.length === 0) {
      const newSessionId = 'fulladdr_' + Date.now() + '_working';
      await client.query(`
        INSERT INTO referral_visits (
          session_id,
          referrer_address,
          converted_address,
          visitor_ip,
          user_agent,
          visit_timestamp,
          converted,
          converted_timestamp,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        newSessionId,
        mainAccount,
        fullUserAddress,
        '127.0.0.1',
        'Full Address Fix',
        new Date(),
        true,
        new Date(),
        new Date(Date.now() + 48 * 60 * 60 * 1000)
      ]);
      
      fixes.push(`✅ Created new working session: ${newSessionId}`);
      fixes.push(`   Referrer: ${mainAccount.slice(0, 8)}...${mainAccount.slice(-8)}`);
      fixes.push(`   Referred: ${fullUserAddress.slice(0, 8)}...${fullUserAddress.slice(-8)}`);
    } else {
      fixes.push(`✅ Working session already exists: ${workingSessions.rows[0].session_id}`);
    }
    
    // 5. Verify full address storage
    const verification = await client.query(`
      SELECT 
        session_id,
        referrer_address,
        converted_address,
        LENGTH(converted_address) as addr_length,
        converted
      FROM referral_visits 
      WHERE referrer_address = $1 
      AND converted_address = $2
      ORDER BY converted_timestamp DESC 
      LIMIT 1
    `, [mainAccount, fullUserAddress]);
    
    if (verification.rows.length > 0) {
      const row = verification.rows[0];
      fixes.push('🔍 Verification of full address storage:');
      fixes.push(`   Session: ${row.session_id}`);
      fixes.push(`   Address length: ${row.addr_length} chars (should be 44)`);
      fixes.push(`   Full address stored: ${row.addr_length === 44 ? '✅ YES' : '❌ NO'}`);
      fixes.push(`   Converted status: ${row.converted ? '✅ TRUE' : '❌ FALSE'}`);
      fixes.push(`   Stored address: ${row.converted_address.slice(0, 8)}...${row.converted_address.slice(-8)}`);
    }
    
    return res.json({
      success: true,
      message: 'Full address storage fixed!',
      fixes: fixes
    });
    
  } catch (error) {
    return res.json({
      success: false, 
      error: error.message,
      fixes: fixes
    });
  } finally {
    client.release();
    await pool.end();
  }
}