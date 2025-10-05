# HugeVox - Unified Deployment

This is the unified version of HugeVox where the server hosts the Blazor WASM client as static files.

## Architecture

```
HugeVox.Server (ASP.NET Core)
??? SignalR Hub (/audiohub)
??? Static File Hosting
??? Blazor WASM Client (HugeVox.Client)
    ??? Broadcast Page
    ??? Listen Page
    ??? Audio Components
```

## Features

- **Single Deployment**: One web application serves both the API and the client
- **SignalR Audio Streaming**: Real-time audio broadcasting between clients
- **WASM Client**: Blazor WebAssembly for rich interactive UI
- **QR Code Sharing**: Easy room sharing via QR codes
- **Responsive Design**: Works on desktop and mobile devices

## Running the Application

### Development
```bash
cd HugeVox.Server
dotnet run
```

The application will be available at:
- **Main App**: `http://localhost:5090`
- **SignalR Hub**: `http://localhost:5090/audiohub`

### Production Build
```bash
cd HugeVox.Server
dotnet publish -c Release
```

## Project Structure

### HugeVox.Server
- **Program.cs**: Configures SignalR, static file serving, and WASM hosting
- **Hubs/AudioStreamHub.cs**: SignalR hub for audio streaming
- **Project Reference**: References HugeVox.Client to include WASM files

### HugeVox.Client
- **Blazor WASM Components**: UI components for broadcasting and listening
- **SignalR Client**: Connects to the same-origin SignalR hub
- **Audio.js**: JavaScript module for audio capture and playback

## Key Configuration

### Server (Program.cs)
```csharp
// Enable WASM hosting
builder.Services.AddRazorPages();
app.UseBlazorFrameworkFiles();
app.UseStaticFiles();
app.MapFallbackToFile("index.html");

// SignalR Hub
app.MapHub<AudioStreamHub>("/audiohub");
```

### Client Connection
```csharp
// Connects to same origin
_hubConnection = new HubConnectionBuilder()
    .WithUrl(Navigation.ToAbsoluteUri("/audiohub"))
    .Build();
```

## Deployment Options

### Single Server Deployment
- Deploy `HugeVox.Server` to any ASP.NET Core hosting provider
- Client files are automatically included and served
- Perfect for Azure App Service, IIS, or Docker containers

### Benefits of Unified Deployment
- ? Simplified deployment process
- ? No CORS configuration needed
- ? Single domain/certificate
- ? Easier to manage and monitor
- ? Built-in load balancing for both API and static files

### Docker Example
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0
COPY publish/ /app
WORKDIR /app
EXPOSE 80
ENTRYPOINT ["dotnet", "HugeVox.Server.dll"]
```

## Development Workflow

1. **Make changes** to either server or client code
2. **Build from server project**: `dotnet build` (builds both projects)
3. **Run from server project**: `dotnet run` (serves everything)
4. **Access at**: `http://localhost:5090`

The server project automatically builds and includes the client WASM files, making development seamless.

## URLs

- **Home**: `http://localhost:5090/`
- **Broadcast**: `http://localhost:5090/broadcast`
- **Listen**: `http://localhost:5090/listen/{roomId}`
- **SignalR Hub**: `http://localhost:5090/audiohub`