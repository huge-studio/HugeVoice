// Audio recording and playback functionality for HugeVoice
// Enhanced iOS/Safari compatibility with additional safety checks
// DSP powered by libsamplerate.js for high-quality audio resampling
// Audio processing offloaded to Web Worker for better performance
// SignalR hub integration in JS to minimize interop

let mediaRecorder = null;
let audioContext = null;
let isAudioContextInitialized = false;
let pendingAudioQueue = [];
let isProcessingQueue = false;

// SignalR hub connection (managed in JS)
let hubConnection = null;
let currentChannelId = null;
let isRecording = false;
let hasBroadcasterRole = false; // Track if we successfully obtained broadcaster role

// Web Worker for audio processing
let audioWorker = null;
let workerInitialized = false;

// libsamplerate.js integration (for playback only, recording uses worker)
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

// Initialize SignalR hub connection
async function initializeHub(hubUrl) {
    // If we already have a connected hub for this URL, reuse it
    if (hubConnection && hubConnection.state === 'Connected' && hubConnection.baseUrl === hubUrl) {
        console.log('✅ Reusing existing hub connection');
        return hubConnection;
    }

    // Clean up any existing connection first
    if (hubConnection) {
        console.log('⚠️ Cleaning up existing hub connection before creating new one');
        try {
            if (currentChannelId) {
                await hubConnection.invoke('LeaveRoom', currentChannelId).catch(() => {});
            }
            await hubConnection.stop();
        } catch (e) {
            console.warn('Error stopping old connection:', e);
        }
        hubConnection = null;
    }

    try {
        console.log('🔌 Initializing SignalR hub connection...');
        
        // SignalR should be loaded from CDN in index.html
        if (!window.signalR) {
            throw new Error('SignalR not available. Please ensure the SignalR script is loaded in index.html');
        }
        
        const signalR = window.signalR;
        
        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl)
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();
        
        // Store the base URL for comparison
        hubConnection.baseUrl = hubUrl;

        // Setup hub event handlers
        hubConnection.on('ReceiveAudioChunk', (audioData) => {
            // Queue audio for playback
            if (audioData && audioData.length > 0) {
                const base64Audio = btoa(String.fromCharCode.apply(null, audioData));
                playAudio(base64Audio);
            }
        });

        hubConnection.on('BroadcastError', (message) => {
            console.error('❌ Broadcast error from server:', message);
        });

        hubConnection.onreconnecting(() => {
            console.log('🔄 Hub reconnecting...');
        });

        hubConnection.onreconnected(async () => {
            console.log('✅ Hub reconnected');
            if (currentChannelId && isRecording) {
                console.log(`Rejoining room ${currentChannelId} after reconnection`);
                try {
                    await hubConnection.invoke('JoinRoom', currentChannelId, true);
                    await hubConnection.invoke('RequestBroadcasterRole', currentChannelId);
                } catch (e) {
                    console.error('Error rejoining after reconnection:', e);
                }
            }
        });

        hubConnection.onclose((error) => {
            console.log('❌ Hub connection closed', error);
            if (isRecording) {
                console.error('Hub closed while recording - stopping recording');
                stopRecording();
            }
        });

        await hubConnection.start();
        console.log('✅ SignalR hub connected. Connection ID:', hubConnection.connectionId);
        
        return hubConnection;
    } catch (error) {
        console.error('❌ Failed to initialize hub:', error);
        hubConnection = null;
        throw error;
    }
}

// Initialize Web Worker for audio processing
async function initializeAudioWorker() {
    if (audioWorker && workerInitialized) return true;
    
    try {
        console.log('🔧 Initializing audio processing worker...');
        
        audioWorker = new Worker('audio-processor.worker.js');
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Worker initialization timeout'));
            }, 5000);

            audioWorker.onmessage = function(e) {
                const { type, success, error } = e.data;
                
                if (type === 'init-complete') {
                    clearTimeout(timeout);
                    workerInitialized = success;
                    if (success) {
                        console.log('✅ Audio worker initialized successfully');
                        resolve(true);
                    } else {
                        reject(new Error('Worker initialization failed'));
                    }
                }
            };

            audioWorker.onerror = function(error) {
                clearTimeout(timeout);
                console.error('❌ Audio worker error:', error);
                reject(error);
            };

            // Initialize the worker
            audioWorker.postMessage({ type: 'init' });
        });
    } catch (error) {
        console.error('❌ Failed to initialize audio worker:', error);
        throw error;
    }
}

// Initialize libsamplerate (for playback only)
async function initializeLibsamplerate() {
    if (libsamplerate) return true;
    
    try {
        console.log('🎛️ Initializing libsamplerate.js for playback...');
        
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

// Resample audio data using libsamplerate (for playback only)
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
            converterType: libsamplerate.SRC_SINC_FASTEST
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
            audioElement.setAttribute('playsinline', '' );
            audioElement.setAttribute('webkit-playsinline', '' );
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

// Monitor audio interruptions (iOS and general tab visibility)
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', async () => {
        if (document.hidden) {
            console.log('⚠️ Page hidden - audio context may be suspended');
            if (audioContext && audioContext.state === 'running') {
                console.log('Audio context is still running while hidden');
                // Don't suspend - let it continue
            }
        } else {
            console.log('✅ Page visible again');
            // Resume audio context if it was suspended
            if (audioContext && audioContext.state === 'suspended' && isAudioContextInitialized) {
                try {
                    await audioContext.resume();
                    console.log('Resumed audio context after visibility change');
                } catch (error) {
                    console.error('Failed to resume audio context:', error);
                }
            }
            
            // If we were recording, make sure recording continues
            if (isRecording && audioContext && audioContext.state === 'running') {
                console.log('Recording should continue - audio context is running');
            }
        }
    });

    // Handle audio session interruptions (especially important for mobile)
    window.addEventListener('blur', () => {
        console.log('⚠️ Window blur detected');
        if (isRecording) {
            console.log('Recording active during blur - keeping audio context alive');
            // Prevent suspension by keeping context running
            if (audioContext && audioContext.state === 'running') {
                // Play a silent buffer to keep context active
                try {
                    const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
                    const source = audioContext.createBufferSource();
                    source.buffer = buffer;
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 0;
                    source.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    source.start();
                } catch (e) {
                    console.log('Could not play keepalive buffer:', e);
                }
            }
        }
    });

    window.addEventListener('focus', async () => {
        console.log('✅ Window focused');
        if (isRecording && audioContext) {
            if (audioContext.state === 'suspended') {
                console.log('Resuming suspended audio context on focus');
                try {
                    await audioContext.resume();
                    console.log('Audio context resumed successfully');
                } catch (error) {
                    console.error('Failed to resume audio context:', error);
                }
            } else {
                console.log('Audio context state:', audioContext.state);
            }
        }
    });

    // Additional iOS-specific handling
    if (isIOS) {
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
            cleanup();
        });
    }
}

// Start recording with SignalR integration in JS
export async function startRecording(channelId, hubUrl) {
    try {
        currentChannelId = channelId;
        hasBroadcasterRole = false;
        
        console.log(`🎙️ Starting recording for channel: ${channelId}`);
        
        // Initialize hub connection
        await initializeHub(hubUrl);
        
        if (!hubConnection || hubConnection.state !== 'Connected') {
            throw new Error('Hub connection failed');
        }
        
        console.log(`Hub connection state: ${hubConnection.state}, Connection ID: ${hubConnection.connectionId}`);
        
        // Join room as broadcaster through JavaScript connection
        console.log(`Joining room ${channelId} as broadcaster through JS hub`);
        await hubConnection.invoke('JoinRoom', channelId, true);
        console.log(`✅ Joined room successfully`);
        
        // Request broadcaster role through JavaScript connection
        console.log(`Requesting broadcaster role for ${channelId} through JS hub`);
        const canBroadcast = await hubConnection.invoke('RequestBroadcasterRole', channelId);
        
        if (!canBroadcast) {
            throw new Error('Failed to obtain broadcaster role - another broadcaster may be active');
        }
        
        hasBroadcasterRole = true;
        console.log(`✅ Successfully obtained broadcaster role for ${channelId}`);
        console.log(`My connection ID: ${hubConnection.connectionId}`);
        
        // Test hub method availability
        try {
            console.log('🧪 Testing SendAudioChunkBase64 method...');
            // Send a test chunk to verify the method works
            const testBase64 = btoa(String.fromCharCode(0, 0, 0, 0)); // Tiny silent test
            await hubConnection.invoke('SendAudioChunkBase64', channelId, testBase64);
            console.log('✅ SendAudioChunkBase64 method verified working');
        } catch (testError) {
            console.error('❌ SendAudioChunkBase64 test failed:', testError);
            throw new Error(`Cannot send audio - hub method test failed: ${testError.message}`);
        }
        
        // Initialize audio worker for processing
        await initializeAudioWorker();
        
        // Initialize libsamplerate for playback
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
        
        console.log(`🎤 Recording setup: ${sourceSampleRate}Hz → ${TARGET_SAMPLE_RATE}Hz (Web Worker)`);

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
        let processingQueue = [];
        let isProcessingWorkerMessage = false;
        let lastProcessTime = Date.now();
        let keepaliveInterval = null;
        let consecutiveErrors = 0; // Track consecutive errors vs total
        let totalChunksProcessed = 0;
        let totalChunksSent = 0;

        // Keepalive mechanism to prevent browser from suspending processing
        keepaliveInterval = setInterval(() => {
            const timeSinceLastProcess = Date.now() - lastProcessTime;
            if (timeSinceLastProcess > 1000 && isRecording) {
                console.warn('⚠️ No audio processed in 1 second - checking state');
                console.log('Audio context state:', audioContext.state);
                console.log('Worker initialized:', workerInitialized);
                console.log('Hub connection state:', hubConnection?.state);
                console.log('Total chunks processed:', totalChunksProcessed);
                console.log('Total chunks sent:', totalChunksSent);
                console.log('Processing queue size:', processingQueue.length);
                console.log('Consecutive errors:', consecutiveErrors);
                
                // Try to resume if suspended
                if (audioContext.state === 'suspended') {
                    console.log('Attempting to resume suspended audio context');
                    audioContext.resume().catch(e => console.error('Resume failed:', e));
                }
                
                // Check hub connection
                if (hubConnection && hubConnection.state !== 'Connected') {
                    console.error('❌ Hub connection lost! State:', hubConnection.state);
                }
            }
        }, 2000); // Check every 2 seconds

        // Setup worker message handler
        audioWorker.onmessage = async function(e) {
            const { type, result, error } = e.data;
            
            if (type === 'processed') {
                lastProcessTime = Date.now(); // Update last process time
                totalChunksProcessed++;
                
                if (!result.silent && hubConnection && hasBroadcasterRole) {
                    try {
                        // Check hub connection state before sending
                        if (hubConnection.state !== 'Connected') {
                            console.error('❌ Cannot send audio - hub not connected. State:', hubConnection.state);
                            consecutiveErrors++;
                            if (consecutiveErrors >= maxErrors) {
                                console.error('Too many connection errors, stopping recording');
                                stopRecording();
                            }
                            return;
                        }
                        
                        // Verify we still have broadcaster role
                        if (!hasBroadcasterRole) {
                            console.error('❌ Cannot send audio - no longer have broadcaster role');
                            consecutiveErrors++;
                            if (consecutiveErrors >= maxErrors) {
                                console.error('Lost broadcaster role, stopping recording');
                                stopRecording();
                            }
                            return;
                        }
                        
                        // Convert base64 to byte array for SignalR
                        // Send as base64 string instead of byte array to avoid serialization issues
                        const base64Audio = result.base64Audio;
                        
                        // Validate data before sending
                        if (!base64Audio || base64Audio.length === 0) {
                            console.warn('⚠️ Skipping empty audio chunk');
                            return;
                        }
                        
                        // Log first send for debugging
                        if (totalChunksSent === 0) {
                            console.log(`📤 Sending first audio chunk. Base64 length: ${base64Audio.length}`);
                            console.log(`Channel: ${channelId}, Connection: ${hubConnection.connectionId}`);
                        }
                        
                        // Send directly to SignalR hub with base64 string
                        await hubConnection.invoke('SendAudioChunkBase64', channelId, base64Audio);
                        totalChunksSent++;
                        
                        // Log progress every 50 chunks
                        if (totalChunksSent % 50 === 0) {
                            console.log(`📡 Sent ${totalChunksSent} audio chunks successfully`);
                        }
                        
                        consecutiveErrors = 0; // Reset consecutive error count on success
                        errorCount = 0; // Reset total error count on success
                    } catch (error) {
                        errorCount++;
                        consecutiveErrors++;
                        console.error('❌ Error sending audio data to hub:', error);
                        console.error('Hub state:', hubConnection?.state);
                        console.error('Connection ID:', hubConnection?.connectionId);
                        console.error('Has broadcaster role:', hasBroadcasterRole);
                        console.error('Consecutive errors:', consecutiveErrors, '/ Total errors:', errorCount);
                        
                        // Only stop if we have many consecutive errors
                        if (consecutiveErrors >= maxErrors) {
                            console.error('Too many consecutive errors, stopping recording');
                            stopRecording();
                        }
                    }
                } else if (!hasBroadcasterRole) {
                    console.warn('⚠️ Processed audio but no broadcaster role - skipping send');
                }
                
                // Process next item in queue
                if (processingQueue.length > 0) {
                    const nextItem = processingQueue.shift();
                    audioWorker.postMessage({
                        type: 'process',
                        data: nextItem
                    });
                } else {
                    isProcessingWorkerMessage = false;
                }
            } else if (type === 'error') {
                console.error('Worker processing error:', error);
                consecutiveErrors++;
                
                // Don't stop for worker errors - they might be transient
                // Just log and continue
                console.warn(`Worker error occurred (consecutive: ${consecutiveErrors}), continuing...`);
                isProcessingWorkerMessage = false;
                
                // Only stop if worker is completely broken
                if (consecutiveErrors >= maxErrors * 2) {
                    console.error('Worker appears to be broken, stopping recording');
                    stopRecording();
                }
            }
        };

        processor.onaudioprocess = function (event) {
            if (audioContext.state === 'running' && workerInitialized && isRecording) {
                lastProcessTime = Date.now(); // Update last process time
                
                const inputData = event.inputBuffer.getChannelData(0);
                
                // Create transferable copy of audio data
                const audioDataCopy = new Float32Array(inputData);
                
                const workerMessage = {
                    audioData: audioDataCopy,
                    sampleRate: sourceSampleRate
                };
                
                if (isProcessingWorkerMessage) {
                    // Queue if worker is busy
                    processingQueue.push(workerMessage);
                    
                    // Limit queue size to prevent memory issues
                    if (processingQueue.length > 20) {
                        const dropped = processingQueue.shift();
                        console.warn('⚠️ Dropped audio chunk due to queue overflow. Queue size:', processingQueue.length);
                    }
                } else {
                    // Send to worker for processing
                    isProcessingWorkerMessage = true;
                    try {
                        audioWorker.postMessage({
                            type: 'process',
                            data: workerMessage
                        }, [audioDataCopy.buffer]); // Transfer ownership
                    } catch (error) {
                        console.error('Failed to send to worker:', error);
                        isProcessingWorkerMessage = false;
                        consecutiveErrors++;
                    }
                }
            } else {
                // Log why we're not processing
                if (!isRecording) {
                    console.log('Not processing - isRecording is false');
                } else if (audioContext.state !== 'running') {
                    console.warn('Not processing - audio context state:', audioContext.state);
                } else if (!workerInitialized) {
                    console.warn('Not processing - worker not initialized');
                }
            }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        // Store references for cleanup
        window.currentAudioStream = stream;
        window.currentProcessor = processor;
        window.currentSource = source;
        window.currentKeepaliveInterval = keepaliveInterval;
        
        isRecording = true;

        console.log('Recording started - Device:', isIPhone ? 'iPhone' : isIOS ? 'iOS' : 'Other', 'Buffer size:', bufferSize, 'Processing: Web Worker + SignalR JS');
        
        // Log a reminder about tab visibility
        if (document.hidden) {
            console.warn('⚠️ WARNING: Recording started in a hidden tab. Some browsers may throttle audio processing.');
        } else {
            console.log('✅ Recording started in visible tab - optimal performance');
        }
        
        return { success: true };

    } catch (error) {
        console.error('Error starting recording:', error);
        // Clean up on error
        if (window.currentAudioStream) {
            window.currentAudioStream.getTracks().forEach(track => track.stop());
        }
        isRecording = false;
        throw error;
    }
}

export function stopRecording() {
    isRecording = false;
    hasBroadcasterRole = false;
    
    console.log(`🛑 Stopping recording for channel: ${currentChannelId}`);
    
    // Stop keepalive interval
    if (window.currentKeepaliveInterval) {
        clearInterval(window.currentKeepaliveInterval);
        window.currentKeepaliveInterval = null;
    }
    
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

    // Clean up resampler (if used for direct processing)
    if (resamplerInstance && libsamplerate) {
        try {
            resamplerInstance.destroy();
        } catch (e) {
            console.warn('Error destroying resampler:', e);
        }
        resamplerInstance = null;
    }

    // Release broadcaster role through JavaScript hub connection
    if (hubConnection && currentChannelId) {
        try {
            console.log(`Releasing broadcaster role for ${currentChannelId}`);
            hubConnection.invoke('ReleaseBroadcasterRole', currentChannelId)
                .then(() => {
                    console.log('✅ Broadcaster role released');
                    hasBroadcasterRole = false;
                })
                .catch(e => console.error('❌ Error releasing broadcaster role:', e));
        } catch (e) {
            console.warn('Error releasing broadcaster role:', e);
        }
    }

    // Don't suspend or close context - keep it ready for next session
    // This prevents the context from being in suspended state when user starts again
    if (audioContext && audioContext.state !== 'closed') {
        // Keep context running for faster restart
        console.log('Keeping audio context running for next session');
    }

    console.log('✅ Recording stopped');
    
    return { success: true };
}

// Join a listening room
export async function joinListeningRoom(channelId, hubUrl) {
    try {
        currentChannelId = channelId;
        
        // Initialize hub connection
        await initializeHub(hubUrl);
        
        // Join room as listener
        await hubConnection.invoke('JoinRoom', channelId, false);
        
        console.log(`✅ Joined listening room: ${channelId}`);
        
        return { success: true };
    } catch (error) {
        console.error('❌ Error joining listening room:', error);
        throw error;
    }
}

// Leave current room
export async function leaveRoom() {
    if (hubConnection && currentChannelId) {
        try {
            await hubConnection.invoke('LeaveRoom', currentChannelId);
            currentChannelId = null;
            console.log('✅ Left room');
        } catch (error) {
            console.error('❌ Error leaving room:', error);
        }
    }
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
        writeString(12, 'fmt ' );
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

    // Leave room and release broadcaster role
    if (hubConnection && currentChannelId) {
        try {
            hubConnection.invoke('ReleaseBroadcasterRole', currentChannelId).catch(e => 
                console.warn('Error releasing broadcaster role during cleanup:', e)
            );
        } catch (e) {
            console.warn('Error in cleanup broadcaster role:', e);
        }
    }

    // Leave room
    leaveRoom();

    // Close hub connection
    if (hubConnection) {
        try {
            hubConnection.stop();
            hubConnection = null;
            console.log('SignalR hub disconnected');
        } catch (e) {
            console.warn('Error disconnecting hub:', e);
        }
    }

    // Terminate worker
    if (audioWorker) {
        try {
            audioWorker.postMessage({ type: 'terminate' });
            audioWorker.terminate();
            audioWorker = null;
            workerInitialized = false;
            console.log('Audio worker terminated');
        } catch (e) {
            console.warn('Error terminating worker:', e);
        }
    }

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

// Diagnostic function - can be called from console
export function getDiagnostics() {
    const diagnostics = {
        isRecording: isRecording,
        hasBroadcasterRole: hasBroadcasterRole,
        currentChannelId: currentChannelId,
        audioContextState: audioContext?.state,
        audioContextSampleRate: audioContext?.sampleRate,
        workerInitialized: workerInitialized,
        hubConnectionState: hubConnection?.state,
        hubConnectionId: hubConnection?.connectionId,
        hubBaseUrl: hubConnection?.baseUrl,
        isAudioContextInitialized: isAudioContextInitialized,
        isWebAudioUnlocked: isWebAudioUnlocked,
        isAudioElementUnlocked: isAudioElementUnlocked,
        pendingAudioQueueLength: pendingAudioQueue.length,
        deviceInfo: {
            isSafari: isSafari,
            isIOS: isIOS,
            isIPhone: isIPhone,
            isIPad: isIPad,
            iosVersion: iosVersion,
            userAgent: navigator.userAgent
        },
        visibility: {
            documentHidden: document.hidden,
            visibilityState: document.visibilityState
        },
        streamInfo: {
            hasStream: !!window.currentAudioStream,
            streamActive: window.currentAudioStream?.active,
            trackCount: window.currentAudioStream?.getTracks().length,
            tracks: window.currentAudioStream?.getTracks().map(t => ({
                kind: t.kind,
                enabled: t.enabled,
                muted: t.muted,
                readyState: t.readyState
            }))
        }
    };
    
    console.log('🔍 HugeVoice Audio Diagnostics:', diagnostics);
    return diagnostics;
}

// Make diagnostic function available globally for debugging
if (typeof window !== 'undefined') {
    window.getAudioDiagnostics = getDiagnostics;
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
}