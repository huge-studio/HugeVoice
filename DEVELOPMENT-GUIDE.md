# HugeVox Development Guide

## Testing the Application

### 1. Start the Server
```bash
cd HugeVox.Server
dotnet run
```

### 2. Access the Application
Open your browser and navigate to: `http://localhost:5090`

You should see:
- **Home Page**: Welcome screen with "Start Broadcasting" and "Listen to Broadcast" cards
- **Navigation**: Header with HugeVox logo and navigation links

### 3. Test Broadcasting
1. Click "Start Broadcasting" or navigate to `/broadcast`
2. You should see:
   - QR code generated automatically
   - Room ID and listener URL
   - Connection status indicator
   - "Start Broadcasting" button (disabled until connected)

### 4. Debugging Steps

If you see a blank page:
1. **Check browser console** (F12) for JavaScript errors
2. **Verify SignalR connection** - look for connection status warnings
3. **Check network tab** - ensure all resources are loading

Common issues:
- **WASM files not loading**: Check that `UseBlazorFrameworkFiles()` is configured
- **SignalR connection failed**: Verify hub is running and accessible
- **Bootstrap not loading**: Check that CSS files are in wwwroot/lib/bootstrap/
- **Routing conflicts**: Ensure no duplicate pages exist (template files have been removed)

### 5. Expected Behavior

**Home Page (`/`)**:
- Shows welcome screen with two main action cards
- Navigation menu at top
- Footer at bottom

**Broadcast Page (`/broadcast`)**:
- Generates unique room ID
- Creates QR code for sharing
- Shows connection status
- Enables microphone access when broadcasting starts

**Listen Page (`/listen/{roomId}`)**:
- Connects to specified room
- Shows QR code for sharing
- Displays connection status
- Plays audio from broadcasters in that room

### 6. File Locations

**Server**: `HugeVox.Server/`
- `Program.cs` - Main server configuration
- `Hubs/AudioStreamHub.cs` - SignalR hub for audio streaming

**Client**: `HugeVox.Client/`
- `Components/App.razor` - Main app component with routing
- `Components/Pages/` - Page components (Home, Broadcast, Listen)
- `Components/Layout/MainLayout.razor` - Main layout with navigation
- `wwwroot/` - Static files (CSS, JS, Bootstrap)

**Note**: Template-generated duplicate files have been removed to prevent routing conflicts.

### 7. Troubleshooting

**If pages don't load**:
1. Ensure both projects build successfully
2. Check that server project references client project
3. Verify `MapFallbackToFile("index.html")` is configured

**If SignalR doesn't work**:
1. Check that hub is mapped: `app.MapHub<AudioStreamHub>("/audiohub")`
2. Verify client connects to correct URL
3. Check CORS configuration if needed

**If audio doesn't work**:
1. Ensure `audio.js` file exists in client wwwroot
2. Check browser permissions for microphone
3. Verify HTTPS is used (required for audio in most browsers)

**If you get routing conflicts**:
1. Check for duplicate pages in different folders
2. Remove template-generated files that conflict with custom pages
3. Ensure only one `_Imports.razor` and `App.razor` exist