// Audio configuration constants and device detection
// Shared across all audio modules

// Audio processing constants
export const TARGET_SAMPLE_RATE = 16000; // Target rate for transmission
export const BUFFER_SIZE = 0.2; // Keep 200ms of audio buffered for smooth playback
export const MAX_QUEUE_SIZE = 250; // ~5 seconds at 50 chunks/sec
export const MAX_PENDING_QUEUE_SIZE = 50; // Max pending audio before dropping

// Recording buffer sizes
export const BUFFER_SIZES = {
    IOS_17_PLUS: 256,
    IPHONE: 1024,
    IOS: 2048,
    DEFAULT: 4096
};

// Enhanced browser/device detection
export const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
export const isIPhone = /iPhone/.test(navigator.userAgent);
export const isIPad = /iPad/.test(navigator.userAgent);

const iosVersionMatch = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
export const iosVersion = isIOS && iosVersionMatch 
    ? parseFloat(iosVersionMatch[1] + '.' + iosVersionMatch[2]) 
    : 0;

export const isIOS15Plus = iosVersion >= 15;
export const isIOS17Plus = iosVersion >= 17;
export const isMacSafari = isSafari && /Macintosh/.test(navigator.userAgent);

// Gain adjustments for different devices
export const GAIN_VALUES = {
    IPHONE_OLD: 1.2,
    IPAD: 1.1,
    DEFAULT: 1.0
};

// Error thresholds
export const ERROR_THRESHOLDS = {
    MAX_ERRORS: 5,
    MAX_WORKER_ERRORS: 10
};

// Timing constants
export const TIMING = {
    KEEPALIVE_CHECK: 2000,
    SCHEDULER_CHECK_WITH_DATA: 50,
    SCHEDULER_CHECK_NO_DATA: 100,
    PENDING_QUEUE_PROCESS: 100,
    UNLOCK_EXPIRY: 30000
};

// Log device info on load
console.log('Audio module constants loaded - Device detection:', {
    isSafari,
    isIOS,
    isIPhone,
    isIPad,
    iosVersion,
    isIOS15Plus,
    isIOS17Plus,
    isMacSafari,
    userAgent: navigator.userAgent
});
