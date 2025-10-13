// Audio Playback Scheduler
// Implements buffered audio playback with seamless scheduling

import { BUFFER_SIZE, MAX_QUEUE_SIZE, TIMING, TARGET_SAMPLE_RATE, isIPhone, isIPad, isIOS17Plus } from './constants.js';

export class PlaybackScheduler {
    constructor(contextManager) {
        this.contextManager = contextManager;
        this.queue = [];
        this.nextPlaybackTime = 0;
        this.isRunning = false;
        this.schedulerTimeout = null;
    }

    queueAudio(base64AudioData) {
        this.queue.push(base64AudioData);
        
        // Limit queue size to prevent memory issues
        if (this.queue.length > MAX_QUEUE_SIZE) {
            const dropped = this.queue.length - MAX_QUEUE_SIZE;
            this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
            console.warn(`?? Audio queue overflow, dropped ${dropped} old chunks`);
        }
        
        // Start scheduler if not running
        if (!this.isRunning && this.contextManager.isRunning) {
            this.start();
        }
    }

    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.nextPlaybackTime = this.contextManager.currentTime;
        
        console.log('?? Starting audio playback scheduler');
        
        this.scheduleNext();
    }

    stop() {
        this.isRunning = false;
        this.queue = [];
        this.nextPlaybackTime = 0;
        
        if (this.schedulerTimeout) {
            clearTimeout(this.schedulerTimeout);
            this.schedulerTimeout = null;
        }
        
        console.log('?? Stopped audio playback scheduler');
    }

    async scheduleNext() {
        if (!this.isRunning || !this.contextManager.isRunning) {
            this.isRunning = false;
            return;
        }
        
        // Schedule chunks while we have data and haven't scheduled too far ahead
        const currentTime = this.contextManager.currentTime;
        const scheduleAheadTime = currentTime + BUFFER_SIZE;
        
        let chunksScheduled = 0;
        
        while (this.queue.length > 0 && this.nextPlaybackTime < scheduleAheadTime) {
            const base64AudioData = this.queue.shift();
            
            try {
                const audioBuffer = await this.decodeAudioData(base64AudioData);
                
                if (audioBuffer) {
                    // Create source
                    const source = this.contextManager.createBufferSource();
                    source.buffer = audioBuffer;
                    
                    // Apply gain with device-specific adjustments
                    const gainNode = this.contextManager.createGain();
                    let gainValue = 1.0;
                    
                    if (isIPhone && !isIOS17Plus) {
                        gainValue = 1.2;
                    } else if (isIPad) {
                        gainValue = 1.1;
                    }
                    
                    gainNode.gain.setValueAtTime(gainValue, this.contextManager.currentTime);
                    
                    source.connect(gainNode);
                    gainNode.connect(this.contextManager.destination);
                    
                    // Schedule playback
                    // If nextPlaybackTime is in the past, schedule immediately
                    const playTime = Math.max(this.nextPlaybackTime, currentTime);
                    source.start(playTime);
                    
                    // Update next playback time to the end of this chunk
                    this.nextPlaybackTime = playTime + audioBuffer.duration;
                    
                    chunksScheduled++;
                }
            } catch (error) {
                console.error('? Error scheduling audio chunk:', error);
            }
        }
        
        if (chunksScheduled > 0) {
            console.log(`?? Scheduled ${chunksScheduled} audio chunks, buffer: ${(this.nextPlaybackTime - currentTime).toFixed(3)}s`);
        }
        
        // Schedule next batch
        const delay = this.queue.length > 0 
            ? TIMING.SCHEDULER_CHECK_WITH_DATA 
            : TIMING.SCHEDULER_CHECK_NO_DATA;
        
        this.schedulerTimeout = setTimeout(() => this.scheduleNext(), delay);
    }

    async decodeAudioData(base64AudioData) {
        try {
            // Convert base64 to byte array
            const binaryString = atob(base64AudioData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const samples = new Int16Array(bytes.buffer);
            
            // Check for valid audio data
            if (samples.length === 0) {
                return null;
            }
            
            // Convert to float samples
            const floatSamples = new Float32Array(samples.length);
            for (let i = 0; i < samples.length; i++) {
                floatSamples[i] = samples[i] / (samples[i] < 0 ? 0x8000 : 0x7FFF);
            }
            
            // Resample from TARGET_SAMPLE_RATE to audioContext.sampleRate if needed
            let resampledData = floatSamples;
            if (TARGET_SAMPLE_RATE !== this.contextManager.sampleRate) {
                resampledData = this.contextManager.resampler.resample(
                    floatSamples, 
                    TARGET_SAMPLE_RATE, 
                    this.contextManager.sampleRate
                );
            }
            
            // Create audio buffer
            const audioBuffer = this.contextManager.createBuffer(1, resampledData.length, this.contextManager.sampleRate);
            audioBuffer.getChannelData(0).set(resampledData);
            
            return audioBuffer;
        } catch (error) {
            console.error('? Error decoding audio data:', error);
            return null;
        }
    }

    get queueLength() {
        return this.queue.length;
    }

    get bufferHealth() {
        const currentTime = this.contextManager.currentTime;
        return this.nextPlaybackTime - currentTime;
    }
}
