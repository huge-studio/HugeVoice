// Diagnostics and debugging utilities

export function getDiagnostics(contextManager, hubManager, workerManager, iosUnlock, playbackScheduler, recorder) {
    const diagnostics = {
        recording: recorder ? recorder.getStats() : null,
        hub: {
            isConnected: hubManager.isConnected,
            connectionId: hubManager.connectionId,
            state: hubManager.state,
            currentChannelId: hubManager.currentChannelId,
            hasBroadcasterRole: hubManager.hasBroadcasterRole
        },
        audioContext: {
            state: contextManager.state,
            sampleRate: contextManager.sampleRate,
            currentTime: contextManager.currentTime,
            initialized: contextManager.initialized
        },
        worker: {
            initialized: workerManager.isInitialized
        },
        ios: {
            isFullyUnlocked: iosUnlock.isFullyUnlocked,
            isWebAudioUnlocked: iosUnlock.isWebAudioUnlocked,
            isAudioElementUnlocked: iosUnlock.isAudioElementUnlocked,
            lastInteractionTime: iosUnlock.lastInteractionTime
        },
        playback: playbackScheduler ? {
            isRunning: playbackScheduler.isRunning,
            queueLength: playbackScheduler.queueLength,
            bufferHealth: playbackScheduler.bufferHealth
        } : null,
        visibility: {
            documentHidden: document.hidden,
            visibilityState: document.visibilityState
        }
    };
    
    console.log('?? HugeVoice Audio Diagnostics:', diagnostics);
    return diagnostics;
}

export function logSystemInfo() {
    console.log('?? Audio System Information:', {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory || 'unknown',
        connection: navigator.connection ? {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink,
            rtt: navigator.connection.rtt
        } : 'unknown'
    });
}
