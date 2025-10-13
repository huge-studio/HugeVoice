// iOS Audio Unlock Manager
// Handles iOS audio context and element unlocking requirements

import { isIOS, isIOS15Plus, isIOS17Plus } from './constants.js';

export class IOSUnlockManager {
    constructor(contextManager) {
        this.contextManager = contextManager;
        this.isWebAudioUnlocked = false;
        this.isAudioElementUnlocked = false;
        this.audioElement = null;
        this.blobUrlCache = new Set();
        this.lastInteractionTime = 0;
    }

    async activateAudio() {
        try {
            console.log('?? Activating audio with user interaction...');

            // Track interaction time
            this.lastInteractionTime = Date.now();

            // Step 1: Initialize audio context if needed
            if (!this.contextManager.context || this.contextManager.state === 'closed') {
                const initialized = await this.contextManager.initialize();
                if (!initialized) {
                    console.error('Failed to initialize audio context');
                    return false;
                }
            }

            // Step 2: Resume audio context (MUST be in user gesture)
            await this.contextManager.resume();

            // Step 3: Unlock Web Audio API (MUST be in user gesture)
            await this.unlockWebAudio();

            // Step 4: Unlock Audio element (MUST be in user gesture)  
            await this.unlockAudioElement();

            // Step 5: Setup Media Session API for iOS control center (iOS 15+)
            if ('mediaSession' in navigator && isIOS15Plus) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: 'HugeVoice Audio',
                    artist: 'HugeVoice',
                    album: 'Audio Stream'
                });
            }

            console.log('?? Audio fully activated! WebAudio:', this.isWebAudioUnlocked, 'AudioElement:', this.isAudioElementUnlocked);

            return true;
        } catch (error) {
            console.error('? Error activating audio context:', error);
            return false;
        }
    }

    async unlockWebAudio() {
        if (this.isWebAudioUnlocked || !this.contextManager.context) return;

        try {
            console.log('?? Unlocking Web Audio API...');

            // iOS 17+ needs fewer unlock attempts
            const unlockAttempts = isIOS17Plus ? 2 : 5;

            // Create multiple silent buffers to ensure unlock
            for (let i = 0; i < unlockAttempts; i++) {
                const buffer = this.contextManager.createBuffer(1, 1, this.contextManager.sampleRate);
                const source = this.contextManager.createBufferSource();
                source.buffer = buffer;

                // iOS needs non-zero gain
                const gainNode = this.contextManager.createGain();
                gainNode.gain.setValueAtTime(0.001, this.contextManager.currentTime);

                source.connect(gainNode);
                gainNode.connect(this.contextManager.destination);

                // Start immediately
                source.start(0);
                source.stop(this.contextManager.currentTime + 0.001);
            }

            // Additional unlock with oscillator (works better on some iOS versions)
            if (!isIOS17Plus && this.contextManager.context.createOscillator) {
                const oscillator = this.contextManager.context.createOscillator();
                const gainNode = this.contextManager.createGain();
                gainNode.gain.setValueAtTime(0.001, this.contextManager.currentTime);
                oscillator.frequency.setValueAtTime(440, this.contextManager.currentTime);
                oscillator.connect(gainNode);
                gainNode.connect(this.contextManager.destination);
                oscillator.start(this.contextManager.currentTime);
                oscillator.stop(this.contextManager.currentTime + 0.01);
            }

            this.isWebAudioUnlocked = true;
            console.log('? Web Audio API unlocked');

        } catch (error) {
            console.error('? Error unlocking Web Audio API:', error);
            this.isWebAudioUnlocked = false;
        }
    }

    async unlockAudioElement() {
        if (this.isAudioElementUnlocked) return;

        try {
            console.log('?? Unlocking Audio element...');

            // Create audio element if not exists
            this.createAudioElement();

            // iOS 15+ can use simpler unlock
            if (isIOS15Plus) {
                // Use data URI for maximum compatibility
                this.audioElement.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAAA=';
                this.audioElement.volume = 0.01;

                try {
                    await this.audioElement.play();
                    this.audioElement.pause();
                    this.audioElement.currentTime = 0;
                    this.isAudioElementUnlocked = true;
                    console.log('? Audio element unlocked (iOS 15+ method)');
                    return;
                } catch (error) {
                    console.log('iOS 15+ unlock failed, trying legacy method');
                }
            }

            // Legacy unlock method for older iOS
            if (this.contextManager.context) {
                // Create a tiny silent audio file as blob
                const audioBuffer = this.contextManager.createBuffer(
                    1, 
                    this.contextManager.sampleRate * 0.1, 
                    this.contextManager.sampleRate
                );

                // Convert to WAV blob for Audio element
                const wav = this.audioBufferToWav(audioBuffer);
                const blob = new Blob([wav], { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);

                // Track blob URL for cleanup
                this.blobUrlCache.add(url);

                // Play through Audio element to unlock it
                this.audioElement.src = url;
                this.audioElement.volume = 0.01;

                try {
                    const playPromise = this.audioElement.play();

                    if (playPromise !== undefined) {
                        await playPromise;
                        this.audioElement.pause();
                        this.audioElement.currentTime = 0;
                    }

                    this.isAudioElementUnlocked = true;
                    console.log('? Audio element unlocked via play()');
                } catch (playError) {
                    console.log('?? Audio element play failed:', playError.name);
                    this.isAudioElementUnlocked = false;
                }

                // Schedule cleanup
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    this.blobUrlCache.delete(url);
                }, 1000);
            }

        } catch (error) {
            console.error('? Error unlocking Audio element:', error);
            this.isAudioElementUnlocked = false;
        }
    }

    createAudioElement() {
        if (!this.audioElement) {
            this.audioElement = new Audio();
            this.audioElement.preload = 'auto';
            this.audioElement.crossOrigin = 'anonymous';

            if (isIOS) {
                this.audioElement.playsInline = true;
                this.audioElement.setAttribute('playsinline', '');
                this.audioElement.setAttribute('webkit-playsinline', '');
                this.audioElement.muted = false;
                this.audioElement.volume = 1.0;
            }

            this.audioElement.addEventListener('error', (e) => {
                console.error('Audio element error:', e);
                if (isIOS) {
                    this.isAudioElementUnlocked = false;
                }
            });

            console.log('Audio element created for iOS fallback');
        }
        return this.audioElement;
    }

    audioBufferToWav(buffer) {
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

    ensureUnlocked() {
        // Check if we've had a recent interaction
        const timeSinceInteraction = Date.now() - this.lastInteractionTime;
        const needsRefresh = timeSinceInteraction > 30000; // 30 seconds

        if (needsRefresh && isIOS) {
            console.log('?? Audio unlock may have expired, needs refresh');
            this.isWebAudioUnlocked = false;
            this.isAudioElementUnlocked = false;
        }

        if (!this.isWebAudioUnlocked || !this.isAudioElementUnlocked) {
            console.log('?? Audio not fully unlocked, waiting for user interaction...');
            return false;
        }

        if (this.contextManager.state === 'suspended') {
            console.log('?? Audio context suspended, needs user interaction');
            return false;
        }

        return true;
    }

    cleanup() {
        // Clean up blob URLs
        this.blobUrlCache.forEach(url => {
            URL.revokeObjectURL(url);
        });
        this.blobUrlCache.clear();

        // Remove audio element
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
            this.audioElement = null;
        }
    }

    get isFullyUnlocked() {
        return this.isWebAudioUnlocked && this.isAudioElementUnlocked;
    }
}
