// 🔧 Debug Logger - Always enabled for debugging
// All logs will show in console

// Debug is always enabled for now
let DEBUG_ENABLED = true;

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

// Export for use in other files
window.logger = logger;
window.DEBUG_ENABLED = () => DEBUG_ENABLED;
