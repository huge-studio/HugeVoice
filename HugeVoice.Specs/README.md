# HugeVoice BDD Specifications

This project contains Behavior-Driven Development (BDD) specifications for the HugeVoice real-time audio broadcasting application using Reqnroll (formerly SpecFlow).

## Feature Files

### 1. AudioBroadcasting.feature (formerly Calculator.feature)
Covers the core broadcasting functionality with **ENHANCED VALIDATION**:
- Creating and starting broadcasts on new channels
- **ENHANCED**: Multi-layer broadcaster validation system
- **ENHANCED**: Real-time channel status display
- **ENHANCED**: Comprehensive error handling and race condition prevention
- Channel management and custom naming
- Connection handling and cleanup
- Broadcaster role management
- Channel persistence when broadcaster leaves
- Broadcaster rejoining and channel takeover scenarios

### 2. BroadcasterValidation.feature ⭐ **NEW - COMPREHENSIVE VALIDATION**
Dedicated feature for the new **Enhanced Multi-Layer Broadcaster Validation System**:
- **Layer 1**: Self-broadcasting conflict prevention
- **Layer 2**: Client-side state validation  
- **Layer 3**: Server-side double-check validation
- **Layer 4**: Server-side atomic role request validation
- **Concurrent request handling** with race condition prevention
- **Comprehensive logging** for debugging
- **UI feedback** during validation process
- **Security validation** for unauthorized broadcasting attempts
- **Error recovery** and state synchronization

### 3. AudioListening.feature
Covers the listening/receiving functionality:
- Connecting to channels and receiving audio
- QR code access and sharing
- Audio activation for browser compatibility
- Multiple listeners support
- Real-time audio playback

### 4. ChannelManagement.feature
Covers channel-related operations:
- Animal-based name generation ("Happy-Panda", "Brave-Bear", etc.)
- Custom channel naming
- Channel availability checking
- URL and QR code generation
- Channel state persistence

### 5. UserInterface.feature **ENHANCED**
Covers UI/UX aspects with **NEW VALIDATION UI**:
- Navigation between pages
- Responsive design
- **NEW**: Enhanced channel status display with color coding
- **NEW**: Real-time status updates
- **NEW**: Enhanced error messaging for validation
- **NEW**: Visual feedback during validation process
- **NEW**: Consistent color coding system
- **NEW**: Loading states during validation
- Accessibility features
- Error message display

### 6. AudioTechnology.feature
Covers technical audio functionality:
- Microphone permission handling
- Audio capture and processing
- Browser compatibility (Web Audio API)
- Audio quality and streaming
- Resource cleanup

### 7. RealTimeCommunication.feature **SIGNIFICANTLY ENHANCED**
Covers SignalR and real-time communication with **NEW METHODS**:
- SignalR connection management
- **NEW**: Enhanced room joining with broadcaster flag
- **NEW**: Broadcaster validation SignalR methods (`CheckBroadcasterStatus`, `RequestBroadcasterRole`)
- **NEW**: Enhanced status notifications (`BroadcasterJoined`, `BroadcasterLeft`, `BroadcasterAvailable`, `WaitingForBroadcaster`)
- **NEW**: Audio transmission validation for every chunk
- **NEW**: Concurrent validation handling
- **NEW**: Debug information endpoint (`GetDebugInfo`)
- **NEW**: Enhanced error handling and logging
- Connection recovery and error handling
- Multi-channel scalability

### 8. ChannelPersistence.feature
Covers the channel persistence functionality:
- Channels remain open when broadcaster leaves
- Listeners can wait for broadcaster to return
- New broadcasters can take over empty channels
- Multiple listeners waiting together
- Appropriate UI status during waiting periods
- Continuous connection maintenance
- QR codes work even when broadcaster is absent

## Key New Features 🆕

### Enhanced Multi-Layer Broadcaster Validation System ⭐
The most significant addition is a **4-layer validation system** that prevents broadcaster conflicts:

#### **Layer 1: Self-Broadcasting Check**
- Prevents users from starting multiple broadcasts
- Client-side immediate validation
- Error: "You are already broadcasting on this channel"

#### **Layer 2: Client-Side State Validation**  
- Checks local `_channelHasBroadcaster` state
- Prevents unnecessary server calls
- Error: "This channel already has an active broadcaster"

#### **Layer 3: Server Double-Check Validation**
- Calls `CheckBroadcasterStatus` to verify server state
- Handles client-server state synchronization issues
- Error: "This channel already has an active broadcaster"

#### **Layer 4: Atomic Role Request Validation**
- Calls `RequestBroadcasterRole` with server-side locking
- Handles race conditions atomically
- Error: "Another broadcaster became active on this channel just now"

### Enhanced UI Components 🎨
- **Channel Status Display Card** with real-time updates
- **Color-coded status indicators** (Green=Available, Yellow=Occupied, Success=You're broadcaster)
- **Enhanced error messaging** with specific validation failure reasons
- **Real-time status updates** via SignalR notifications

### New SignalR Methods and Messages 📡
- `CheckBroadcasterStatus(roomId)` - Double-check validation
- `RequestBroadcasterRole(roomId)` - Atomic role request
- `GetDebugInfo()` - Debugging information
- `BroadcasterJoined` - New broadcaster notification
- `BroadcasterLeft` - Broadcaster departure notification  
- `BroadcasterAvailable` - Broadcaster ready notification
- `WaitingForBroadcaster` - Waiting status notification

### Comprehensive Logging and Debugging 🔍
- **Client-side console logging** for validation steps
- **Server-side detailed logging** with connection IDs and validation results
- **Debug endpoint** for troubleshooting broadcaster state
- **Validation layer tracking** for performance monitoring

## Tags

The features use tags for organization and selective test execution:

### Core Functionality Tags
- `@broadcasting` - Broadcasting functionality
- `@listening` - Listening/receiving functionality  
- `@channels` - Channel management
- `@ui` - User interface
- `@audio` - Audio technology
- `@signalr` - Real-time communication
- `@channel-persistence` - Channel persistence functionality

### New Validation Tags ⭐
- `@validation` - **NEW** General validation functionality
- `@multi-layer` - **NEW** Multi-layer validation system
- `@multi-layer-validation` - **NEW** Multi-layer validation scenarios
- `@validation-layers` - **NEW** Individual validation layer testing
- `@race-condition-prevention` - **NEW** Race condition handling
- `@channel-status-display` - **NEW** UI status display features
- `@error-handling-validation` - **NEW** Validation error handling
- `@debug-information` - **NEW** Debug and logging features
- `@enhanced-validation` - **NEW** Enhanced validation scenarios
- `@broadcaster-validation` - **NEW** Broadcaster-specific validation
- `@security-validation` - **NEW** Security validation features
- `@concurrent-validation` - **NEW** Concurrent request handling

### General Tags
- `@happy-path` - Main success scenarios
- `@error-handling` - Error and edge cases
- `@multi-user` - Multi-user interactions

## Running Tests

```bash
# Run all tests
dotnet test

# Run tests with specific tags
dotnet test --filter "TestCategory=validation"
dotnet test --filter "TestCategory=multi-layer-validation"
dotnet test --filter "TestCategory=broadcaster-validation"
dotnet test --filter "TestCategory=channel-status-display"

# Run tests for specific features
dotnet test --filter "DisplayName~BroadcasterValidation"
dotnet test --filter "DisplayName~AudioBroadcasting"
dotnet test --filter "DisplayName~RealTimeCommunication"
```

## Implementation Notes

The step definitions are currently marked with `throw new PendingStepException()` and need to be implemented based on your testing strategy. Consider:

1. **Test Infrastructure**: Set up TestServer for integration tests
2. **Browser Automation**: Configure Selenium for UI tests  
3. **SignalR Testing**: Mock or test SignalR connections and new validation methods
4. **Audio Testing**: Mock audio APIs or use test audio files
5. **Multi-user Scenarios**: Implement concurrent user simulation
6. **Channel Persistence Testing**: Test broadcaster disconnection and reconnection scenarios
7. **Validation Layer Testing**: Test each validation layer independently and together
8. **Race Condition Testing**: Test concurrent broadcaster requests
9. **UI Testing**: Test new channel status display and real-time updates
10. **Logging Testing**: Verify comprehensive logging and debug information

## Key Scenarios Covered

### Core Functionality ✅
- Single broadcaster per channel enforcement with **4-layer validation**
- Real-time audio streaming via SignalR
- QR code generation and sharing
- Browser audio permission handling
- Connection state management
- Error handling and recovery
- Multi-user concurrent access
- Channel naming and management
- UI responsiveness and accessibility

### Enhanced Validation Features ⭐
- **Multi-layer broadcaster validation** (4 layers of protection)
- **Race condition prevention** with atomic server-side operations
- **Real-time UI status updates** with color-coded indicators
- **Comprehensive error messaging** with specific failure reasons
- **Client-server state synchronization** via enhanced SignalR messaging
- **Security validation** for unauthorized broadcasting attempts
- **Debug information endpoints** for troubleshooting
- **Concurrent request handling** with proper locking mechanisms

### Channel Persistence Features ✅
- **Channels remain open when broadcaster leaves**
- **Listeners can wait for broadcaster to return or new broadcaster to join**
- **Graceful broadcaster handovers between users**
- **Persistent QR code sharing even when broadcaster is absent**
- **Enhanced status messaging and UI feedback**
- **Continuous connection maintenance during broadcaster changes**

## Benefits of Enhanced Validation System

### **🛡️ Security & Reliability**
1. **Prevents Channel Conflicts**: Multi-layer validation eliminates broadcaster collisions
2. **Race Condition Protection**: Atomic server-side operations handle concurrent requests
3. **Data Integrity**: Consistent server state maintained across all scenarios
4. **Security Validation**: Every audio chunk validated to prevent unauthorized broadcasting

### **🎯 User Experience**  
1. **Clear Visual Feedback**: Real-time status indicators with color coding
2. **Helpful Error Messages**: Specific validation failure reasons with guidance
3. **Instant Updates**: Real-time UI updates via SignalR notifications
4. **Predictable Behavior**: Users know exactly why validation failed and what to do

### **🔧 Developer Experience**
1. **Comprehensive Logging**: Detailed logs for debugging validation issues
2. **Debug Endpoints**: Runtime state inspection for troubleshooting
3. **Layer Separation**: Each validation layer can be tested and debugged independently
4. **Performance Monitoring**: Validation layer timing and success rates

### **📈 Scalability**
1. **Efficient Validation**: Early client-side checks reduce server load
2. **Atomic Operations**: Server-side locking prevents race conditions at scale
3. **Per-Channel Isolation**: Validation doesn't interfere between channels
4. **Optimized Messaging**: Targeted SignalR messages reduce network traffic

These specifications provide comprehensive coverage of the HugeVoice application's functionality including the new **Enhanced Multi-Layer Broadcaster Validation System**, and can guide both development and testing efforts to ensure rock-solid broadcaster conflict prevention! 🚀