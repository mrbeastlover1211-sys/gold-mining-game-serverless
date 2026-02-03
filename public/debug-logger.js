// 🔧 Debug Logger - Controlled by Environment Variable
// Set DEBUG_MODE=true in Vercel to enable logs, false to disable

// This will be set by the API config endpoint
let DEBUG_ENABLED = false;

// Initialize debug mode from API
async function initDebugMode() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    DEBUG_ENABLED = config.debugMode === true;
    if (DEBUG_ENABLED) {
      console.log('🔧 Debug mode: ENABLED');
    }
  } catch (e) {
    // Silently fail - debug stays disabled
  }
}

// Custom logger that respects debug mode
const logger = {
  log: (...args) => {
    if (DEBUG_ENABLED) console.log(...args);
  },
  warn: (...args) => {
    if (DEBUG_ENABLED) console.warn(...args);
  },
  error: (...args) => {
    // Always show errors
    console.error(...args);
  },
  info: (...args) => {
    if (DEBUG_ENABLED) console.info(...args);
  },
  debug: (...args) => {
    if (DEBUG_ENABLED) console.debug(...args);
  },
  time: (label) => {
    if (DEBUG_ENABLED) console.time(label);
  },
  timeEnd: (label) => {
    if (DEBUG_ENABLED) console.timeEnd(label);
  },
  // Force log (always shows regardless of debug mode)
  force: (...args) => {
    console.log(...args);
  }
};

// Initialize on load
initDebugMode();

// Export for use in other files
window.logger = logger;
window.DEBUG_ENABLED = () => DEBUG_ENABLED;
