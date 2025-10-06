# HugeVoice BDD Specifications

This project contains Behavior-Driven Development (BDD) specifications for the HugeVoice real-time audio broadcasting application using Reqnroll (formerly SpecFlow).

## Feature Files

### 1. AudioBroadcasting.feature (formerly Calculator.feature)
Covers the core broadcasting functionality:
- Creating and starting broadcasts on new channels
- Single-broadcaster enforcement per channel
- Channel management and custom naming
- Connection handling and cleanup
- Broadcaster role management

### 2. AudioListening.feature
Covers the listening/receiving functionality:
- Connecting to channels and receiving audio
- QR code access and sharing
- Audio activation for browser compatibility
- Multiple listeners support
- Real-time audio playback

### 3. ChannelManagement.feature
Covers channel-related operations:
- Animal-based name generation ("Happy-Panda", "Brave-Bear", etc.)
- Custom channel naming
- Channel availability checking
- URL and QR code generation
- Channel state persistence

### 4. UserInterface.feature
Covers UI/UX aspects:
- Navigation between pages
- Responsive design
- Visual feedback and status indicators
- Accessibility features
- Error message display

### 5. AudioTechnology.feature
Covers technical audio functionality:
- Microphone permission handling
- Audio capture and processing
- Browser compatibility (Web Audio API)
- Audio quality and streaming
- Resource cleanup

### 6. RealTimeCommunication.feature
Covers SignalR and real-time communication:
- SignalR connection management
- Room/group joining and messaging
- Broadcasting message handling
- Connection recovery and error handling
- Multi-channel scalability

## Tags

The features use tags for organization and selective test execution:

- `@broadcasting` - Broadcasting functionality
- `@listening` - Listening/receiving functionality  
- `@channels` - Channel management
- `@ui` - User interface
- `@audio` - Audio technology
- `@signalr` - Real-time communication
- `@happy-path` - Main success scenarios
- `@error-handling` - Error and edge cases
- `@multi-user` - Multi-user interactions

## Step Definitions

The `HugeVoiceStepDefinitions.cs` file contains step definition placeholders that need to be implemented based on your testing approach:

- **Integration Testing**: Use ASP.NET Core TestServer for API testing
- **UI Testing**: Use Selenium WebDriver for browser automation
- **Unit Testing**: Test individual components in isolation

## Running Tests

```bash
# Run all tests
dotnet test

# Run tests with specific tags
dotnet test --filter "TestCategory=broadcasting"
dotnet test --filter "TestCategory=happy-path"

# Run tests for specific feature
dotnet test --filter "DisplayName~AudioBroadcasting"
```

## Implementation Notes

The step definitions are currently marked with `throw new PendingStepException()` and need to be implemented based on your testing strategy. Consider:

1. **Test Infrastructure**: Set up TestServer for integration tests
2. **Browser Automation**: Configure Selenium for UI tests  
3. **SignalR Testing**: Mock or test SignalR connections
4. **Audio Testing**: Mock audio APIs or use test audio files
5. **Multi-user Scenarios**: Implement concurrent user simulation

## Key Scenarios Covered

- Single broadcaster per channel enforcement
- Real-time audio streaming via SignalR
- QR code generation and sharing
- Browser audio permission handling
- Connection state management
- Error handling and recovery
- Multi-user concurrent access
- Channel naming and management
- UI responsiveness and accessibility

These specifications provide comprehensive coverage of the HugeVoice application's functionality and can guide both development and testing efforts.