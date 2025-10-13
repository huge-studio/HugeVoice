// SignalR Hub Connection Manager
// Handles all SignalR hub operations and event management

export class HubManager {
    constructor() {
        this.connection = null;
        this.currentChannelId = null;
        this.hasBroadcasterRole = false;
        this.onAudioChunkReceived = null; // Callback for audio chunks
    }

    async initialize(hubUrl) {
        // If we already have a connected hub for this URL, reuse it
        if (this.connection && this.connection.state === 'Connected' && this.connection.baseUrl === hubUrl) {
            console.log('? Reusing existing hub connection');
            return this.connection;
        }

        // Clean up any existing connection first
        if (this.connection) {
            console.log('?? Cleaning up existing hub connection before creating new one');
            try {
                if (this.currentChannelId) {
                    await this.connection.invoke('LeaveRoom', this.currentChannelId).catch(() => {});
                }
                await this.connection.stop();
            } catch (e) {
                console.warn('Error stopping old connection:', e);
            }
            this.connection = null;
        }

        try {
            console.log('?? Initializing SignalR hub connection...');
            
            // SignalR should be loaded from CDN in index.html
            if (!window.signalR) {
                throw new Error('SignalR not available. Please ensure the SignalR script is loaded in index.html');
            }
            
            const signalR = window.signalR;
            
            this.connection = new signalR.HubConnectionBuilder()
                .withUrl(hubUrl)
                .withAutomaticReconnect()
                .configureLogging(signalR.LogLevel.Information)
                .build();
            
            // Store the base URL for comparison
            this.connection.baseUrl = hubUrl;

            this.setupEventHandlers();

            await this.connection.start();
            console.log('? SignalR hub connected. Connection ID:', this.connection.connectionId);
            
            return this.connection;
        } catch (error) {
            console.error('? Failed to initialize hub:', error);
            this.connection = null;
            throw error;
        }
    }

    setupEventHandlers() {
        if (!this.connection) return;

        // Handle incoming audio chunks
        this.connection.on('ReceiveAudioChunk', (audioData) => {
            if (audioData && audioData.length > 0) {
                const base64Audio = btoa(String.fromCharCode.apply(null, audioData));
                
                // Call the callback if set
                if (this.onAudioChunkReceived) {
                    this.onAudioChunkReceived(base64Audio);
                }
            }
        });

        this.connection.on('BroadcastError', (message) => {
            console.error('? Broadcast error from server:', message);
        });

        this.connection.onreconnecting(() => {
            console.log('?? Hub reconnecting...');
        });

        this.connection.onreconnected(async () => {
            console.log('? Hub reconnected');
            if (this.currentChannelId && this.hasBroadcasterRole) {
                console.log(`Rejoining room ${this.currentChannelId} after reconnection`);
                try {
                    await this.connection.invoke('JoinRoom', this.currentChannelId, true);
                    await this.connection.invoke('RequestBroadcasterRole', this.currentChannelId);
                } catch (e) {
                    console.error('Error rejoining after reconnection:', e);
                }
            }
        });

        this.connection.onclose((error) => {
            console.log('? Hub connection closed', error);
        });
    }

    async joinRoom(channelId, isBroadcaster = false) {
        if (!this.connection || this.connection.state !== 'Connected') {
            throw new Error('Hub not connected');
        }

        this.currentChannelId = channelId;
        await this.connection.invoke('JoinRoom', channelId, isBroadcaster);
        console.log(`? Joined room ${channelId} as ${isBroadcaster ? 'broadcaster' : 'listener'}`);
    }

    async requestBroadcasterRole(channelId) {
        if (!this.connection || this.connection.state !== 'Connected') {
            throw new Error('Hub not connected');
        }

        const canBroadcast = await this.connection.invoke('RequestBroadcasterRole', channelId);
        
        if (canBroadcast) {
            this.hasBroadcasterRole = true;
            console.log(`? Successfully obtained broadcaster role for ${channelId}`);
        }
        
        return canBroadcast;
    }

    async releaseBroadcasterRole(channelId) {
        if (!this.connection || !channelId) return;

        try {
            console.log(`Releasing broadcaster role for ${channelId}`);
            await this.connection.invoke('ReleaseBroadcasterRole', channelId);
            this.hasBroadcasterRole = false;
            console.log('? Broadcaster role released');
        } catch (e) {
            console.error('? Error releasing broadcaster role:', e);
        }
    }

    async sendAudioChunk(channelId, base64Audio) {
        if (!this.connection || this.connection.state !== 'Connected') {
            throw new Error('Hub not connected');
        }

        if (!this.hasBroadcasterRole) {
            throw new Error('No broadcaster role');
        }

        await this.connection.invoke('SendAudioChunkBase64', channelId, base64Audio);
    }

    async leaveRoom() {
        if (this.connection && this.currentChannelId) {
            try {
                await this.connection.invoke('LeaveRoom', this.currentChannelId);
                this.currentChannelId = null;
                console.log('? Left room');
            } catch (error) {
                console.error('? Error leaving room:', error);
            }
        }
    }

    async disconnect() {
        if (this.connection) {
            try {
                await this.connection.stop();
                this.connection = null;
                console.log('SignalR hub disconnected');
            } catch (e) {
                console.warn('Error disconnecting hub:', e);
            }
        }
    }

    get isConnected() {
        return this.connection && this.connection.state === 'Connected';
    }

    get connectionId() {
        return this.connection?.connectionId;
    }

    get state() {
        return this.connection?.state;
    }
}
