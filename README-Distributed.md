# HugeVox - Distributed Setup

This is the distributed version of HugeVox with separate server and WASM client projects.

## Projects

### HugeVox.Server
- ASP.NET Core SignalR server
- Handles audio streaming between clients
- Runs on `https://localhost:7001` by default

### HugeVox.Client  
- Blazor WebAssembly client
- Audio broadcasting and listening interface
- Connects to the server via SignalR

## Running the Application

### 1. Start the Server
```bash
cd HugeVox.Server
dotnet run
```

### 2. Start the Client (in a new terminal)
```bash
cd HugeVox.Client
dotnet run
```

### 3. Access the Application
- Client UI: `https://localhost:5001`
- Server API: `https://localhost:7001`

## Development Notes

- The client connects to the server at `https://localhost:7001/audiohub`
- CORS is configured to allow the client origin
- Both projects target .NET 9

## Next Steps

This setup enables you to:
- Deploy the server and client separately
- Scale the server independently
- Host the client on a CDN
- Run multiple client instances against one server

## Building the Solution

```bash
dotnet build HugeVox.Distributed.sln
```