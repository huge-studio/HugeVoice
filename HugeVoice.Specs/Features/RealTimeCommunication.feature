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

@signalr @rooms
Scenario: Join and manage SignalR rooms
    Given I am connected to the SignalR hub
    When I specify a channel ID "Test-Room"
    Then I should join the SignalR group for "Test-Room"
    And I should be able to send and receive messages within that group
    When I change to a different channel "New-Room"
    Then I should leave "Test-Room" and join "New-Room"

@signalr @broadcasting-messages
Scenario: Handle broadcasting-related SignalR messages
    Given I am connected as a potential broadcaster
    When I request broadcaster role for a channel
    Then I should receive a boolean response indicating success or failure
    When another user becomes a broadcaster in my channel
    Then I should receive a "BroadcasterChanged" notification
    When there are broadcast errors
    Then I should receive "BroadcastError" messages with details

@signalr @audio-transmission
Scenario: Transmit audio data via SignalR
    Given I am an active broadcaster
    When I send audio chunks to the server
    Then the server should validate my broadcaster status
    And the server should broadcast the audio to all other clients in the room
    And unauthorized transmission attempts should be rejected

@signalr @listener-notifications
Scenario: Receive real-time status updates as a listener
    Given I am listening to a channel
    When a broadcaster joins the channel
    Then I should receive "BroadcasterChanged" notification with active status
    When a broadcaster leaves the channel
    Then I should receive "BroadcasterChanged" notification with inactive status
    When I join a room with an existing broadcaster
    Then I should receive "RoomStatus" information about the current state

@signalr @connection-recovery
Scenario: Handle connection interruptions
    Given I have an active SignalR connection
    When the connection is temporarily lost
    Then the SignalR client should attempt to reconnect automatically
    And I should see appropriate connection status updates
    When the connection is restored
    Then I should rejoin my previous room automatically

@signalr @scalability
Scenario: Support multiple concurrent channels
    Given there are multiple active channels simultaneously
    When users are broadcasting and listening across different channels
    Then each channel should operate independently
    And messages should only be delivered to clients in the same room
    And the server should handle multiple concurrent connections efficiently

@signalr @cleanup
Scenario: Clean up connections and resources
    Given I have active SignalR connections and room memberships
    When I close the browser or navigate away
    Then my connection should be properly cleaned up
    And I should be removed from any SignalR groups
    And my broadcaster role should be released if applicable
    And other clients should be notified of my disconnection

@signalr @error-handling
Scenario: Handle SignalR communication errors
    Given I am using SignalR communication
    When the server is unavailable
    Then I should see appropriate connection error messages
    When message transmission fails
    Then errors should be logged and handled gracefully
    When the hub method calls fail
    Then I should receive meaningful error feedback