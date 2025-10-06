Feature: Real-time Communication

As a user
I want reliable real-time communication
So that audio streaming works seamlessly across all connected clients

Background:
    Given the HugeVoice application is running
    And the SignalR hub is operational

@signalr @connection
Scenario: Establish SignalR connection
    Given I am accessing the application
    When I navigate to broadcast or listen pages
    Then a SignalR connection should be established to the audio hub
    And the connection should be maintained during the session
    And connection status should be displayed to the user

@signalr @enhanced-room-joining
Scenario: Enhanced room joining with broadcaster flag
    Given I am connected to the SignalR hub
    When I join a channel as a potential broadcaster
    Then I should call "JoinRoom" with isBroadcaster=true parameter
    And I should be added to the SignalR group for the channel
    And I should receive "RoomStatus" message with current broadcaster status
    When I join a channel as a listener
    Then I should call "JoinRoom" with isBroadcaster=false parameter
    And I should receive appropriate status based on current channel state

@signalr @broadcaster-validation-messages
Scenario: Enhanced broadcaster validation SignalR messages
    Given I am connected as a potential broadcaster
    When I request broadcaster role for a channel
    Then I should call "RequestBroadcasterRole" method
    And I should receive boolean response indicating success or failure
    When I check broadcaster status before attempting
    Then I should call "CheckBroadcasterStatus" method
    And I should receive current broadcaster status for the channel
    When broadcaster validation fails
    Then I should receive detailed "BroadcastError" messages

@signalr @enhanced-status-notifications
Scenario: Enhanced real-time status notifications
    Given I am connected to a channel
    When a broadcaster joins the channel
    Then I should receive "BroadcasterJoined" notification with connection ID
    When a broadcaster leaves the channel
    Then I should receive "BroadcasterLeft" notification with connection ID
    When I join a room and need status
    Then I should receive "RoomStatus" with current broadcaster state
    When I need to wait for broadcaster
    Then I should receive "WaitingForBroadcaster" notification
    When broadcaster becomes available
    Then I should receive "BroadcasterAvailable" notification

@signalr @audio-transmission-validation
Scenario: Enhanced audio transmission with validation
    Given I am an active broadcaster
    When I send audio chunks to the server
    Then the server should validate my broadcaster status for every chunk
    And the server should check I'm the active broadcaster for the room
    And the server should broadcast audio to all other clients in the room
    When I'm not the active broadcaster
    Then unauthorized transmission attempts should be rejected
    And I should receive specific "BroadcastError" messages
    And error should specify "You are not the active broadcaster for this channel"

@signalr @concurrent-validation-handling
Scenario: Handle concurrent broadcaster requests via SignalR
    Given multiple users are connected to the same channel
    When they request broadcaster role simultaneously
    Then SignalR should handle requests atomically using server-side locking
    And only one user should receive successful response
    And other users should receive false response
    And all clients should receive appropriate status notifications
    And server state should remain consistent

@signalr @debug-information-endpoint
Scenario: Debug information via SignalR
    Given I need to troubleshoot SignalR communication
    When I call "GetDebugInfo" method
    Then I should receive current broadcaster state information
    And I should see total active broadcasters count
    And I should see active broadcasters per channel mapping
    And I should see room listener counts
    And I should see my requesting connection ID
    And information should be logged on server for debugging

@signalr @connection-recovery
Scenario: Handle connection interruptions
    Given I have an active SignalR connection
    When the connection is temporarily lost
    Then the SignalR client should attempt to reconnect automatically
    And I should see appropriate connection status updates
    When the connection is restored
    Then I should rejoin my previous room automatically
    And I should receive updated broadcaster status information

@signalr @enhanced-error-handling
Scenario: Enhanced SignalR error handling and logging
    Given I am using SignalR communication
    When the server is unavailable
    Then I should see "Failed to connect to audio hub" error messages
    When message transmission fails
    Then errors should be logged with detailed information
    When hub method calls fail
    Then I should receive meaningful error feedback with specific reasons
    When validation fails
    Then I should receive user-friendly error messages
    And server should log detailed validation failure information

@signalr @scalability
Scenario: Support multiple concurrent channels with enhanced validation
    Given there are multiple active channels simultaneously
    When users are broadcasting and listening across different channels
    Then each channel should operate independently
    And broadcaster validation should work per-channel
    And messages should only be delivered to clients in the same room
    And the server should handle multiple concurrent connections efficiently
    And validation should not interfere between channels

@signalr @cleanup-and-persistence
Scenario: Enhanced cleanup and channel persistence
    Given I have active SignalR connections and room memberships
    When I close the browser or navigate away
    Then my connection should be properly cleaned up
    And I should be removed from any SignalR groups
    And my broadcaster role should be released if applicable
    And other clients should be notified of my disconnection
    But channels should remain open for remaining listeners
    And cleanup should be logged for debugging

@signalr @message-ordering
Scenario: Ensure proper message ordering for validation
    Given broadcaster status changes are occurring rapidly
    When multiple status update messages are sent
    Then messages should arrive in the correct order
    And clients should process status updates sequentially
    And UI should reflect the most current status
    And validation should be based on the latest server state

@signalr @security-validation
Scenario: SignalR security validation for broadcaster role
    Given I am connected to a channel
    When I attempt to send audio without proper broadcaster role
    Then server should validate my broadcaster status on every audio chunk
    And unauthorized audio transmission should be rejected
    And I should receive security-related error messages
    And server should log unauthorized transmission attempts
    And other clients should not receive unauthorized audio data

@signalr @batch-status-updates
Scenario: Efficient batch status updates
    Given multiple clients are connected to channels
    When broadcaster status changes occur
    Then server should efficiently notify all relevant clients
    And notifications should be batched where appropriate
    And each client should receive only relevant status updates
    And network traffic should be optimized
    And all clients should receive consistent status information