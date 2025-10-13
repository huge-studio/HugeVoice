// Libsamplerate.js integration wrapper
// Provides high-quality audio resampling

import { TARGET_SAMPLE_RATE } from './constants.js';

export class Resampler {
    constructor() {
        this.libsamplerate = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return true;
        
        try {
            console.log('??? Initializing libsamplerate.js...');
            
            if (typeof LibSampleRate !== 'undefined') {
                this.libsamplerate = LibSampleRate;
                this.initialized = true;
                console.log('? libsamplerate.js loaded successfully');
                return true;
            } else {
                throw new Error('libsamplerate.js not available - this is required for audio processing');
            }
        } catch (error) {
            console.error('? Failed to initialize libsamplerate:', error);
            throw error;
        }
    }

    resample(inputData, fromRate, toRate) {
        if (fromRate === toRate) {
            return inputData; // No resampling needed
        }
        
        if (!this.initialized || !this.libsamplerate) {
            throw new Error('libsamplerate not initialized - cannot resample audio');
        }
        
        try {
            // Use libsamplerate for high-quality resampling
            const outputData = this.libsamplerate.simple(inputData, fromRate, toRate, {
                converterType: this.libsamplerate.SRC_SINC_FASTEST
            });
            return outputData;
        } catch (error) {
            console.error('libsamplerate resampling failed:', error);
            throw error;
        }
    }

    // Convenience method for resampling to target rate
    resampleToTarget(inputData, fromRate) {
        return this.resample(inputData, fromRate, TARGET_SAMPLE_RATE);
    }

    // Convenience method for resampling from target rate
    resampleFromTarget(inputData, toRate) {
        return this.resample(inputData, TARGET_SAMPLE_RATE, toRate);
    }
}
