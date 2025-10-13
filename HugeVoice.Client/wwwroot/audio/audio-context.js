// Audio Context Manager
// Handles AudioContext initialization, state management, and iOS compatibility

import { isIOS, isIPhone, isIOS17Plus, isMacSafari } from './constants.js';
import { Resampler } from './resampler.js';

export class AudioContextManager {
    constructor() {
        this.context = null;
        this.initialized = false;
        this.resampler = new Resampler();
    }

    async initialize() {
        if (this.context && this.context.state !== 'closed') {
            return true;
        }

        try {
            // Initialize resampler first
            await this.resampler.initialize();
            
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
                this.context = new window.webkitAudioContext(contextOptions);
                console.log('Created webkitAudioContext for iOS');
            } else {
                this.context = new AudioContextClass(contextOptions);
            }

            console.log('Audio context created with sample rate:', this.context.sampleRate, 'State:', this.context.state);

            // Monitor state changes
            if (this.context.addEventListener) {
                this.context.addEventListener('statechange', () => {
                    console.log('Audio context state changed to:', this.context.state);
                });
            }

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Error initializing audio context:', error);
            return false;
        }
    }

    async resume() {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }

        if (this.context.state === 'suspended') {
            console.log('?? Resuming suspended audio context...');

            // iOS sometimes needs multiple resume attempts
            let resumeAttempts = 0;
            while (this.context.state === 'suspended' && resumeAttempts < 3) {
                await this.context.resume();
                resumeAttempts++;

                if (this.context.state === 'suspended') {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            console.log('? Audio context state after resume:', this.context.state);
        }
    }

    close() {
        if (this.context && this.context.state !== 'closed') {
            this.context.close();
            this.context = null;
            this.initialized = false;
        }
    }

    get state() {
        return this.context?.state;
    }

    get sampleRate() {
        return this.context?.sampleRate;
    }

    get currentTime() {
        return this.context?.currentTime;
    }

    get isRunning() {
        return this.context && this.context.state === 'running';
    }

    createBuffer(numberOfChannels, length, sampleRate) {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createBuffer(numberOfChannels, length, sampleRate);
    }

    createBufferSource() {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createBufferSource();
    }

    createGain() {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createGain();
    }

    createMediaStreamSource(stream) {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createMediaStreamSource(stream);
    }

    createScriptProcessor(bufferSize, numberOfInputChannels, numberOfOutputChannels) {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.createScriptProcessor(bufferSize, numberOfInputChannels, numberOfOutputChannels);
    }

    get destination() {
        if (!this.context) {
            throw new Error('Audio context not initialized');
        }
        return this.context.destination;
    }
}
