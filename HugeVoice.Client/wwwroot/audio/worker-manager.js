// Web Worker Manager
// Handles communication with the audio processing worker

export class WorkerManager {
    constructor() {
        this.worker = null;
        this.initialized = false;
        this.onProcessed = null; // Callback for processed audio
        this.onError = null; // Callback for errors
    }

    async initialize() {
        if (this.worker && this.initialized) return true;
        
        try {
            console.log('?? Initializing audio processing worker...');
            
            this.worker = new Worker('audio-processor.worker.js');
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Worker initialization timeout'));
                }, 5000);

                this.worker.onmessage = (e) => {
                    const { type, success, result, error } = e.data;
                    
                    if (type === 'init-complete') {
                        clearTimeout(timeout);
                        this.initialized = success;
                        
                        if (success) {
                            console.log('? Audio worker initialized successfully');
                            // Setup message handler for future messages
                            this.setupMessageHandler();
                            resolve(true);
                        } else {
                            reject(new Error('Worker initialization failed'));
                        }
                    }
                };

                this.worker.onerror = (error) => {
                    clearTimeout(timeout);
                    console.error('? Audio worker error:', error);
                    reject(error);
                };

                // Initialize the worker
                this.worker.postMessage({ type: 'init' });
            });
        } catch (error) {
            console.error('? Failed to initialize audio worker:', error);
            throw error;
        }
    }

    setupMessageHandler() {
        if (!this.worker) return;

        this.worker.onmessage = (e) => {
            const { type, result, error } = e.data;
            
            if (type === 'processed') {
                if (this.onProcessed) {
                    this.onProcessed(result);
                }
            } else if (type === 'error') {
                console.error('[Worker] Processing error:', error);
                if (this.onError) {
                    this.onError(error);
                }
            } else if (type === 'stats') {
                console.log('[Worker] Stats:', result);
            }
        };
    }

    processAudioChunk(audioData, sampleRate) {
        if (!this.initialized || !this.worker) {
            throw new Error('Worker not initialized');
        }

        try {
            this.worker.postMessage({
                type: 'process',
                data: {
                    audioData: audioData,
                    sampleRate: sampleRate
                }
            }, [audioData.buffer]); // Transfer ownership for better performance
        } catch (error) {
            console.error('Failed to send to worker:', error);
            throw error;
        }
    }

    getStats() {
        if (!this.initialized || !this.worker) {
            throw new Error('Worker not initialized');
        }

        this.worker.postMessage({ type: 'getStats' });
    }

    terminate() {
        if (this.worker) {
            try {
                this.worker.postMessage({ type: 'terminate' });
                this.worker.terminate();
                this.worker = null;
                this.initialized = false;
                console.log('Audio worker terminated');
            } catch (e) {
                console.warn('Error terminating worker:', e);
            }
        }
    }

    get isInitialized() {
        return this.initialized;
    }
}
