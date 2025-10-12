// Audio recording and playback functionality for HugeVoice
// Enhanced iOS/Safari compatibility with additional safety checks
// DSP powered by libsamplerate.js for high-quality audio resampling

let mediaRecorder = null;
let audioContext = null;
let dotNetRef = null;
let isAudioContextInitialized = false;
let pendingAudioQueue = [];
let isProcessingQueue = false;

// libsamplerate.js integration
let libsamplerate = null;
let resamplerInstance = null;
const TARGET_SAMPLE_RATE = 16000; // Target rate for transmission

// iOS audio unlocking - multiple strategies
let audioElement = null;
let isAudioElementUnlocked = false;
let isWebAudioUnlocked = false;

// State management
let currentPlaybackSource = null;
let blobUrlCache = new Set();
let lastInteractionTime = 0;
let audioSessionActive = false;

// Enhanced browser/device detection
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isIPhone = /iPhone/.test(navigator.userAgent);
const isIPad = /iPad/.test(navigator.userAgent);
const iosVersion = isIOS ? parseFloat((navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/) || [0, 0, 0])[1] + '.' + (navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/) || [0, 0, 0])[2]) : 0;
const isIOS15Plus = iosVersion >= 15;
const isIOS17Plus = iosVersion >= 17;

// Additional detection for Safari desktop
const isMacSafari = isSafari && /Macintosh/.test(navigator.userAgent);

console.log('Audio module loading - Device detection:', {
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

// Initialize libsamplerate
async function initializeLibsamplerate() {
    if (libsamplerate) return true;
    
    try {
        console.log('🎛️ Initializing libsamplerate.js for DSP...');
        
        // Import libsamplerate module
        if (typeof LibSampleRate !== 'undefined') {
            libsamplerate = LibSampleRate;
            console.log('✅ libsamplerate.js loaded successfully');
            return true;
        } else {
            throw new Error('libsamplerate.js not available - this is required for audio processing');
        }
    } catch (error) {
        console.error('❌ Failed to initialize libsamplerate:', error);
        throw error;
    }
}

// Create resampler instance with libsamplerate
function createResampler(fromRate, toRate, channels = 1) {
    if (!libsamplerate) {
        throw new Error('libsamplerate not initialized');
    }
    
    try {
        // Create resampler with SRC_SINC_MEDIUM_QUALITY converter type
        // Available types: SRC_SINC_BEST_QUALITY, SRC_SINC_MEDIUM_QUALITY, SRC_SINC_FASTEST, SRC_ZERO_ORDER_HOLD, SRC_LINEAR
        const converterType = libsamplerate.SRC_SINC_MEDIUM_QUALITY; // Balance between quality and performance
        const resampler = libsamplerate.create(channels, fromRate, toRate, {
            converterType: converterType
        });
        
        console.log(`🎛️ Created libsamplerate resampler: ${fromRate}Hz → ${toRate}Hz (${channels}ch)`);
        return resampler;
    } catch (error) {
        console.error('Failed to create resampler:', error);
        throw error;
    }
}

// Resample audio data using libsamplerate
function resampleAudio(inputData, fromRate, toRate) {
    if (fromRate === toRate) {
        return inputData; // No resampling needed
    }
    
    if (!libsamplerate) {
        throw new Error('libsamplerate not initialized - cannot resample audio');
    }
    
    try {
        // Use libsamplerate for high-quality resampling
        const outputData = libsamplerate.simple(inputData, fromRate, toRate, {
            converterType: libsamplerate.SRC_SINC_MEDIUM_QUALITY
        });
        return outputData;
    } catch (error) {
        console.error('libsamplerate resampling failed:', error);
        throw error;
    }
}

// Create Audio element for iOS fallback with better error handling
function createAudioElement() {
    if (!audioElement) {
        audioElement = new Audio();
        audioElement.preload = 'auto';
        audioElement.crossOrigin = 'anonymous';

        // iOS-specific settings
        if (isIOS) {
            audioElement.playsInline = true;
            audioElement.setAttribute('playsinline', '');
            audioElement.setAttribute('webkit-playsinline', '');
            audioElement.muted = false;
            audioElement.volume = 1.0;
        }

        // Add error handlers
        audioElement.addEventListener('error', (e) => {
            console.error('Audio element error:', e);
            // Reset unlock state on error
            if (isIOS) {
                isAudioElementUnlocked = false;
            }
        });

        // Monitor play state changes
        audioElement.addEventListener('play', () => {
            console.log('Audio element playing');
            audioSessionActive = true;
        });

        audioElement.addEventListener('ended', () => {
            console.log('Audio element ended');
            audioSessionActive = false;
        });

        console.log('Audio element created for iOS fallback');
    }
    return audioElement;
}

// Monitor audio interruptions (iOS)
if (isIOS) {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && audioContext) {
            console.log('Page hidden, suspending audio context');
            audioContext.suspend();
        } else if (!document.hidden && audioContext && isAudioContextInitialized) {
            console.log('Page visible, resuming audio context');
            audioContext.resume();
        }
    });

    // Handle audio session interruptions
    window.addEventListener('blur', () => {
        if (audioSessionActive) {
            console.log('Window blur detected, audio session may be interrupted');
        }
    });

    window.addEventListener('focus', async () => {
        if (audioSessionActive && audioContext && audioContext.state === 'suspended') {
            console.log('Window focused, attempting to resume audio');
            await audioContext.resume();
        }
    });
}

export async function startRecording(dotNetReference) {
    dotNetRef = dotNetReference;

    try {
        // Initialize libsamplerate
        await initializeLibsamplerate();
        
        // Ensure audio is unlocked before recording
        await ensureAudioUnlocked();

        // Check for MediaRecorder support (iOS 15+)
        const hasMediaRecorder = typeof MediaRecorder !== 'undefined';

        if (!hasMediaRecorder && isIOS) {
            throw new Error('MediaRecorder not supported on iOS < 15. Please update your iOS version.');
        }

        // iPhone-specific audio constraints with fallbacks
        const audioConstraints = {
            audio: {
                channelCount: { ideal: 1, max: 2 },
                echoCancellation: { ideal: true },
                noiseSuppression: { ideal: true },
                autoGainControl: { ideal: true },
                sampleRate: { ideal: isIPhone ? 44100 : 48000 }
            }
        };

        // Try to get user media with fallbacks
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
        } catch (error) {
            console.warn('Failed with ideal constraints, trying basic:', error);
            // Fallback to basic constraints
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        // Initialize audio context if not already done
        if (!audioContext || audioContext.state === 'closed') {
            await initializeAudioContext();
        }

        // Ensure context is running
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const source = audioContext.createMediaStreamSource(stream);
        const sourceSampleRate = audioContext.sampleRate;
        
        console.log(`🎤 Recording setup: ${sourceSampleRate}Hz → ${TARGET_SAMPLE_RATE}Hz`);

        // Create resampler if rates differ
        if (sourceSampleRate !== TARGET_SAMPLE_RATE) {
            resamplerInstance = createResampler(sourceSampleRate, TARGET_SAMPLE_RATE, 1);
        }

        // Use optimal buffer size based on device and iOS version
        let bufferSize;
        if (isIPhone && isIOS17Plus) {
            bufferSize = 256; // iOS 17+ can handle smaller buffers
        } else if (isIPhone) {
            bufferSize = 1024;
        } else if (isIOS) {
            bufferSize = 2048;
        } else {
            bufferSize = 4096;
        }

        // Create ScriptProcessor with error handling
        let processor;
        try {
            processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        } catch (error) {
            console.warn('Failed to create processor with size', bufferSize, 'trying 4096');
            processor = audioContext.createScriptProcessor(4096, 1, 1);
        }

        let errorCount = 0;
        const maxErrors = 5;

        processor.onaudioprocess = async function (event) {
            if (dotNetRef && audioContext.state === 'running') {
                try {
                    const inputData = event.inputBuffer.getChannelData(0);

                    // Check for silent input (iOS sometimes sends silence)
                    const sum = inputData.reduce((a, b) => Math.abs(a) + Math.abs(b), 0);
                    if (sum < 0.01) {
                        return; // Skip silent frames
                    }

                    // Resample audio using libsamplerate if needed
                    let processedData = inputData;
                    if (sourceSampleRate !== TARGET_SAMPLE_RATE) {
                        processedData = resampleAudio(inputData, sourceSampleRate, TARGET_SAMPLE_RATE);
                    }

                    // Convert to 16-bit PCM with clipping protection
                    const samples = new Int16Array(processedData.length);
                    for (let i = 0; i < processedData.length; i++) {
                        const sample = Math.max(-1, Math.min(1, processedData[i]));
                        samples[i] = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
                    }

                    const bytes = new Uint8Array(samples.buffer);
                    const base64String = btoa(String.fromCharCode.apply(null, bytes));

                    await dotNetRef.invokeMethodAsync('SendAudioData', base64String);
                    errorCount = 0; // Reset error count on success
                } catch (error) {
                    errorCount++;
                    console.error('Error processing audio data:', error);

                    if (errorCount >= maxErrors) {
                        console.error('Too many errors, stopping recording');
                        stopRecording();
                    }
                }
            }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        // Store references for cleanup
        window.currentAudioStream = stream;
        window.currentProcessor = processor;
        window.currentSource = source;

        console.log('Recording started - Device:', isIPhone ? 'iPhone' : isIOS ? 'iOS' : 'Other', 'Buffer size:', bufferSize, 'DSP: libsamplerate');

    } catch (error) {
        console.error('Error starting recording:', error);
        // Clean up on error
        if (window.currentAudioStream) {
            window.currentAudioStream.getTracks().forEach(track => track.stop());
        }
        throw error;
    }
}

export function stopRecording() {
    // Clean up audio nodes
    if (window.currentProcessor) {
        window.currentProcessor.disconnect();
        window.currentProcessor = null;
    }

    if (window.currentSource) {
        window.currentSource.disconnect();
        window.currentSource = null;
    }

    // Stop media stream
    if (window.currentAudioStream) {
        window.currentAudioStream.getTracks().forEach(track => track.stop());
        window.currentAudioStream = null;
    }

    // Clean up resampler
    if (resamplerInstance && libsamplerate) {
        try {
            resamplerInstance.destroy();
        } catch (e) {
            console.warn('Error destroying resampler:', e);
        }
        resamplerInstance = null;
    }

    // Suspend but don't close context for reuse
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.suspend();
    }

    dotNetRef = null;
    console.log('Recording stopped');
}

async function initializeAudioContext() {
    try {
        // Initialize libsamplerate for DSP
        await initializeLibsamplerate();
        
        // Detect optimal sample rate
        let sampleRate;
        if (isIPhone && isIOS17Plus) {
            sampleRate = 48000; // iOS 17+ handles 48kHz well
        } else if (isIPhone) {
            sampleRate = 44100;
        } else if (isIOS) {
            sampleRate = 44100;
        } else {
            sampleRate = 48000;
        }

        const contextOptions = {
            sampleRate: sampleRate,
            latencyHint: isIOS ? 'playback' : 'interactive'
        };

        // Create context with proper fallbacks
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            throw new Error('Web Audio API not supported');
        }

        // Always prefer webkitAudioContext on iOS for maximum compatibility
        if (isIOS && window.webkitAudioContext) {
            audioContext = new window.webkitAudioContext(contextOptions);
            console.log('Created webkitAudioContext for iOS');
        } else {
            audioContext = new AudioContextClass(contextOptions);
        }

        console.log('Audio context created with sample rate:', audioContext.sampleRate, 'State:', audioContext.state);

        // Monitor state changes
        if (audioContext.addEventListener) {
            audioContext.addEventListener('statechange', () => {
                console.log('Audio context state changed to:', audioContext.state);
            });
        }

        return true;
    } catch (error) {
        console.error('Error initializing audio context:', error);
        return false;
    }
}

// CRITICAL: This function must be called directly from a user gesture
export async function activateAudioContext() {
    try {
        console.log('🔊 Activating audio with user interaction...');

        // Track interaction time
        lastInteractionTime = Date.now();

        // Step 1: Initialize audio context if needed
        if (!audioContext || audioContext.state === 'closed') {
            const initialized = await initializeAudioContext();
            if (!initialized) {
                console.error('Failed to initialize audio context');
                return false;
            }
        }

        // Step 2: Resume audio context (MUST be in user gesture)
        if (audioContext && audioContext.state === 'suspended') {
            console.log('📱 Resuming suspended audio context...');

            // iOS sometimes needs multiple resume attempts
            let resumeAttempts = 0;
            while (audioContext.state === 'suspended' && resumeAttempts < 3) {
                await audioContext.resume();
                resumeAttempts++;

                if (audioContext.state === 'suspended') {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            console.log('✅ Audio context state after resume:', audioContext.state);
        }

        // Step 3: Unlock Web Audio API (MUST be in user gesture)
        await unlockWebAudio();

        // Step 4: Unlock Audio element (MUST be in user gesture)  
        await unlockAudioElement();

        // Step 5: Setup Media Session API for iOS control center (iOS 15+)
        if ('mediaSession' in navigator && isIOS15Plus) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'HugeVoice Audio',
                artist: 'HugeVoice',
                album: 'Audio Stream'
            });
        }

        isAudioContextInitialized = true;
        console.log('🎉 Audio fully activated! WebAudio:', isWebAudioUnlocked, 'AudioElement:', isAudioElementUnlocked, 'DSP: libsamplerate');

        // Process any queued audio
        if (pendingAudioQueue.length > 0) {
            console.log('🎵 Processing', pendingAudioQueue.length, 'queued audio buffers...');
            processAudioQueue();
        }

        return true;
    } catch (error) {
        console.error('❌ Error activating audio context:', error);
        return false;
    }
}

// CRITICAL: Must be called directly in user gesture - no async/await delays
async function unlockWebAudio() {
    if (isWebAudioUnlocked || !audioContext) return;

    try {
        console.log('🔓 Unlocking Web Audio API...');

        // iOS 17+ needs fewer unlock attempts
        const unlockAttempts = isIOS17Plus ? 2 : 5;

        // Create multiple silent buffers to ensure unlock
        for (let i = 0; i < unlockAttempts; i++) {
            const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;

            // iOS needs non-zero gain
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);

            source.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Start immediately
            source.start(0);
            source.stop(audioContext.currentTime + 0.001);
        }

        // Additional unlock with oscillator (works better on some iOS versions)
        if (!isIOS17Plus) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.01);
        }

        isWebAudioUnlocked = true;
        console.log('✅ Web Audio API unlocked');

    } catch (error) {
        console.error('❌ Error unlocking Web Audio API:', error);
        isWebAudioUnlocked = false;
    }
}

// CRITICAL: Must be called directly in user gesture
async function unlockAudioElement() {
    if (isAudioElementUnlocked) return;

    try {
        console.log('🔓 Unlocking Audio element...');

        // Create audio element if not exists
        createAudioElement();

        // iOS 15+ can use simpler unlock
        if (isIOS15Plus) {
            // Use data URI for maximum compatibility
            audioElement.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAAA=';
            audioElement.volume = 0.01;

            try {
                await audioElement.play();
                audioElement.pause();
                audioElement.currentTime = 0;
                isAudioElementUnlocked = true;
                console.log('✅ Audio element unlocked (iOS 15+ method)');
                return;
            } catch (error) {
                console.log('iOS 15+ unlock failed, trying legacy method');
            }
        }

        // Legacy unlock method for older iOS
        if (audioContext) {
            // Create a tiny silent audio file as blob
            const audioBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);

            // Convert to WAV blob for Audio element
            const wav = audioBufferToWav(audioBuffer);
            const blob = new Blob([wav], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);

            // Track blob URL for cleanup
            blobUrlCache.add(url);

            // Play through Audio element to unlock it
            audioElement.src = url;
            audioElement.volume = 0.01;

            // CRITICAL: play() must be called directly in user gesture
            try {
                const playPromise = audioElement.play();

                if (playPromise !== undefined) {
                    await playPromise;
                    audioElement.pause();
                    audioElement.currentTime = 0;
                }

                isAudioElementUnlocked = true;
                console.log('✅ Audio element unlocked via play()');
            } catch (playError) {
                console.log('⚠️ Audio element play failed:', playError.name);
                isAudioElementUnlocked = false;
            }

            // Schedule cleanup
            setTimeout(() => {
                URL.revokeObjectURL(url);
                blobUrlCache.delete(url);
            }, 1000);
        }

    } catch (error) {
        console.error('❌ Error unlocking Audio element:', error);
        isAudioElementUnlocked = false;
    }
}

// Ensure both Web Audio and Audio element are unlocked
async function ensureAudioUnlocked() {
    // Check if we've had a recent interaction
    const timeSinceInteraction = Date.now() - lastInteractionTime;
    const needsRefresh = timeSinceInteraction > 30000; // 30 seconds

    if (needsRefresh && isIOS) {
        console.log('⚠️ Audio unlock may have expired, needs refresh');
        isWebAudioUnlocked = false;
        isAudioElementUnlocked = false;
    }

    if (!isWebAudioUnlocked || !isAudioElementUnlocked) {
        console.log('⚠️ Audio not fully unlocked, waiting for user interaction...');
        return false;
    }

    // Additional check for audio context state
    if (audioContext && audioContext.state === 'suspended') {
        console.log('⚠️ Audio context suspended, needs user interaction');
        return false;
    }

    return true;
}

export async function playAudio(audioData) {
    try {
        // Check if we have valid audio data
        if (!audioData) {
            console.error('No audio data provided');
            return;
        }

        // If not fully unlocked, queue the audio
        if (!isAudioContextInitialized || !audioContext || audioContext.state !== 'running') {
            console.log('🔄 Audio not ready, queuing audio data. Context state:', audioContext?.state);
            pendingAudioQueue.push(audioData);

            // Limit queue size to prevent memory issues
            if (pendingAudioQueue.length > 50) {
                console.warn('Audio queue overflow, dropping oldest items');
                pendingAudioQueue = pendingAudioQueue.slice(-30);
            }

            return;
        }

        // Stop any current playback if needed
        if (currentPlaybackSource) {
            try {
                currentPlaybackSource.stop();
            } catch (e) {
                // Already stopped
            }
            currentPlaybackSource = null;
        }

        // Try Web Audio API first, fallback to Audio element
        if (isWebAudioUnlocked && audioContext.state === 'running') {
            await playAudioWithWebAudio(audioData);
        } else if (isAudioElementUnlocked) {
            await playAudioWithAudioElement(audioData);
        } else {
            // Queue for later when unlocked
            pendingAudioQueue.push(audioData);
        }

    } catch (error) {
        console.error('❌ Error playing audio:', error);

        // Try fallback method
        if (isAudioElementUnlocked && audioElement) {
            try {
                console.log('Attempting fallback audio playback');
                await playAudioWithAudioElement(audioData);
            } catch (fallbackError) {
                console.error('❌ Fallback audio playback failed:', fallbackError);
                pendingAudioQueue.push(audioData);
            }
        } else {
            pendingAudioQueue.push(audioData);
        }
    }
}

async function playAudioWithWebAudio(audioData) {
    try {
        // Verify context is ready
        if (!audioContext || audioContext.state !== 'running') {
            throw new Error('Audio context not running');
        }

        // Convert base64 to byte array
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const samples = new Int16Array(bytes.buffer);

        // Check for valid audio data
        if (samples.length === 0) {
            throw new Error('Empty audio data');
        }

        // Convert to float samples
        const floatSamples = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            floatSamples[i] = samples[i] / (samples[i] < 0 ? 0x8000 : 0x7FFF);
        }

        // Resample from TARGET_SAMPLE_RATE to audioContext.sampleRate if needed using libsamplerate
        let resampledData = floatSamples;
        if (TARGET_SAMPLE_RATE !== audioContext.sampleRate) {
            resampledData = resampleAudio(floatSamples, TARGET_SAMPLE_RATE, audioContext.sampleRate);
        }

        // Create audio buffer with resampled data
        const audioBuffer = audioContext.createBuffer(1, resampledData.length, audioContext.sampleRate);
        audioBuffer.getChannelData(0).set(resampledData);

        // Create buffer source
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        // Store reference for cleanup
        currentPlaybackSource = source;

        // Apply gain with iOS-specific adjustments
        const gainNode = audioContext.createGain();
        let gainValue = 1.0;

        if (isIPhone && !isIOS17Plus) {
            gainValue = 1.2; // Older iPhones need boost
        } else if (isIPad) {
            gainValue = 1.1; // iPads slightly quieter
        }

        gainNode.gain.setValueAtTime(gainValue, audioContext.currentTime);

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Add ended handler for cleanup
        source.onended = () => {
            currentPlaybackSource = null;
        };

        source.start(0);

        console.log('🎵 Web Audio playback - Length:', resampledData.length, 'Gain:', gainValue, 'DSP: libsamplerate');

    } catch (error) {
        console.error('❌ Web Audio playback error:', error);
        throw error;
    }
}

async function playAudioWithAudioElement(audioData) {
    try {
        if (!audioElement) {
            createAudioElement();
        }

        // Check element state
        if (audioElement.error) {
            console.log('Audio element has error, recreating');
            audioElement = null;
            createAudioElement();
        }

        // Convert base64 to byte array
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const samples = new Int16Array(bytes.buffer);

        // Check for valid audio data
        if (samples.length === 0) {
            throw new Error('Empty audio data');
        }

        // Convert to float samples
        const floatSamples = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            floatSamples[i] = samples[i] / (samples[i] < 0 ? 0x8000 : 0x7FFF);
        }

        // Create temporary context if needed (with resampling support)
        const tempContext = audioContext || new (window.AudioContext || window.webkitAudioContext)({ sampleRate: TARGET_SAMPLE_RATE });
        
        // Resample if needed before creating buffer
        let resampledData = floatSamples;
        if (TARGET_SAMPLE_RATE !== tempContext.sampleRate) {
            resampledData = resampleAudio(floatSamples, TARGET_SAMPLE_RATE, tempContext.sampleRate);
        }
        
        const audioBuffer = tempContext.createBuffer(1, resampledData.length, tempContext.sampleRate);
        audioBuffer.getChannelData(0).set(resampledData);

        // Convert to WAV blob
        const wav = audioBufferToWav(audioBuffer);
        const blob = new Blob([wav], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        // Track blob URL for cleanup
        blobUrlCache.add(url);

        // Set source and volume
        audioElement.src = url;
        audioElement.volume = isIPhone ? 1.0 : 0.9;

        return new Promise((resolve, reject) => {
            let playAttempts = 0;
            const maxAttempts = 3;

            const cleanup = () => {
                URL.revokeObjectURL(url);
                blobUrlCache.delete(url);
                audioElement.removeEventListener('ended', onEnded);
                audioElement.removeEventListener('error', onError);
            };

            const onEnded = () => {
                console.log('Audio element playback ended');
                cleanup();
                resolve();
            };

            const onError = (error) => {
                console.error('Audio element error:', error);
                cleanup();
                reject(error);
            };

            const attemptPlay = async () => {
                try {
                    audioElement.addEventListener('ended', onEnded, { once: true });
                    audioElement.addEventListener('error', onError, { once: true });

                    const playPromise = audioElement.play();
                    if (playPromise !== undefined) {
                        await playPromise;
                        console.log('🎵 Audio element playback started');
                    }
                } catch (playError) {
                    playAttempts++;
                    console.error(`Play attempt ${playAttempts} failed:`, playError);

                    if (playAttempts < maxAttempts) {
                        // Wait and retry
                        setTimeout(attemptPlay, 100);
                    } else {
                        cleanup();
                        reject(playError);
                    }
                }
            };

            attemptPlay();
        });

    } catch (error) {
        console.error('❌ Audio element playback error:', error);
        throw error;
    }
}

// Convert AudioBuffer to WAV format with better error handling
function audioBufferToWav(buffer) {
    try {
        const length = buffer.length;
        const numberOfChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
        const view = new DataView(arrayBuffer);

        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * numberOfChannels * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numberOfChannels * 2, true);
        view.setUint16(32, numberOfChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * numberOfChannels * 2, true);

        // Convert float samples to 16-bit PCM
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }

        return arrayBuffer;
    } catch (error) {
        console.error('Error converting to WAV:', error);
        throw error;
    }
}

async function processAudioQueue() {
    if (isProcessingQueue || !audioContext || audioContext.state !== 'running') {
        return;
    }

    isProcessingQueue = true;
    console.log(`🔄 Processing ${pendingAudioQueue.length} queued audio buffers...`);

    const processedCount = 0;
    const maxProcessPerRun = 10; // Limit processing to prevent UI blocking

    while (pendingAudioQueue.length > 0 && processedCount < maxProcessPerRun) {
        const audioData = pendingAudioQueue.shift();
        try {
            if (isWebAudioUnlocked && audioContext.state === 'running') {
                await playAudioWithWebAudio(audioData);
            } else if (isAudioElementUnlocked) {
                await playAudioWithAudioElement(audioData);
            }

            // Adaptive delay based on device
            const delay = isIPhone ? 20 : isIOS ? 15 : 10;
            await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error) {
            console.error('❌ Error processing queued audio:', error);

            // Re-queue on error if we haven't tried too many times
            if (audioData._retryCount === undefined) {
                audioData._retryCount = 0;
            }

            if (audioData._retryCount < 3) {
                audioData._retryCount++;
                pendingAudioQueue.push(audioData);
            }
        }
    }

    isProcessingQueue = false;

    // Schedule next batch if more items
    if (pendingAudioQueue.length > 0) {
        setTimeout(() => processAudioQueue(), 100);
    }

    console.log('✅ Processed audio batch, remaining in queue:', pendingAudioQueue.length);
}

// Cleanup function for memory management
export function cleanup() {
    // Stop recording if active
    stopRecording();

    // Clean up blob URLs
    blobUrlCache.forEach(url => {
        URL.revokeObjectURL(url);
    });
    blobUrlCache.clear();

    // Clear audio queue
    pendingAudioQueue = [];

    // Clean up resampler
    if (resamplerInstance && libsamplerate) {
        try {
            resamplerInstance.destroy();
        } catch (e) {
            console.warn('Error destroying resampler:', e);
        }
        resamplerInstance = null;
    }

    // Close audio context if needed
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }

    // Remove audio element
    if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        audioElement = null;
    }

    console.log('Audio module cleaned up');
}

// Enhanced user interaction handling for iOS
if (typeof window !== 'undefined') {
    console.log('🎧 Audio module loaded for', isIPhone ? 'iPhone' : isIOS ? 'iOS' : 'Other');

    // CRITICAL: These event listeners unlock audio on user interaction
    const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];

    let unlockInProgress = false;

    const unlockAudio = async (event) => {
        // Prevent multiple simultaneous unlocks
        if (unlockInProgress) return;

        // Always try to unlock on iOS, even if previously unlocked
        if (isIOS || !isAudioContextInitialized) {
            unlockInProgress = true;
            console.log('👆 User gesture detected (' + event.type + '), unlocking audio...');

            try {
                // CRITICAL: Call activateAudioContext directly in the event handler
                const success = await activateAudioContext();
                console.log('🔊 Audio unlock result:', success ? '✅ Success' : '❌ Failed');

                // On non-iOS, remove listeners after first success
                if (success && !isIOS) {
                    unlockEvents.forEach(eventType => {
                        document.removeEventListener(eventType, unlockAudio, { capture: true, passive: false });
                    });
                }
            } catch (error) {
                console.error('❌ Error in unlock handler:', error);
            } finally {
                unlockInProgress = false;
            }
        }
    };

    // Add listeners with options for maximum compatibility
    unlockEvents.forEach(event => {
        document.addEventListener(event, unlockAudio, { capture: true, passive: false });
    });

    // iOS-specific: Additional unlock attempts
    if (isIOS) {
        // Try to unlock when page becomes visible
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                console.log('📱 Page became visible');

                // Resume audio context if it was suspended
                if (audioContext && audioContext.state === 'suspended' && isAudioContextInitialized) {
                    try {
                        await audioContext.resume();
                        console.log('Resumed audio context after visibility change');
                    } catch (error) {
                        console.error('Failed to resume audio context:', error);
                    }
                }
            }
        });

        // Monitor page lifecycle
        if ('onpageshow' in window) {
            window.addEventListener('pageshow', (event) => {
                if (event.persisted) {
                    console.log('Page restored from cache');
                    // Reset unlock states as they may be invalid
                    isWebAudioUnlocked = false;
                    isAudioElementUnlocked = false;
                    isAudioContextInitialized = false;
                }
            });
        }

        // Handle beforeunload for cleanup
        window.addEventListener('beforeunload', () => {
            if (audioContext) {
                audioContext.close();
            }
        });
    }
}