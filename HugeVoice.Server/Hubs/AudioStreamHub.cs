using Microsoft.AspNetCore.SignalR;

namespace HugeVoice.Server.Hubs;

public class AudioStreamHub : Hub
{
    private readonly ILogger<AudioStreamHub> _logger;

    public AudioStreamHub(ILogger<AudioStreamHub> logger)
    {
        _logger = logger;
    }

    public async Task JoinRoom(string roomId)
    {
        try
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
            _logger.LogInformation("Client {ConnectionId} joined room {RoomId}", Context.ConnectionId, roomId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining room {RoomId} for connection {ConnectionId}", roomId, Context.ConnectionId);
            throw;
        }
    }

    public async Task SendAudioChunk(string roomId, byte[] audioData)
    {
        try
        {
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
        if (exception != null)
        {
            _logger.LogError(exception, "Client {ConnectionId} disconnected with error", Context.ConnectionId);
        }
        else
        {
            _logger.LogInformation("Client {ConnectionId} disconnected", Context.ConnectionId);
        }
        
        await base.OnDisconnectedAsync(exception);
    }
}
