# HugeVoice - Blazor WebAssembly with SignalR

A Blazor WebAssembly application with SignalR for real-time audio communication, featuring separate client and server projects in a hosted configuration.

## Projects

### HugeVoice.Server
- ASP.NET Core server with SignalR hub
- Hosts the Blazor WebAssembly client
- Handles audio streaming between clients
- Runs on `https://localhost:7001` by default

### HugeVoice.Client  
- Blazor WebAssembly client
- Audio broadcasting and listening interface
- Connects to the server via SignalR
- Runs on `https://localhost:7167` when run standalone

## Running the Application

### Option 1: Hosted Configuration (Recommended)
Run the server which will automatically serve the client:

```bash
cd HugeVoice.Server
dotnet run
```

Access the application at:
- Client UI: `https://localhost:7001` (hosted by server)
- Server API: `https://localhost:7001`

### Option 2: Separate Development
For development purposes, you can run them separately:

**1. Start the Server**
```bash
cd HugeVoice.Server
dotnet run
```

**2. Start the Client (in a new terminal)**
```bash
cd HugeVoice.Client
dotnet run
```

**3. Access the Application**
- Client UI: `https://localhost:7167`
- Server API: `https://localhost:7001`

## Development Notes

- The client connects to the server SignalR hub
- Both projects target .NET 9
- The server includes a project reference to the client for hosted deployment
- Uses SignalR for real-time communication
- QRCode generation available for easy sharing

## Building the Solution

```bash
dotnet build HugeVoice.sln
```

## Project Structure

This is a hosted Blazor WebAssembly configuration where:
- The server can host the client for production deployment
- The client can run independently during development
- SignalR enables real-time audio streaming between connected clients