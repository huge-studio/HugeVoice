using Microsoft.AspNetCore.SignalR;

namespace HugeVox.Hubs;

public class AudioStreamHub : Hub
{
    public async Task JoinRoom(string roomId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
    }

    public async Task SendAudioChunk(string roomId, byte[] audioData)
    {
        await Clients.OthersInGroup(roomId).SendAsync("ReceiveAudioChunk", audioData);
    }
}
