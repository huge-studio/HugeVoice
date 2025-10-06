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

    public async Task JoinRoom(string roomId)
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
            
            _logger.LogInformation("Client {ConnectionId} joined room {RoomId}", Context.ConnectionId, roomId);
            
            // Notify the client about the current broadcaster status
            var hasBroadcaster = _activeBroadcasters.ContainsKey(roomId);
            await Clients.Caller.SendAsync("RoomStatus", roomId, hasBroadcaster);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining room {RoomId} for connection {ConnectionId}", roomId, Context.ConnectionId);
            throw;
        }
    }

    public async Task<bool> RequestBroadcasterRole(string roomId)
    {
        try
        {
            lock (_lockObject)
            {
                if (_activeBroadcasters.ContainsKey(roomId))
                {
                    // Another broadcaster is already active
                    _logger.LogWarning("Broadcaster role denied for {ConnectionId} in room {RoomId} - already has broadcaster", 
                        Context.ConnectionId, roomId);
                    return false;
                }
                
                // Grant broadcaster role
                _activeBroadcasters[roomId] = Context.ConnectionId;
            }
            
            _logger.LogInformation("Client {ConnectionId} became broadcaster for room {RoomId}", Context.ConnectionId, roomId);
            
            // Notify all clients in the room about the new broadcaster
            await Clients.Group(roomId).SendAsync("BroadcasterChanged", roomId, Context.ConnectionId, true);
            
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
            lock (_lockObject)
            {
                if (_activeBroadcasters.TryGetValue(roomId, out var currentBroadcaster) && 
                    currentBroadcaster == Context.ConnectionId)
                {
                    _activeBroadcasters.TryRemove(roomId, out _);
                    _logger.LogInformation("Client {ConnectionId} released broadcaster role for room {RoomId}", 
                        Context.ConnectionId, roomId);
                }
            }
            
            // Notify all clients in the room that broadcasting stopped
            await Clients.Group(roomId).SendAsync("BroadcasterChanged", roomId, Context.ConnectionId, false);
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
            // Verify the caller is the active broadcaster for this room
            if (!_activeBroadcasters.TryGetValue(roomId, out var activeBroadcaster) || 
                activeBroadcaster != Context.ConnectionId)
            {
                _logger.LogWarning("Unauthorized audio transmission attempt from {ConnectionId} in room {RoomId}", 
                    Context.ConnectionId, roomId);
                await Clients.Caller.SendAsync("BroadcastError", "You are not the active broadcaster for this channel");
                return;
            }
            
            if (audioData != null && audioData.Length > 0)
            {
                await Clients.OthersInGroup(roomId).SendAsync("ReceiveAudioChunk", audioData);
                _logger.LogDebug("Sent audio chunk of {Size} bytes to room {RoomId}", audioData.Length, roomId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending audio chunk to room {RoomId}", roomId);
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
                    if (kvp.Value.Count == 0)
                    {
                        _roomListeners.TryRemove(kvp.Key, out _);
                    }
                }
            }
            
            // Notify rooms about broadcaster disconnection
            foreach (var roomId in roomsToCleanup)
            {
                await Clients.Group(roomId).SendAsync("BroadcasterChanged", roomId, Context.ConnectionId, false);
                _logger.LogInformation("Broadcaster {ConnectionId} disconnected from room {RoomId}", 
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
