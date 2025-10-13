// Audio Recorder
// Handles microphone capture, processing, and transmission

import { 
    BUFFER_SIZES, 
    ERROR_THRESHOLDS, 
    TIMING, 
    TARGET_SAMPLE_RATE,
    isIPhone, 
    isIOS, 
    isIOS17Plus 
} from './constants.js';

export class Recorder {
    constructor(contextManager, workerManager, hubManager) {
        this.contextManager = contextManager;
        this.workerManager = workerManager;
        this.hubManager = hubManager;
        
        this.isRecording = false;
        this.stream = null;
        this.processor = null;
        this.source = null;
        this.keepaliveInterval = null;
        
        // Statistics
        this.stats = {
            chunksProcessed: 0,
            chunksSent: 0,
            consecutiveErrors: 0,
            lastProcessTime: Date.now()
        };

        // Processing queue
        this.processingQueue = [];
        this.isProcessingWorkerMessage = false;
    }

    async start(channelId, hubUrl) {
        if (this.isRecording) {
            throw new Error('Already recording');
        }

        try {
            console.log(`??? Starting recording for channel: ${channelId}`);
            
            // Initialize hub connection
            await this.hubManager.initialize(hubUrl);
            
            if (!this.hubManager.isConnected) {
                throw new Error('Hub connection failed');
            }
            
            // Join room as broadcaster
            await this.hubManager.joinRoom(channelId, true);
            
            // Request broadcaster role
            const canBroadcast = await this.hubManager.requestBroadcasterRole(channelId);
            
            if (!canBroadcast) {
                throw new Error('Failed to obtain broadcaster role - another broadcaster may be active');
            }
            
            // Test hub method
            await this.testHubMethod(channelId);
            
            // Get microphone stream
            this.stream = await this.getMicrophoneStream();
            
            // Initialize audio context if needed
            if (!this.contextManager.context || this.contextManager.state === 'closed') {
                await this.contextManager.initialize();
            }

            // Ensure context is running
            if (this.contextManager.state === 'suspended') {
                await this.contextManager.resume();
            }

            // Setup audio processing pipeline
            await this.setupAudioPipeline(channelId);
            
            this.isRecording = true;
            console.log('? Recording started successfully');
            
            return { success: true };

        } catch (error) {
            console.error('? Error starting recording:', error);
            await this.cleanup();
            throw error;
        }
    }

    async getMicrophoneStream() {
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

        try {
            return await navigator.mediaDevices.getUserMedia(audioConstraints);
        } catch (error) {
            console.warn('Failed with ideal constraints, trying basic:', error);
            return await navigator.mediaDevices.getUserMedia({ audio: true });
        }
    }

    async testHubMethod(channelId) {
        console.log('?? Testing SendAudioChunkBase64 method...');
        const testBase64 = btoa(String.fromCharCode(0, 0, 0, 0));
        await this.hubManager.sendAudioChunk(channelId, testBase64);
        console.log('? SendAudioChunkBase64 method verified working');
    }

    async setupAudioPipeline(channelId) {
        this.source = this.contextManager.createMediaStreamSource(this.stream);
        const sourceSampleRate = this.contextManager.sampleRate;
        
        console.log(`?? Recording setup: ${sourceSampleRate}Hz ? ${TARGET_SAMPLE_RATE}Hz (Web Worker)`);

        // Determine optimal buffer size
        const bufferSize = this.getOptimalBufferSize();

        // Create processor
        try {
            this.processor = this.contextManager.createScriptProcessor(bufferSize, 1, 1);
        } catch (error) {
            console.warn('Failed to create processor with size', bufferSize, 'trying 4096');
            this.processor = this.contextManager.createScriptProcessor(4096, 1, 1);
        }

        // Setup worker message handler
        this.setupWorkerHandler(channelId);

        // Setup audio process handler
        this.setupAudioProcessHandler(sourceSampleRate);

        // Connect pipeline
        this.source.connect(this.processor);
        this.processor.connect(this.contextManager.destination);

        // Start keepalive
        this.startKeepalive();
    }

    getOptimalBufferSize() {
        if (isIPhone && isIOS17Plus) {
            return BUFFER_SIZES.IOS_17_PLUS;
        } else if (isIPhone) {
            return BUFFER_SIZES.IPHONE;
        } else if (isIOS) {
            return BUFFER_SIZES.IOS;
        } else {
            return BUFFER_SIZES.DEFAULT;
        }
    }

    setupWorkerHandler(channelId) {
        this.workerManager.onProcessed = async (result) => {
            this.stats.lastProcessTime = Date.now();
            this.stats.chunksProcessed++;
            
            if (!result.silent && this.hubManager.hasBroadcasterRole) {
                try {
                    if (!this.hubManager.isConnected) {
                        throw new Error('Hub not connected');
                    }
                    
                    const base64Audio = result.base64Audio;
                    
                    if (!base64Audio || base64Audio.length === 0) {
                        console.warn('?? Skipping empty audio chunk');
                        return;
                    }
                    
                    if (this.stats.chunksSent === 0) {
                        console.log(`?? Sending first audio chunk. Base64 length: ${base64Audio.length}`);
                    }
                    
                    await this.hubManager.sendAudioChunk(channelId, base64Audio);
                    this.stats.chunksSent++;
                    
                    if (this.stats.chunksSent % 50 === 0) {
                        console.log(`?? Sent ${this.stats.chunksSent} audio chunks successfully`);
                    }
                    
                    this.stats.consecutiveErrors = 0;
                } catch (error) {
                    this.stats.consecutiveErrors++;
                    console.error('? Error sending audio:', error);
                    
                    if (this.stats.consecutiveErrors >= ERROR_THRESHOLDS.MAX_ERRORS) {
                        console.error('Too many consecutive errors, stopping recording');
                        await this.stop();
                    }
                }
            }
            
            // Process next item in queue
            if (this.processingQueue.length > 0) {
                const nextItem = this.processingQueue.shift();
                this.workerManager.processAudioChunk(nextItem.audioData, nextItem.sampleRate);
            } else {
                this.isProcessingWorkerMessage = false;
            }
        };

        this.workerManager.onError = (error) => {
            console.error('Worker processing error:', error);
            this.stats.consecutiveErrors++;
            this.isProcessingWorkerMessage = false;
            
            if (this.stats.consecutiveErrors >= ERROR_THRESHOLDS.MAX_WORKER_ERRORS) {
                console.error('Worker appears to be broken, stopping recording');
                this.stop();
            }
        };
    }

    setupAudioProcessHandler(sourceSampleRate) {
        this.processor.onaudioprocess = (event) => {
            if (this.contextManager.isRunning && this.workerManager.isInitialized && this.isRecording) {
                this.stats.lastProcessTime = Date.now();
                
                const inputData = event.inputBuffer.getChannelData(0);
                const audioDataCopy = new Float32Array(inputData);
                
                const workerMessage = {
                    audioData: audioDataCopy,
                    sampleRate: sourceSampleRate
                };
                
                if (this.isProcessingWorkerMessage) {
                    this.processingQueue.push(workerMessage);
                    
                    if (this.processingQueue.length > 20) {
                        this.processingQueue.shift();
                        console.warn('?? Dropped audio chunk due to queue overflow');
                    }
                } else {
                    this.isProcessingWorkerMessage = true;
                    try {
                        this.workerManager.processAudioChunk(audioDataCopy, sourceSampleRate);
                    } catch (error) {
                        console.error('Failed to send to worker:', error);
                        this.isProcessingWorkerMessage = false;
                        this.stats.consecutiveErrors++;
                    }
                }
            }
        };
    }

    startKeepalive() {
        this.keepaliveInterval = setInterval(() => {
            const timeSinceLastProcess = Date.now() - this.stats.lastProcessTime;
            
            if (timeSinceLastProcess > 1000 && this.isRecording) {
                console.warn('?? No audio processed in 1 second - checking state');
                console.log('Audio context state:', this.contextManager.state);
                console.log('Worker initialized:', this.workerManager.isInitialized);
                console.log('Hub connection state:', this.hubManager.state);
                console.log('Chunks processed:', this.stats.chunksProcessed);
                console.log('Chunks sent:', this.stats.chunksSent);
                
                if (this.contextManager.state === 'suspended') {
                    console.log('Attempting to resume suspended audio context');
                    this.contextManager.resume().catch(e => console.error('Resume failed:', e));
                }
                
                if (!this.hubManager.isConnected) {
                    console.error('? Hub connection lost! State:', this.hubManager.state);
                }
            }
        }, TIMING.KEEPALIVE_CHECK);
    }

    async stop() {
        if (!this.isRecording) return { success: true };
        
        console.log(`?? Stopping recording`);
        
        this.isRecording = false;
        
        await this.cleanup();
        
        console.log('? Recording stopped');
        
        return { success: true };
    }

    async cleanup() {
        // Stop keepalive
        if (this.keepaliveInterval) {
            clearInterval(this.keepaliveInterval);
            this.keepaliveInterval = null;
        }
        
        // Clean up audio nodes
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }

        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }

        // Stop media stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Release broadcaster role
        if (this.hubManager.currentChannelId) {
            await this.hubManager.releaseBroadcasterRole(this.hubManager.currentChannelId);
        }

        // Reset stats
        this.stats = {
            chunksProcessed: 0,
            chunksSent: 0,
            consecutiveErrors: 0,
            lastProcessTime: Date.now()
        };

        this.processingQueue = [];
        this.isProcessingWorkerMessage = false;
    }

    getStats() {
        return {
            ...this.stats,
            isRecording: this.isRecording,
            queueLength: this.processingQueue.length
        };
    }
}
