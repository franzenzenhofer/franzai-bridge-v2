// Bridge Workbench - Timing Utilities
// Bridge overhead calculation and performance metrics

export function calculateBridgeOverhead(totalDuration) {
  if (!totalDuration || totalDuration <= 0) return null;

  // Estimate ~10% overhead for extension processing
  const bridgeTime = Math.round(totalDuration * 0.1);
  const networkTime = totalDuration - bridgeTime;

  return { bridgeTime, networkTime, totalDuration };
}

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '';
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(2) + 's';
}

export function getPerformanceColor(ms) {
  if (ms < 200) return 'var(--success)';
  if (ms < 500) return 'var(--warning)';
  return 'var(--error)';
}

// Performance observer for real-time metrics
let performanceEntries = [];

export function startPerformanceCapture() {
  performanceEntries = [];
  if (window.PerformanceObserver) {
    try {
      const observer = new PerformanceObserver((list) => {
        performanceEntries.push(...list.getEntries());
      });
      observer.observe({ entryTypes: ['resource', 'measure'] });
      return observer;
    } catch (e) { /* ignore */ }
  }
  return null;
}

export function getLastResourceTiming(urlPattern) {
  const entries = performance.getEntriesByType('resource');
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].name.includes(urlPattern)) {
      return entries[i];
    }
  }
  return null;
}

window.BridgeTiming = {
  calculateBridgeOverhead,
  formatDuration,
  getPerformanceColor,
  startPerformanceCapture,
  getLastResourceTiming
};
