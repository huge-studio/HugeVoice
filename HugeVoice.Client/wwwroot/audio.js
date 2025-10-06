// Audio recording and playback functionality for HugeVoice
// Enhanced with Safari/iOS compatibility and iPhone-specific fixes

let mediaRecorder = null;
let audioContext = null;
let audioWorklet = null;
let dotNetRef = null;
let isAudioContextInitialized = false;
let pendingAudioQueue = [];
let isProcessingQueue = false;
let audioContextSampleRate = 44100; // iPhone preferred sample rate

// Enhanced browser/device detection
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isIPhone = /iPhone/.test(navigator.userAgent);
const isIPad = /iPad/.test(navigator.userAgent);
const isiOSVersion = isIOS ? parseFloat((navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/) || [0,0,0])[1] + '.' + (navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/) || [0,0,0])[2]) : 0;

console.log('Audio module loading - Device detection:', {
    isSafari,
    isIOS,
    isIPhone,
    isIPad,
    isiOSVersion,
    userAgent: navigator.userAgent
});

export async function startRecording(dotNetReference) {
    dotNetRef = dotNetReference;
    
    try {
        // iPhone-specific audio constraints
        const audioConstraints = {
            audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };

        // iPhone prefers higher sample rates
        if (isIPhone) {
            audioConstraints.audio.sampleRate = 44100;
        } else if (isIOS) {
            audioConstraints.audio.sampleRate = 22050;
        } else {
            audioConstraints.audio.sampleRate = 16000;
        }

        const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);

        // Initialize audio context if not already done
        if (!audioContext) {
            await initializeAudioContext();
        }

        const source = audioContext.createMediaStreamSource(stream);
        
        // iPhone-specific processing
        if (isIPhone) {
            // iPhone works best with very small buffer sizes
            const processor = audioContext.createScriptProcessor(1024, 1, 1);
            
            processor.onaudioprocess = async function(event) {
                if (dotNetRef && audioContext.state === 'running') {
                    try {
                        const inputData = event.inputBuffer.getChannelData(0);
                        const samples = new Int16Array(inputData.length);
                        
                        // iPhone-optimized conversion
                        for (let i = 0; i < inputData.length; i++) {
                            const sample = Math.max(-1, Math.min(1, inputData[i]));
                            samples[i] = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
                        }
                        
                        const bytes = new Uint8Array(samples.buffer);
                        const base64String = btoa(String.fromCharCode.apply(null, bytes));
                        
                        await dotNetRef.invokeMethodAsync('SendAudioData', base64String);
                    } catch (error) {
                        console.error('Error processing audio data on iPhone:', error);
                    }
                }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
        } else if (isIOS) {
            // iPad and other iOS devices
            const processor = audioContext.createScriptProcessor(2048, 1, 1);
            
            processor.onaudioprocess = async function(event) {
                if (dotNetRef && audioContext.state === 'running') {
                    try {
                        const inputData = event.inputBuffer.getChannelData(0);
                        const samples = new Int16Array(inputData.length);
                        
                        for (let i = 0; i < inputData.length; i++) {
                            const sample = Math.max(-1, Math.min(1, inputData[i]));
                            samples[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                        }
                        
                        const bytes = new Uint8Array(samples.buffer);
                        const base64String = btoa(String.fromCharCode.apply(null, bytes));
                        
                        await dotNetRef.invokeMethodAsync('SendAudioData', base64String);
                    } catch (error) {
                        console.error('Error processing audio data on iOS:', error);
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
        
        console.log('Recording started - Device:', isIPhone ? 'iPhone' : isIOS ? 'iOS' : isSafari ? 'Safari' : 'Other');
        
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
        // Detect the best sample rate for the device
        if (isIPhone) {
            audioContextSampleRate = 44100; // iPhone's native rate
        } else if (isIOS) {
            audioContextSampleRate = 22050; // Good balance for iPad
        } else {
            audioContextSampleRate = 16000; // Standard for web
        }

        const contextOptions = {
            sampleRate: audioContextSampleRate,
            latencyHint: 'interactive'
        };

        // iPhone/iOS specific context creation
        if (isIOS) {
            // Always use webkitAudioContext on iOS for maximum compatibility
            audioContext = new (window.webkitAudioContext || window.AudioContext)(contextOptions);
            console.log('Created webkitAudioContext for iOS');
        } else {
            audioContext = new (window.AudioContext || window.webkitAudioContext)(contextOptions);
        }

        console.log('Audio context created with sample rate:', audioContext.sampleRate);

        // Always start in suspended state due to autoplay policies
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        isAudioContextInitialized = true;
        console.log('Audio context initialized:', audioContext.state, 'Sample Rate:', audioContext.sampleRate);
        
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
            console.log('Resuming suspended audio context...');
            await audioContext.resume();
            console.log('Audio context resumed from suspended state:', audioContext.state);
        }
        
        // For iPhone, we need multiple unlock attempts
        if (isIPhone && audioContext.state === 'running') {
            await unlockAudioContextForIPhone();
        } else if (isIOS && audioContext.state === 'running') {
            await unlockAudioContextForSafari();
        }
        
        isAudioContextInitialized = true;
        console.log('Audio context activated:', audioContext.state, 'Sample Rate:', audioContext.sampleRate);
        
        // Process any queued audio after activation
        if (pendingAudioQueue.length > 0) {
            console.log('Processing queued audio after activation...');
            processAudioQueue();
        }
        
        return true;
    } catch (error) {
        console.error('Error activating audio context:', error);
        return false;
    }
}

async function unlockAudioContextForIPhone() {
    try {
        console.log('Unlocking iPhone audio context...');
        
        // iPhone needs multiple unlock attempts with different techniques
        
        // Technique 1: Play multiple silent buffers
        for (let i = 0; i < 3; i++) {
            const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            
            // Add gain node for iPhone
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0.001, audioContext.currentTime); // Very quiet but not silent
            
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            source.start(0);
            
            // Small delay between attempts
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Technique 2: Create oscillator briefly (iPhone-specific)
        const oscillator = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        gainNode2.gain.setValueAtTime(0.001, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        oscillator.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.01);
        
        console.log('iPhone audio context unlocked successfully');
        return true;
    } catch (error) {
        console.error('Error unlocking iPhone audio context:', error);
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
            console.log('Audio context not ready, queuing audio data. State:', audioContext?.state);
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
    try {
        // Convert base64 string back to byte array
        let bytes;
        if (typeof audioData === 'string') {
            const binaryString = atob(audioData);
            bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
        } else {
            bytes = new Uint8Array(audioData);
        }

        const samples = new Int16Array(bytes.buffer);
        
        // iPhone needs special handling for sample rate conversion
        let floatSamples;
        let targetSampleRate = audioContext.sampleRate;
        
        if (isIPhone && audioContext.sampleRate !== 16000) {
            // Resample from 16kHz to iPhone's sample rate
            floatSamples = resampleAudioForIPhone(samples, 16000, targetSampleRate);
        } else {
            // Standard conversion
            floatSamples = new Float32Array(samples.length);
            for (let i = 0; i < samples.length; i++) {
                floatSamples[i] = samples[i] / (samples[i] < 0 ? 0x8000 : 0x7FFF);
            }
        }

        // Create and play audio buffer
        const audioBuffer = audioContext.createBuffer(1, floatSamples.length, targetSampleRate);
        audioBuffer.getChannelData(0).set(floatSamples);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        // iPhone-specific audio routing
        const gainNode = audioContext.createGain();
        if (isIPhone) {
            // iPhone needs slightly higher gain
            gainNode.gain.setValueAtTime(1.2, audioContext.currentTime);
        } else {
            gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);
        }
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        source.start(0);
        
        console.log('Audio buffer played - Length:', floatSamples.length, 'Sample Rate:', targetSampleRate);
        
    } catch (error) {
        console.error('Error in playAudioBuffer:', error);
        throw error;
    }
}

function resampleAudioForIPhone(samples, fromSampleRate, toSampleRate) {
    if (fromSampleRate === toSampleRate) {
        // No resampling needed
        const floatSamples = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            floatSamples[i] = samples[i] / (samples[i] < 0 ? 0x8000 : 0x7FFF);
        }
        return floatSamples;
    }
    
    const ratio = toSampleRate / fromSampleRate;
    const outputLength = Math.floor(samples.length * ratio);
    const output = new Float32Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
        const srcIndex = i / ratio;
        const srcIndexFloor = Math.floor(srcIndex);
        const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1);
        const t = srcIndex - srcIndexFloor;
        
        // Linear interpolation
        const sample1 = samples[srcIndexFloor] / (samples[srcIndexFloor] < 0 ? 0x8000 : 0x7FFF);
        const sample2 = samples[srcIndexCeil] / (samples[srcIndexCeil] < 0 ? 0x8000 : 0x7FFF);
        
        output[i] = sample1 * (1 - t) + sample2 * t;
    }
    
    console.log('Resampled audio from', fromSampleRate, 'to', toSampleRate, 'samples:', samples.length, '->', outputLength);
    return output;
}

async function processAudioQueue() {
    if (isProcessingQueue || !audioContext || audioContext.state !== 'running') {
        return;
    }

    isProcessingQueue = true;
    console.log(`Processing ${pendingAudioQueue.length} queued audio buffers for`, isIPhone ? 'iPhone' : isIOS ? 'iOS' : 'other');

    while (pendingAudioQueue.length > 0) {
        const audioData = pendingAudioQueue.shift();
        try {
            await playAudioBuffer(audioData);
            
            // iPhone needs longer delays between buffers
            if (isIPhone) {
                await new Promise(resolve => setTimeout(resolve, 20));
            } else if (isIOS) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        } catch (error) {
            console.error('Error processing queued audio:', error);
        }
    }

    isProcessingQueue = false;
    console.log('Finished processing audio queue');
}

// Enhanced auto-unlock for iPhone
if (typeof window !== 'undefined') {
    // Wait for page load to initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            console.log('Audio module loaded for', isIPhone ? 'iPhone' : isIOS ? 'iOS' : 'other', '- waiting for user interaction');
        });
    } else {
        console.log('Audio module loaded for', isIPhone ? 'iPhone' : isIOS ? 'iOS' : 'other', '- waiting for user interaction');
    }
    
    // Add event listeners for user interaction to unlock audio
    const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
    const unlockAudio = async (event) => {
        if (!isAudioContextInitialized) {
            console.log('User interaction detected (' + event.type + '), attempting to unlock audio');
            const success = await activateAudioContext();
            console.log('Audio unlock result:', success);
            
            // Remove listeners after first successful interaction
            if (success) {
                unlockEvents.forEach(eventType => {
                    document.removeEventListener(eventType, unlockAudio, true);
                });
            }
        }
    };
    
    unlockEvents.forEach(event => {
        document.addEventListener(event, unlockAudio, true);
    });
    
    // iPhone-specific: Also try to unlock on page visibility change
    if (isIPhone) {
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden && !isAudioContextInitialized) {
                console.log('iPhone page became visible, attempting audio unlock');
                await activateAudioContext();
            }
        });
    }
}