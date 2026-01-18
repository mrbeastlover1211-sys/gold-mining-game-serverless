// 🔄 CLEAR MEMORY CACHE - Force restart memory state
export default async function handler(req, res) {
  try {
    console.log('🔄 Clearing all memory caches...');
    
    // Clear global users cache
    if (typeof global !== 'undefined') {
      global.users = {};
      console.log('✅ Cleared global.users cache');
    }
    
    // Clear any other global variables
    if (typeof global !== 'undefined' && global.userCache) {
      global.userCache = {};
      console.log('✅ Cleared global.userCache');
    }
    
    // Clear any module cache related to users
    if (typeof require !== 'undefined' && require.cache) {
      Object.keys(require.cache).forEach(key => {
        if (key.includes('database') || key.includes('user')) {
          delete require.cache[key];
          console.log(`✅ Cleared module cache: ${key}`);
        }
      });
    }
    
    const clearedCaches = [];
    
    // List what was cleared
    if (typeof global !== 'undefined') {
      clearedCaches.push('global.users');
      
      if (global.userCache) {
        clearedCaches.push('global.userCache');
      }
    }
    
    console.log('🎉 Memory cache clearing complete');
    
    return res.json({
      success: true,
      message: 'Memory caches cleared',
      cleared_caches: clearedCaches,
      instructions: [
        'Memory state has been reset',
        'All users can now purchase land fresh',
        'Database will be the source of truth'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Cache clearing error:', error);
    return res.json({
      success: false,
      error: error.message,
      message: 'Failed to clear caches, but they might reset on next function call'
    });
  }
}