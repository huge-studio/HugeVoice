// Audio recording and playback functionality for HugeVoice
// Comprehensive iOS/Safari compatibility with Audio element fallback

let mediaRecorder = null;
let audioContext = null;
let dotNetRef = null;
let isAudioContextInitialized = false;
let pendingAudioQueue = [];
let isProcessingQueue = false;

// iOS audio unlocking - multiple strategies
let audioElement = null;
let isAudioElementUnlocked = false;
let isWebAudioUnlocked = false;

// Enhanced browser/device detection
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isIPhone = /iPhone/.test(navigator.userAgent);
const isIPad = /iPad/.test(navigator.userAgent);

console.log('Audio module loading - Device detection:', {
    isSafari,
    isIOS,
    isIPhone,
    isIPad,
    userAgent: navigator.userAgent
});

// Create Audio element for iOS fallback
function createAudioElement() {
    if (!audioElement) {
        audioElement = new Audio();
        audioElement.preload = 'auto';
        audioElement.crossOrigin = 'anonymous';
        
        // iOS-specific settings
        if (isIOS) {
            audioElement.playsInline = true;
            audioElement.muted = false;
            audioElement.volume = 1.0;
        }
        
        console.log('Audio element created for iOS fallback');
    }
    return audioElement;
}

export async function startRecording(dotNetReference) {
    dotNetRef = dotNetReference;
    
    try {
        // Ensure audio is unlocked before recording
        await ensureAudioUnlocked();
        
        // iPhone-specific audio constraints
        const audioConstraints = {
            audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: isIPhone ? 44100 : isIOS ? 22050 : 16000
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);

        // Initialize audio context if not already done
        if (!audioContext) {
            await initializeAudioContext();
        }

        const source = audioContext.createMediaStreamSource(stream);
        
        // Use smaller buffer sizes for iOS
        const bufferSize = isIPhone ? 1024 : isIOS ? 2048 : 4096;
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        processor.onaudioprocess = async function(event) {
            if (dotNetRef && audioContext.state === 'running') {
                try {
                    const inputData = event.inputBuffer.getChannelData(0);
                    const samples = new Int16Array(inputData.length);
                    
                    // Convert to 16-bit PCM
                    for (let i = 0; i < inputData.length; i++) {
                        const sample = Math.max(-1, Math.min(1, inputData[i]));
                        samples[i] = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
                    }
                    
                    const bytes = new Uint8Array(samples.buffer);
                    const base64String = btoa(String.fromCharCode.apply(null, bytes));
                    
                    await dotNetRef.invokeMethodAsync('SendAudioData', base64String);
                } catch (error) {
                    console.error('Error processing audio data:', error);
                }
            }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        
        console.log('Recording started - Device:', isIPhone ? 'iPhone' : isIOS ? 'iOS' : 'Other');
        
    } catch (error) {
        console.error('Error starting recording:', error);
        throw error;
    }
}

export function stopRecording() {
    if (audioContext && audioContext.state !== 'closed') {
        // Don't close the context, just suspend it for reuse
        audioContext.suspend();
    }
    dotNetRef = null;
    console.log('Recording stopped');
}

async function initializeAudioContext() {
    try {
        // Use optimal sample rate for each device
        const sampleRate = isIPhone ? 44100 : isIOS ? 22050 : 16000;
        
        const contextOptions = {
            sampleRate: sampleRate,
            latencyHint: 'interactive'
        };

        // Always prefer webkitAudioContext on iOS
        if (isIOS) {
            audioContext = new (window.webkitAudioContext || window.AudioContext)(contextOptions);
            console.log('Created webkitAudioContext for iOS');
        } else {
            audioContext = new (window.AudioContext || window.webkitAudioContext)(contextOptions);
        }

        console.log('Audio context created with sample rate:', audioContext.sampleRate);
        
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
        
        // Step 1: Initialize audio context if needed
        if (!audioContext) {
            await initializeAudioContext();
        }
        
        // Step 2: Resume audio context (MUST be in user gesture)
        if (audioContext.state === 'suspended') {
            console.log('📱 Resuming suspended audio context...');
            await audioContext.resume();
            console.log('✅ Audio context resumed:', audioContext.state);
        }
        
        // Step 3: Unlock Web Audio API (MUST be in user gesture)
        await unlockWebAudio();
        
        // Step 4: Unlock Audio element (MUST be in user gesture)  
        await unlockAudioElement();
        
        isAudioContextInitialized = true;
        console.log('🎉 Audio fully activated! WebAudio:', isWebAudioUnlocked, 'AudioElement:', isAudioElementUnlocked);
        
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
        
        // Create multiple silent buffers to ensure unlock
        for (let i = 0; i < 5; i++) {
            const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            
            // Use very quiet but not completely silent audio
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
            
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            source.start(audioContext.currentTime);
            
            // No delays - iOS requires immediate execution
        }
        
        // Additional unlock attempt with oscillator
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.01);
        
        isWebAudioUnlocked = true;
        console.log('✅ Web Audio API unlocked');
        
    } catch (error) {
        console.error('❌ Error unlocking Web Audio API:', error);
    }
}

// CRITICAL: Must be called directly in user gesture
async function unlockAudioElement() {
    if (isAudioElementUnlocked) return;
    
    try {
        console.log('🔓 Unlocking Audio element...');
        
        // Create audio element if not exists
        createAudioElement();
        
        // Create a tiny silent audio file as blob
        const audioBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
        
        // Convert to WAV blob for Audio element
        const wav = audioBufferToWav(audioBuffer);
        const blob = new Blob([wav], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        
        // Play through Audio element to unlock it
        audioElement.src = url;
        
        // CRITICAL: play() must be called directly in user gesture
        const playPromise = audioElement.play();
        
        if (playPromise !== undefined) {
            try {
                await playPromise;
                audioElement.pause();
                audioElement.currentTime = 0;
                console.log('✅ Audio element unlocked via play()');
            } catch (playError) {
                console.log('⚠️ Audio element play failed:', playError.name);
            }
        }
        
        // Clean up blob URL
        URL.revokeObjectURL(url);
        
        isAudioElementUnlocked = true;
        
    } catch (error) {
        console.error('❌ Error unlocking Audio element:', error);
    }
}

// Ensure both Web Audio and Audio element are unlocked
async function ensureAudioUnlocked() {
    if (!isWebAudioUnlocked || !isAudioElementUnlocked) {
        console.log('⚠️ Audio not fully unlocked, waiting for user interaction...');
        return false;
    }
    return true;
}

export async function playAudio(audioData) {
    try {
        // If not fully unlocked, queue the audio
        if (!isAudioContextInitialized || !audioContext || audioContext.state !== 'running') {
            console.log('🔄 Audio not ready, queuing audio data. Context state:', audioContext?.state);
            pendingAudioQueue.push(audioData);
            return;
        }

        // Try Web Audio API first, fallback to Audio element
        if (isWebAudioUnlocked) {
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
        if (isAudioElementUnlocked) {
            try {
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
        // Convert base64 to byte array
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const samples = new Int16Array(bytes.buffer);
        
        // Convert to float samples - let browser handle resampling
        const floatSamples = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            floatSamples[i] = samples[i] / (samples[i] < 0 ? 0x8000 : 0x7FFF);
        }

        // Create audio buffer - use 16kHz as source rate
        const audioBuffer = audioContext.createBuffer(1, floatSamples.length, 16000);
        audioBuffer.getChannelData(0).set(floatSamples);

        // Create buffer source
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        // Apply gain
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(isIPhone ? 1.2 : 1.0, audioContext.currentTime);
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        source.start(0);
        
        console.log('🎵 Web Audio playback - Length:', floatSamples.length);
        
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

        // Convert base64 to byte array
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const samples = new Int16Array(bytes.buffer);
        
        // Convert to float samples
        const floatSamples = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            floatSamples[i] = samples[i] / (samples[i] < 0 ? 0x8000 : 0x7FFF);
        }

        // Create audio buffer for WAV conversion
        const tempContext = audioContext || new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const audioBuffer = tempContext.createBuffer(1, floatSamples.length, 16000);
        audioBuffer.getChannelData(0).set(floatSamples);
        
        // Convert to WAV blob
        const wav = audioBufferToWav(audioBuffer);
        const blob = new Blob([wav], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        
        // Play through Audio element
        audioElement.src = url;
        
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                URL.revokeObjectURL(url);
                audioElement.removeEventListener('ended', onEnded);
                audioElement.removeEventListener('error', onError);
            };
            
            const onEnded = () => {
                cleanup();
                resolve();
            };
            
            const onError = (error) => {
                cleanup();
                reject(error);
            };
            
            audioElement.addEventListener('ended', onEnded);
            audioElement.addEventListener('error', onError);
            
            const playPromise = audioElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(reject);
            }
        });
        
        console.log('🎵 Audio element playback - Length:', floatSamples.length);
        
    } catch (error) {
        console.error('❌ Audio element playback error:', error);
        throw error;
    }
}

// Convert AudioBuffer to WAV format
function audioBufferToWav(buffer) {
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
}

async function processAudioQueue() {
    if (isProcessingQueue || !audioContext || audioContext.state !== 'running') {
        return;
    }

    isProcessingQueue = true;
    console.log(`🔄 Processing ${pendingAudioQueue.length} queued audio buffers...`);

    while (pendingAudioQueue.length > 0) {
        const audioData = pendingAudioQueue.shift();
        try {
            if (isWebAudioUnlocked) {
                await playAudioWithWebAudio(audioData);
            } else if (isAudioElementUnlocked) {
                await playAudioWithAudioElement(audioData);
            }
            
            // Small delay to prevent overwhelming the audio system
            await new Promise(resolve => setTimeout(resolve, isIPhone ? 20 : 10));
        } catch (error) {
            console.error('❌ Error processing queued audio:', error);
        }
    }

    isProcessingQueue = false;
    console.log('✅ Finished processing audio queue');
}

// Enhanced user interaction handling for iOS
if (typeof window !== 'undefined') {
    console.log('🎧 Audio module loaded for', isIPhone ? 'iPhone' : isIOS ? 'iOS' : 'Other');
    
    // CRITICAL: These event listeners unlock audio on EVERY interaction
    const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
    
    const unlockAudio = async (event) => {
        // Always try to unlock on iOS, even if previously unlocked
        if (isIOS || !isAudioContextInitialized) {
            console.log('👆 User gesture detected (' + event.type + '), unlocking audio...');
            
            try {
                // CRITICAL: Call activateAudioContext directly in the event handler
                const success = await activateAudioContext();
                console.log('🔊 Audio unlock result:', success ? '✅ Success' : '❌ Failed');
                
                // On non-iOS, remove listeners after first success
                if (success && !isIOS) {
                    unlockEvents.forEach(eventType => {
                        document.removeEventListener(eventType, unlockAudio, true);
                    });
                }
            } catch (error) {
                console.error('❌ Error in unlock handler:', error);
            }
        }
    };
    
    // Add listeners with capture=true for maximum compatibility
    unlockEvents.forEach(event => {
        document.addEventListener(event, unlockAudio, true);
    });
    
    // iOS-specific: Additional unlock attempts
    if (isIOS) {
        // Try to unlock when page becomes visible
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                console.log('📱 Page became visible, checking audio unlock...');
                if (!isAudioContextInitialized) {
                    console.log('⚠️ Audio not unlocked, waiting for user gesture...');
                }
            }
        });
        
        // Try to unlock on focus
        window.addEventListener('focus', async () => {
            if (!isAudioContextInitialized) {
                console.log('🔍 Window focused, audio needs user gesture...');
            }
        });
    }
}