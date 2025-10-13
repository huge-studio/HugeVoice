// HugeVoice Audio Module - Main Entry Point
// Enhanced iOS/Safari compatibility with modular architecture
// DSP powered by libsamplerate.js for high-quality audio resampling
// Audio processing offloaded to Web Worker for better performance
// SignalR hub integration in JS to minimize interop
// BUFFERED PLAYBACK for smooth continuous audio

import { isIOS, TIMING } from './audio/constants.js';
import { HubManager } from './audio/hub-manager.js';
import { AudioContextManager } from './audio/audio-context.js';
import { WorkerManager } from './audio/worker-manager.js';
import { PlaybackScheduler } from './audio/playback-scheduler.js';
import { IOSUnlockManager } from './audio/ios-unlock.js';
import { Recorder } from './audio/recorder.js';
import { getDiagnostics, logSystemInfo } from './audio/diagnostics.js';

// Global managers
const contextManager = new AudioContextManager();
const hubManager = new HubManager();
const workerManager = new WorkerManager();
const playbackScheduler = new PlaybackScheduler(contextManager);
const iosUnlock = new IOSUnlockManager(contextManager);
let recorder = null;

// Pending audio queue for before initialization
let pendingAudioQueue = [];
let isProcessingPendingQueue = false;

// Initialize on load
console.log('?? Audio module loaded');
logSystemInfo();

// Setup hub callback for audio chunks
hubManager.onAudioChunkReceived = (base64Audio) => {
    if (contextManager.isRunning && iosUnlock.isFullyUnlocked) {
        playbackScheduler.queueAudio(base64Audio);
    } else {
        // Queue until ready
        pendingAudioQueue.push(base64Audio);
        
        if (pendingAudioQueue.length > 50) {
            console.warn('Pending audio queue overflow, dropping oldest items');
            pendingAudioQueue = pendingAudioQueue.slice(-30);
        }
    }
};

// Process pending audio queue
async function processPendingQueue() {
    if (isProcessingPendingQueue || !contextManager.isRunning || !iosUnlock.isFullyUnlocked) {
        return;
    }

    if (pendingAudioQueue.length === 0) return;

    isProcessingPendingQueue = true;
    console.log(`?? Processing ${pendingAudioQueue.length} queued audio buffers...`);

    const maxProcessPerRun = 10;
    let processed = 0;

    while (pendingAudioQueue.length > 0 && processed < maxProcessPerRun) {
        const audioData = pendingAudioQueue.shift();
        playbackScheduler.queueAudio(audioData);
        processed++;
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    isProcessingPendingQueue = false;

    if (pendingAudioQueue.length > 0) {
        setTimeout(() => processPendingQueue(), TIMING.PENDING_QUEUE_PROCESS);
    }

    console.log('? Processed audio batch, remaining in queue:', pendingAudioQueue.length);
}

// ============================================================================
// PUBLIC API EXPORTS
// ============================================================================

/**
 * Start recording audio and broadcasting to a channel
 * @param {string} channelId - The channel ID to broadcast to
 * @param {string} hubUrl - The SignalR hub URL
 * @returns {Promise<{success: boolean}>}
 */
export async function startRecording(channelId, hubUrl) {
    try {
        // Initialize worker if not already done
        if (!workerManager.isInitialized) {
            await workerManager.initialize();
        }

        // Initialize resampler through context manager
        if (!contextManager.initialized) {
            await contextManager.initialize();
        }

        // Ensure audio is unlocked
        if (!iosUnlock.ensureUnlocked()) {
            console.warn('?? Audio not fully unlocked - user interaction may be needed');
        }

        // Create recorder instance
        recorder = new Recorder(contextManager, workerManager, hubManager);

        // Start recording
        return await recorder.start(channelId, hubUrl);
    } catch (error) {
        console.error('Error starting recording:', error);
        throw error;
    }
}

/**
 * Stop recording audio
 * @returns {Promise<{success: boolean}>}
 */
export async function stopRecording() {
    if (recorder) {
        const result = await recorder.stop();
        recorder = null;
        return result;
    }
    return { success: true };
}

/**
 * Join a listening room
 * @param {string} channelId - The channel ID to listen to
 * @param {string} hubUrl - The SignalR hub URL
 * @returns {Promise<{success: boolean}>}
 */
export async function joinListeningRoom(channelId, hubUrl) {
    try {
        // Initialize hub connection
        await hubManager.initialize(hubUrl);
        
        // Join room as listener
        await hubManager.joinRoom(channelId, false);
        
        console.log(`? Joined listening room: ${channelId}`);
        
        return { success: true };
    } catch (error) {
        console.error('? Error joining listening room:', error);
        throw error;
    }
}

/**
 * Leave the current room
 * @returns {Promise<void>}
 */
export async function leaveRoom() {
    await hubManager.leaveRoom();
}

/**
 * Play audio data (for direct playback, mainly used internally)
 * @param {string} audioData - Base64 encoded audio data
 * @returns {Promise<void>}
 */
export async function playAudio(audioData) {
    if (!audioData) {
        console.error('No audio data provided');
        return;
    }

    if (!contextManager.isRunning || !iosUnlock.isFullyUnlocked) {
        console.log('?? Audio not ready, queuing audio data. Context state:', contextManager.state);
        pendingAudioQueue.push(audioData);
        
        if (pendingAudioQueue.length > 50) {
            console.warn('Audio queue overflow, dropping oldest items');
            pendingAudioQueue = pendingAudioQueue.slice(-30);
        }
        
        return;
    }

    playbackScheduler.queueAudio(audioData);
}

/**
 * Activate audio context - MUST be called from user gesture
 * @returns {Promise<boolean>}
 */
export async function activateAudioContext() {
    const success = await iosUnlock.activateAudio();
    
    if (success && pendingAudioQueue.length > 0) {
        console.log('?? Processing', pendingAudioQueue.length, 'queued audio buffers...');
        processPendingQueue();
    }
    
    return success;
}

/**
 * Clean up all audio resources
 * @returns {void}
 */
export function cleanup() {
    console.log('?? Cleaning up audio module...');
    
    // Stop recording if active
    if (recorder) {
        recorder.stop();
        recorder = null;
    }
    
    // Stop playback scheduler
    playbackScheduler.stop();
    
    // Release broadcaster role and leave room
    if (hubManager.currentChannelId) {
        hubManager.releaseBroadcasterRole(hubManager.currentChannelId);
    }
    hubManager.leaveRoom();
    
    // Disconnect hub
    hubManager.disconnect();
    
    // Terminate worker
    workerManager.terminate();
    
    // Clear queues
    pendingAudioQueue = [];
    
    // iOS cleanup
    iosUnlock.cleanup();
    
    // Close audio context
    contextManager.close();
    
    console.log('? Audio module cleaned up');
}

/**
 * Get diagnostics information
 * @returns {object} Diagnostic information
 */
export function getDiagnosticsInfo() {
    return getDiagnostics(
        contextManager,
        hubManager,
        workerManager,
        iosUnlock,
        playbackScheduler,
        recorder
    );
}

// Make diagnostic function available globally for debugging
if (typeof window !== 'undefined') {
    window.getAudioDiagnostics = getDiagnosticsInfo;
}

// ============================================================================
// EVENT LISTENERS FOR iOS AUDIO UNLOCKING
// ============================================================================

if (typeof window !== 'undefined') {
    // Monitor page visibility for audio context management
    document.addEventListener('visibilitychange', async () => {
        if (document.hidden) {
            console.log('?? Page hidden - audio context may be suspended');
        } else {
            console.log('? Page visible again');
            if (contextManager.state === 'suspended' && contextManager.initialized) {
                try {
                    await contextManager.resume();
                    console.log('Resumed audio context after visibility change');
                } catch (error) {
                    console.error('Failed to resume audio context:', error);
                }
            }
        }
    });

    // Handle window blur/focus
    window.addEventListener('blur', () => {
        console.log('?? Window blur detected');
        if (recorder && recorder.isRecording && contextManager.isRunning) {
            // Keep context alive with silent buffer
            try {
                const buffer = contextManager.createBuffer(1, 1, contextManager.sampleRate);
                const source = contextManager.createBufferSource();
                source.buffer = buffer;
                const gainNode = contextManager.createGain();
                gainNode.gain.value = 0;
                source.connect(gainNode);
                gainNode.connect(contextManager.destination);
                source.start();
            } catch (e) {
                console.log('Could not play keepalive buffer:', e);
            }
        }
    });

    window.addEventListener('focus', async () => {
        console.log('? Window focused');
        if (recorder && recorder.isRecording && contextManager.state === 'suspended') {
            try {
                await contextManager.resume();
                console.log('Audio context resumed successfully');
            } catch (error) {
                console.error('Failed to resume audio context:', error);
            }
        }
    });

    // iOS-specific handling
    if (isIOS) {
        if ('onpageshow' in window) {
            window.addEventListener('pageshow', (event) => {
                if (event.persisted) {
                    console.log('Page restored from cache');
                    // Reset states as they may be invalid
                    iosUnlock.isWebAudioUnlocked = false;
                    iosUnlock.isAudioElementUnlocked = false;
                }
            });
        }

        window.addEventListener('beforeunload', () => {
            cleanup();
        });
    }

    // CRITICAL: Auto-unlock audio on user interaction
    const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
    let unlockInProgress = false;

    const unlockAudio = async (event) => {
        if (unlockInProgress) return;

        if (isIOS || !iosUnlock.isFullyUnlocked) {
            unlockInProgress = true;
            console.log('?? User gesture detected (' + event.type + '), unlocking audio...');

            try {
                const success = await activateAudioContext();
                console.log('?? Audio unlock result:', success ? '? Success' : '? Failed');

                // On non-iOS, remove listeners after first success
                if (success && !isIOS) {
                    unlockEvents.forEach(eventType => {
                        document.removeEventListener(eventType, unlockAudio, { capture: true, passive: false });
                    });
                }
            } catch (error) {
                console.error('? Error in unlock handler:', error);
            } finally {
                unlockInProgress = false;
            }
        }
    };

    // Add listeners
    unlockEvents.forEach(event => {
        document.addEventListener(event, unlockAudio, { capture: true, passive: false });
    });
}
