using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace HugeVoice.Server.Hubs;

public class AudioStreamHub : Hub
{
    private readonly ILogger<AudioStreamHub> _logger;
    private static readonly ConcurrentDictionary<string, string> _activeBroadcasters = new();
    private static readonly ConcurrentDictionary<string, HashSet<string>> _roomListeners = new();
    private static readonly object _lockObject = new object();

    public AudioStreamHub(ILogger<AudioStreamHub> logger)
    {
        _logger = logger;
    }

    public async Task JoinRoom(string roomId, bool isBroadcaster = false)
    {
        try
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
            
            lock (_lockObject)
            {
                if (!_roomListeners.ContainsKey(roomId))
                {
                    _roomListeners[roomId] = new HashSet<string>();
                }
                _roomListeners[roomId].Add(Context.ConnectionId);
            }
            
            _logger.LogInformation("Client {ConnectionId} joined room {RoomId} as {Role}", 
                Context.ConnectionId, roomId, isBroadcaster ? "potential broadcaster" : "listener");
            
            // Notify the client about the current broadcaster status
            var hasBroadcaster = _activeBroadcasters.ContainsKey(roomId);
            var currentBroadcaster = hasBroadcaster ? _activeBroadcasters[roomId] : null;
            
            _logger.LogInformation("Room {RoomId} status: HasBroadcaster={HasBroadcaster}, CurrentBroadcaster={CurrentBroadcaster}", 
                roomId, hasBroadcaster, currentBroadcaster);
            
            await Clients.Caller.SendAsync("RoomStatus", roomId, hasBroadcaster);
            
            // If this is a listener joining and there's no broadcaster, let them know they're waiting
            if (!isBroadcaster && !hasBroadcaster)
            {
                await Clients.Caller.SendAsync("WaitingForBroadcaster", roomId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining room {RoomId} for connection {ConnectionId}", roomId, Context.ConnectionId);
            throw;
        }
    }

    public async Task<bool> CheckBroadcasterStatus(string roomId)
    {
        try
        {
            var hasBroadcaster = _activeBroadcasters.ContainsKey(roomId);
            var currentBroadcaster = hasBroadcaster ? _activeBroadcasters[roomId] : null;
            
            _logger.LogInformation("Broadcaster status check for room {RoomId}: HasBroadcaster={HasBroadcaster}, CurrentBroadcaster={CurrentBroadcaster}, RequestingClient={RequestingClient}", 
                roomId, hasBroadcaster, currentBroadcaster, Context.ConnectionId);
            
            return hasBroadcaster;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking broadcaster status for room {RoomId} by connection {ConnectionId}", 
                roomId, Context.ConnectionId);
            throw;
        }
    }

    public async Task<bool> RequestBroadcasterRole(string roomId)
    {
        try
        {
            _logger.LogInformation("Client {ConnectionId} requesting broadcaster role for room {RoomId}", 
                Context.ConnectionId, roomId);
            
            lock (_lockObject)
            {
                if (_activeBroadcasters.ContainsKey(roomId))
                {
                    var existingBroadcaster = _activeBroadcasters[roomId];
                    _logger.LogWarning("Broadcaster role denied for {ConnectionId} in room {RoomId} - already has broadcaster {ExistingBroadcaster}", 
                        Context.ConnectionId, roomId, existingBroadcaster);
                    return false;
                }
                
                // Grant broadcaster role
                _activeBroadcasters[roomId] = Context.ConnectionId;
                _logger.LogInformation("Granted broadcaster role to {ConnectionId} for room {RoomId}. Total active broadcasters: {Count}", 
                    Context.ConnectionId, roomId, _activeBroadcasters.Count);
            }
            
            _logger.LogInformation("Client {ConnectionId} became broadcaster for room {RoomId}", Context.ConnectionId, roomId);
            
            // Notify all clients in the room about the new broadcaster
            await Clients.Group(roomId).SendAsync("BroadcasterJoined", roomId, Context.ConnectionId);
            
            // Notify listeners specifically that they can now hear audio
            await Clients.OthersInGroup(roomId).SendAsync("BroadcasterAvailable", roomId);
            
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error requesting broadcaster role for room {RoomId} by connection {ConnectionId}", 
                roomId, Context.ConnectionId);
            throw;
        }
    }

    public async Task ReleaseBroadcasterRole(string roomId)
    {
        try
        {
            bool wasReleased = false;
            lock (_lockObject)
            {
                if (_activeBroadcasters.TryGetValue(roomId, out var currentBroadcaster) && 
                    currentBroadcaster == Context.ConnectionId)
                {
                    _activeBroadcasters.TryRemove(roomId, out _);
                    wasReleased = true;
                    _logger.LogInformation("Client {ConnectionId} released broadcaster role for room {RoomId}", 
                        Context.ConnectionId, roomId);
                }
            }
            
            if (wasReleased)
            {
                // Notify all clients in the room that broadcasting stopped but channel remains open
                await Clients.Group(roomId).SendAsync("BroadcasterLeft", roomId, Context.ConnectionId);
                
                // Specifically notify listeners that they're now waiting for a new broadcaster
                await Clients.OthersInGroup(roomId).SendAsync("WaitingForBroadcaster", roomId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error releasing broadcaster role for room {RoomId} by connection {ConnectionId}", 
                roomId, Context.ConnectionId);
            throw;
        }
    }

    public async Task SendAudioChunk(string roomId, byte[] audioData)
    {
        try
        {
            _logger.LogInformation("SendAudioChunk called - Room: {RoomId}, ConnectionId: {ConnectionId}, DataSize: {DataSize}", 
                roomId, Context.ConnectionId, audioData?.Length ?? 0);
            
            // Verify the caller is the active broadcaster for this room
            if (!_activeBroadcasters.TryGetValue(roomId, out var activeBroadcaster))
            {
                _logger.LogWarning("Audio transmission attempt from {ConnectionId} in room {RoomId} - no active broadcaster for this room. Active broadcasters: {ActiveBroadcasters}", 
                    Context.ConnectionId, roomId, string.Join(", ", _activeBroadcasters.Select(kvp => $"{kvp.Key}:{kvp.Value}")));
                await Clients.Caller.SendAsync("BroadcastError", "No active broadcaster found for this channel. Please request broadcaster role first.");
                return;
            }
            
            _logger.LogInformation("Checking broadcaster authorization - Caller: {ConnectionId}, ActiveBroadcaster: {ActiveBroadcaster}", 
                Context.ConnectionId, activeBroadcaster);
            
            if (activeBroadcaster != Context.ConnectionId)
            {
                _logger.LogWarning("Unauthorized audio transmission attempt from {ConnectionId} in room {RoomId} - active broadcaster is {ActiveBroadcaster}", 
                    Context.ConnectionId, roomId, activeBroadcaster);
                await Clients.Caller.SendAsync("BroadcastError", "You are not the active broadcaster for this channel. Another user is currently broadcasting.");
                return;
            }
            
            if (audioData != null && audioData.Length > 0)
            {
                await Clients.OthersInGroup(roomId).SendAsync("ReceiveAudioChunk", audioData);
                _logger.LogDebug("Sent audio chunk of {Size} bytes to room {RoomId} from broadcaster {ConnectionId}", 
                    audioData.Length, roomId, Context.ConnectionId);
            }
            else
            {
                _logger.LogWarning("Empty or null audio data from {ConnectionId}", Context.ConnectionId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending audio chunk to room {RoomId} from {ConnectionId}. Error: {ErrorMessage}", 
                roomId, Context.ConnectionId, ex.Message);
            await Clients.Caller.SendAsync("BroadcastError", $"Failed to send audio data: {ex.Message}");
            throw;
        }
    }

    public async Task SendAudioChunkBase64(string roomId, string base64AudioData)
    {
        try
        {
            // Convert base64 to byte array
            var audioData = Convert.FromBase64String(base64AudioData);
            
            _logger.LogInformation("SendAudioChunkBase64 called - Room: {RoomId}, ConnectionId: {ConnectionId}, DataSize: {DataSize}", 
                roomId, Context.ConnectionId, audioData.Length);
            
            // Use the existing SendAudioChunk logic
            await SendAudioChunk(roomId, audioData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing base64 audio chunk from {ConnectionId}. Error: {ErrorMessage}", 
                Context.ConnectionId, ex.Message);
            await Clients.Caller.SendAsync("BroadcastError", $"Failed to process audio data: {ex.Message}");
            throw;
        }
    }

    public async Task<object> GetDebugInfo()
    {
        try
        {
            var debugInfo = new
            {
                TotalActiveBroadcasters = _activeBroadcasters.Count,
                ActiveBroadcasters = _activeBroadcasters.ToDictionary(kvp => kvp.Key, kvp => kvp.Value),
                TotalRooms = _roomListeners.Count,
                RoomListeners = _roomListeners.ToDictionary(kvp => kvp.Key, kvp => kvp.Value.Count),
                RequestingConnection = Context.ConnectionId
            };
            
            _logger.LogInformation("Debug info requested by {ConnectionId}: {@DebugInfo}", 
                Context.ConnectionId, debugInfo);
            
            return debugInfo;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting debug info for connection {ConnectionId}", Context.ConnectionId);
            throw;
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        try
        {
            // Clean up broadcaster role if this connection was a broadcaster
            var roomsToCleanup = new List<string>();
            
            lock (_lockObject)
            {
                foreach (var kvp in _activeBroadcasters)
                {
                    if (kvp.Value == Context.ConnectionId)
                    {
                        roomsToCleanup.Add(kvp.Key);
                    }
                }
                
                foreach (var roomId in roomsToCleanup)
                {
                    _activeBroadcasters.TryRemove(roomId, out _);
                }
                
                // Remove from listener tracking
                foreach (var kvp in _roomListeners.ToList())
                {
                    kvp.Value.Remove(Context.ConnectionId);
                    // Keep the room entry even if empty - listeners might still be connected
                    // Only remove if truly empty and no broadcaster
                    if (kvp.Value.Count == 0 && !_activeBroadcasters.ContainsKey(kvp.Key))
                    {
                        _roomListeners.TryRemove(kvp.Key, out _);
                    }
                }
            }
            
            // Notify rooms about broadcaster disconnection - channel stays open for listeners
            foreach (var roomId in roomsToCleanup)
            {
                await Clients.Group(roomId).SendAsync("BroadcasterLeft", roomId, Context.ConnectionId);
                // Let remaining listeners know they're waiting for a new broadcaster
                await Clients.Group(roomId).SendAsync("WaitingForBroadcaster", roomId);
                _logger.LogInformation("Broadcaster {ConnectionId} disconnected from room {RoomId} - channel remains open for listeners", 
                    Context.ConnectionId, roomId);
            }
            
            if (exception != null)
            {
                _logger.LogError(exception, "Client {ConnectionId} disconnected with error", Context.ConnectionId);
            }
            else
            {
                _logger.LogInformation("Client {ConnectionId} disconnected", Context.ConnectionId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during disconnect cleanup for {ConnectionId}", Context.ConnectionId);
        }
        
        await base.OnDisconnectedAsync(exception);
    }
}
