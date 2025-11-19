// Emergency endpoint to manually grant land ownership while debugging the save issue
import { UltraOptimizedDatabase } from '../database-ultra-optimized.js';

export default async function handler(req, res) {
  try {
    const address = '67agGdBaroRL6SJguYT13eVMkWGCegfFbQgnHaJub45C';
    
    console.log('🔧 EMERGENCY: Manually granting land to fix popup issue...');
    
    // Get current user data
    const existingUser = await UltraOptimizedDatabase.getUser(address, true);
    console.log('Current user data:', existingUser);
    
    // Force land ownership
    const updatedUser = {
      ...existingUser,
      hasLand: true,
      landPurchaseDate: Math.floor(Date.now() / 1000),
      lastActivity: Math.floor(Date.now() / 1000)
    };
    
    console.log('Attempting to save with hasLand: true...');
    
    // Try to save with ultra-fast core save
    const saveResult = await UltraOptimizedDatabase.saveUserCore(address, updatedUser);
    
    console.log('Save result:', saveResult);
    
    // Verify it saved
    const verifyUser = await UltraOptimizedDatabase.getUser(address, true);
    console.log('Verification after save:', verifyUser);
    
    return res.json({
      status: 'emergency_land_grant',
      address: address,
      before: { hasLand: existingUser.hasLand },
      after: { hasLand: verifyUser.hasLand },
      saveResult: saveResult,
      success: verifyUser.hasLand === true,
      message: verifyUser.hasLand ? 'Land ownership forced - popup should disappear now!' : 'Still failed to save land ownership'
    });
    
  } catch (error) {
    console.error('Emergency land grant failed:', error);
    return res.json({
      status: 'error',
      error: error.message,
      stack: error.stack
    });
  }
}