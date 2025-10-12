// Audio Processing Web Worker for HugeVoice
// Handles CPU-intensive audio resampling and encoding off the main thread

// Import libsamplerate in worker context
importScripts('libsamplerate.min.js');

let libsamplerate = null;
let initialized = false;
const TARGET_SAMPLE_RATE = 16000;
let processedCount = 0;
let droppedCount = 0;

// Initialize libsamplerate
function initializeLibsamplerate() {
    if (libsamplerate) return true;
    
    try {
        if (typeof LibSampleRate !== 'undefined') {
            libsamplerate = LibSampleRate;
            console.log('[Worker] ? libsamplerate.js loaded successfully');
            return true;
        } else {
            throw new Error('libsamplerate.js not available in worker');
        }
    } catch (error) {
        console.error('[Worker] ? Failed to initialize libsamplerate:', error);
        return false;
    }
}

// Resample audio data
function resampleAudio(inputData, fromRate, toRate) {
    if (fromRate === toRate) {
        return inputData;
    }
    
    if (!libsamplerate) {
        throw new Error('libsamplerate not initialized');
    }
    
    try {
        const outputData = libsamplerate.simple(inputData, fromRate, toRate, {
            converterType: libsamplerate.SRC_SINC_FASTEST
        });
        return outputData;
    } catch (error) {
        console.error('[Worker] Resampling failed:', error);
        throw error;
    }
}

// Convert Float32Array to 16-bit PCM
function floatTo16BitPCM(floatSamples) {
    const samples = new Int16Array(floatSamples.length);
    for (let i = 0; i < floatSamples.length; i++) {
        const sample = Math.max(-1, Math.min(1, floatSamples[i]));
        samples[i] = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
    }
    return samples;
}

// Convert 16-bit PCM to base64
function pcmToBase64(samples) {
    const bytes = new Uint8Array(samples.buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Process audio chunk
function processAudioChunk(audioData, sourceSampleRate) {
    try {
        // Check for silent input
        const sum = audioData.reduce((a, b) => Math.abs(a) + Math.abs(b), 0);
        if (sum < 0.01) {
            return { silent: true };
        }

        // Resample if needed
        let processedData = audioData;
        if (sourceSampleRate !== TARGET_SAMPLE_RATE) {
            processedData = resampleAudio(audioData, sourceSampleRate, TARGET_SAMPLE_RATE);
        }

        // Convert to 16-bit PCM
        const pcmSamples = floatTo16BitPCM(processedData);

        // Convert to base64
        const base64String = pcmToBase64(pcmSamples);

        processedCount++;
        
        // Log stats every 100 chunks
        if (processedCount % 100 === 0) {
            console.log(`[Worker] Processed ${processedCount} chunks, dropped ${droppedCount}`);
        }

        return {
            silent: false,
            base64Audio: base64String,
            sampleCount: processedData.length
        };
    } catch (error) {
        console.error('[Worker] Error processing audio chunk:', error);
        droppedCount++;
        throw error;
    }
}

// Message handler
self.onmessage = function(e) {
    const { type, data } = e.data;

    switch (type) {
        case 'init':
            try {
                const success = initializeLibsamplerate();
                initialized = success;
                processedCount = 0;
                droppedCount = 0;
                self.postMessage({
                    type: 'init-complete',
                    success: success
                });
            } catch (error) {
                self.postMessage({
                    type: 'error',
                    error: error.message
                });
            }
            break;

        case 'process':
            if (!initialized) {
                self.postMessage({
                    type: 'error',
                    error: 'Worker not initialized'
                });
                return;
            }

            try {
                const result = processAudioChunk(data.audioData, data.sampleRate);
                self.postMessage({
                    type: 'processed',
                    result: result
                });
            } catch (error) {
                droppedCount++;
                self.postMessage({
                    type: 'error',
                    error: error.message
                });
            }
            break;

        case 'getStats':
            self.postMessage({
                type: 'stats',
                stats: {
                    processed: processedCount,
                    dropped: droppedCount
                }
            });
            break;

        case 'terminate':
            console.log(`[Worker] Terminating. Final stats - Processed: ${processedCount}, Dropped: ${droppedCount}`);
            self.postMessage({
                type: 'terminated'
            });
            self.close();
            break;

        default:
            console.warn('[Worker] Unknown message type:', type);
    }
};

console.log('[Worker] Audio processor worker initialized');
