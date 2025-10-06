// Audio recording and playback functionality for HugeVoice
// Enhanced with Safari/iOS compatibility

let mediaRecorder = null;
let audioContext = null;
let audioWorklet = null;
let dotNetRef = null;
let isAudioContextInitialized = false;
let pendingAudioQueue = [];
let isProcessingQueue = false;

// Safari/iOS specific detection
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

export async function startRecording(dotNetReference) {
    dotNetRef = dotNetReference;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                sampleSize: 16,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        // Initialize audio context if not already done
        if (!audioContext) {
            await initializeAudioContext();
        }

        const source = audioContext.createMediaStreamSource(stream);
        
        // Use different processing approach for Safari vs other browsers
        if (isSafari || isIOS) {
            // Safari works better with smaller buffer sizes
            const processor = audioContext.createScriptProcessor(2048, 1, 1);
            
            processor.onaudioprocess = async function(event) {
                if (dotNetRef && audioContext.state === 'running') {
                    try {
                        const inputData = event.inputBuffer.getChannelData(0);
                        const samples = new Int16Array(inputData.length);
                        
                        // Convert float32 to int16 with proper clamping
                        for (let i = 0; i < inputData.length; i++) {
                            const sample = Math.max(-1, Math.min(1, inputData[i]));
                            samples[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                        }
                        
                        // Convert to byte array and send as base64 string
                        const bytes = new Uint8Array(samples.buffer);
                        const base64String = btoa(String.fromCharCode.apply(null, bytes));
                        
                        // Send to .NET
                        await dotNetRef.invokeMethodAsync('SendAudioData', base64String);
                    } catch (error) {
                        console.error('Error processing audio data:', error);
                    }
                }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
        } else {
            // Standard approach for Chrome/Firefox
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = async function(event) {
                if (dotNetRef) {
                    try {
                        const inputData = event.inputBuffer.getChannelData(0);
                        const samples = new Int16Array(inputData.length);
                        
                        // Convert float32 to int16
                        for (let i = 0; i < inputData.length; i++) {
                            samples[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
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
        }
        
        console.log('Recording started - Browser:', isSafari ? 'Safari' : isIOS ? 'iOS' : 'Other');
        
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
        // Safari requires specific audio context configuration
        const contextOptions = {
            sampleRate: 16000
        };

        // Safari/iOS specific context creation
        if (isSafari || isIOS) {
            // iOS Safari requires webkitAudioContext
            audioContext = new (window.AudioContext || window.webkitAudioContext)(contextOptions);
        } else {
            audioContext = new AudioContext(contextOptions);
        }

        // Always start in suspended state due to autoplay policies
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        isAudioContextInitialized = true;
        console.log('Audio context initialized:', audioContext.state, 'Browser:', isSafari ? 'Safari' : isIOS ? 'iOS' : 'Other');
        
        // Process any queued audio
        if (pendingAudioQueue.length > 0) {
            processAudioQueue();
        }
        
        return true;
    } catch (error) {
        console.error('Error initializing audio context:', error);
        return false;
    }
}

export async function activateAudioContext() {
    try {
        console.log('Activating audio context with user interaction...');
        
        // Initialize if not already done
        if (!audioContext) {
            await initializeAudioContext();
        }
        
        // Resume audio context if it's suspended (required by browser autoplay policies)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('Audio context resumed from suspended state');
        }
        
        // For Safari/iOS, we need to play a silent audio buffer to "unlock" audio
        if ((isSafari || isIOS) && audioContext.state === 'running') {
            await unlockAudioContextForSafari();
        }
        
        isAudioContextInitialized = true;
        console.log('Audio context activated:', audioContext.state);
        
        // Process any queued audio after activation
        if (pendingAudioQueue.length > 0) {
            processAudioQueue();
        }
        
        return true;
    } catch (error) {
        console.error('Error activating audio context:', error);
        return false;
    }
}

async function unlockAudioContextForSafari() {
    try {
        // Create a silent buffer and play it to unlock audio on Safari/iOS
        const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        
        console.log('Safari/iOS audio context unlocked');
        return true;
    } catch (error) {
        console.error('Error unlocking Safari audio context:', error);
        return false;
    }
}

export async function playAudio(audioData) {
    try {
        // If audio context isn't ready, queue the audio for later
        if (!audioContext || audioContext.state !== 'running') {
            console.log('Audio context not ready, queuing audio data');
            pendingAudioQueue.push(audioData);
            
            // Try to initialize if not already done
            if (!isAudioContextInitialized) {
                console.log('Audio context not initialized, waiting for user interaction');
                return;
            }
            return;
        }

        await playAudioBuffer(audioData);
        
    } catch (error) {
        console.error('Error playing audio:', error);
        // Queue the audio if it failed to play
        pendingAudioQueue.push(audioData);
    }
}

async function playAudioBuffer(audioData) {
    // Convert base64 string back to byte array
    let bytes;
    if (typeof audioData === 'string') {
        // If it's a base64 string, decode it
        const binaryString = atob(audioData);
        bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
    } else {
        // If it's already a byte array
        bytes = new Uint8Array(audioData);
    }

    const samples = new Int16Array(bytes.buffer);
    const floatSamples = new Float32Array(samples.length);
    
    // Convert int16 to float32
    for (let i = 0; i < samples.length; i++) {
        floatSamples[i] = samples[i] / (samples[i] < 0 ? 0x8000 : 0x7FFF);
    }

    // Create and play audio buffer
    const audioBuffer = audioContext.createBuffer(1, floatSamples.length, 16000);
    audioBuffer.getChannelData(0).set(floatSamples);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Add a gain node for volume control (Safari sometimes needs this)
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    source.start();
}

async function processAudioQueue() {
    if (isProcessingQueue || !audioContext || audioContext.state !== 'running') {
        return;
    }

    isProcessingQueue = true;
    console.log(`Processing ${pendingAudioQueue.length} queued audio buffers`);

    while (pendingAudioQueue.length > 0) {
        const audioData = pendingAudioQueue.shift();
        try {
            await playAudioBuffer(audioData);
            // Small delay between buffers for Safari
            if (isSafari || isIOS) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        } catch (error) {
            console.error('Error processing queued audio:', error);
        }
    }

    isProcessingQueue = false;
}

// Auto-initialize audio context when the module loads (but it will be suspended)
if (typeof window !== 'undefined') {
    // Wait for page load to initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            // Don't auto-initialize, wait for user interaction
            console.log('Audio module loaded, waiting for user interaction to initialize');
        });
    } else {
        console.log('Audio module loaded, waiting for user interaction to initialize');
    }
    
    // Add event listeners for user interaction to unlock audio
    const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'keydown'];
    const unlockAudio = async () => {
        if (!isAudioContextInitialized) {
            console.log('User interaction detected, attempting to unlock audio');
            await activateAudioContext();
            
            // Remove listeners after first interaction
            unlockEvents.forEach(event => {
                document.removeEventListener(event, unlockAudio, true);
            });
        }
    };
    
    unlockEvents.forEach(event => {
        document.addEventListener(event, unlockAudio, true);
    });
}