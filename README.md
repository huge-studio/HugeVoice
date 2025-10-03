# HugeVox - Real-time Audio Broadcasting

A modern, mobile-responsive Blazor Server application for real-time audio broadcasting using SignalR and WebRTC.

## Features

? **Real-time Audio Streaming** - Broadcast audio to multiple listeners in real-time  
?? **Mobile Responsive** - Fully optimized for mobile, tablet, and desktop devices  
?? **Modern UI** - Bootstrap 5 with custom styling and animations  
?? **QR Code Sharing** - Easy listener access via QR code scanning  
??? **Easy Broadcasting** - One-click start/stop broadcasting with visual feedback  
?? **Simple Listening** - Automatic connection and audio playback  

## Technology Stack

- **.NET 9** - Latest stable .NET framework
- **Blazor Server** - Server-side Blazor for real-time updates
- **SignalR** - Real-time communication between broadcaster and listeners
- **Bootstrap 5** - Responsive UI framework
- **QRCoder** - QR code generation for easy sharing
- **JavaScript Interop** - WebRTC for audio capture and playback

## Project Structure

```
HugeVox/
??? HugeVox.csproj                # Project file
??? Program.cs                     # Application entry point
??? AudioStreamHub.cs              # SignalR hub for audio streaming
??? Pages/
?   ??? _Host.cshtml              # Main HTML host page
??? Components/
?   ??? _Imports.razor            # Global using directives
?   ??? App.razor                 # Root component
?   ??? Layout/
?   ?   ??? MainLayout.razor      # Main layout with navigation
?   ??? Pages/
?       ??? Home.razor            # Landing page
?       ??? Broadcast.razor       # Broadcasting page
?       ??? Listen.razor          # Listening page
??? wwwroot/
    ??? audio.js                  # Audio capture/playback logic
    ??? css/
        ??? app.css              # Custom styles
```

## Getting Started

### Prerequisites

- .NET 9 SDK installed
- Modern web browser with microphone support

### Running the Application

1. Clone the repository
2. Navigate to the project directory
3. Run the application:

```bash
dotnet run
```

4. Open your browser to `https://localhost:55487` (or the URL shown in the console)

## How to Use

### Broadcasting

1. Navigate to the **Broadcast** page
2. Click **Start Broadcasting**
3. Allow microphone access when prompted
4. Share the QR code or URL with listeners
5. Click **Stop Broadcasting** when done

### Listening

1. Scan the broadcaster's QR code OR
2. Navigate to the listener URL directly
3. Audio will play automatically once the broadcaster starts
4. Share the QR code with others to invite more listeners

## Mobile Optimization

The application is fully responsive and works seamlessly on:

- ?? **Mobile phones** (iOS & Android)
- ?? **Tablets** (iPad, Android tablets)
- ?? **Desktop browsers** (Chrome, Firefox, Safari, Edge)

### Mobile Features

- Touch-friendly buttons and controls
- Adaptive layouts for all screen sizes
- Optimized QR code display
- Mobile-friendly navigation menu
- Smooth animations and transitions

## Browser Support

- ? Chrome (recommended)
- ? Firefox
- ? Safari
- ? Edge
- ?? Requires microphone permissions for broadcasting

## Architecture

### SignalR Hub (`AudioStreamHub.cs`)

Manages real-time communication between broadcasters and listeners:
- `JoinRoom(roomId)` - Connect to a broadcast room
- `SendAudioChunk(roomId, audioData)` - Stream audio chunks

### JavaScript Audio Module (`audio.js`)

Handles browser audio APIs:
- `startRecording()` - Capture microphone audio
- `stopRecording()` - Stop audio capture
- `playAudio()` - Play received audio chunks

### Components

- **Home.razor** - Landing page with feature cards
- **Broadcast.razor** - Broadcaster interface with QR code
- **Listen.razor** - Listener interface with connection status and QR code sharing
- **MainLayout.razor** - Navigation and footer

## Customization

### Styling

Edit `wwwroot/css/app.css` to customize:
- Colors and themes
- Animations
- Responsive breakpoints
- Card styles

### Audio Settings

Modify `wwwroot/audio.js` to adjust:
- Sample rate (default: 16000 Hz)
- Channel count (default: 1 - mono)
- Buffer size (default: 4096)

### SignalR Settings

Edit `Program.cs` to configure:
- Maximum message size
- Connection timeouts
- Hub options

## Troubleshooting

**Audio not working?**
- Ensure microphone permissions are granted
- Check browser console for errors
- Verify HTTPS connection (required for microphone access)

**Connection issues?**
- Check that SignalR hub is running
- Verify firewall settings
- Ensure proper network connectivity

**Mobile issues?**
- Use HTTPS (required for mobile microphone access)
- Check browser compatibility
- Ensure latest browser version

## License

This project is open source and available under the MIT License.

## Credits

Built with ?? using .NET 9, Blazor Server, and Bootstrap 5.

---

**Note:** For production use, consider adding:
- Authentication and authorization
- Room password protection
- Audio recording/playback history
- Multiple audio quality options
- Advanced error handling
