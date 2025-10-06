Feature: Channel Persistence for Listeners

As a listener  
I want the channel to remain open when the broadcaster leaves
So that I can wait for the broadcaster to return or for a new broadcaster to join

Background:
    Given the HugeVoice application is running
    And the SignalR hub is available

@channel-persistence @happy-path
Scenario: Channel remains open when broadcaster leaves
    Given I am listening to channel "Persistent-Channel"
    And there is an active broadcaster streaming audio
    When the broadcaster stops broadcasting
    Then I should remain connected to the channel
    And I should see "Waiting for broadcaster..." status
    And I should receive a "WaitingForBroadcaster" notification
    And the channel should remain available for new broadcasters

@channel-persistence @broadcaster-returns
Scenario: Original broadcaster returns to the same channel
    Given I am listening to channel "Return-Channel" 
    And the broadcaster has left but I remained connected
    And I am seeing "Waiting for broadcaster..." status
    When the original broadcaster reconnects and starts broadcasting again
    Then I should see "Live Audio" status
    And I should start receiving audio chunks immediately
    And I should receive "BroadcasterAvailable" notification

@channel-persistence @new-broadcaster
Scenario: New broadcaster joins channel after original leaves
    Given I am listening to channel "Handover-Channel"
    And the original broadcaster "Alice" has left
    And I am waiting for a broadcaster
    When a new broadcaster "Bob" joins the same channel
    And "Bob" starts broadcasting
    Then I should see "Live Audio" status
    And I should start receiving audio from "Bob"
    And I should receive "BroadcasterJoined" notification

@channel-persistence @multiple-listeners
Scenario: Multiple listeners wait together when broadcaster leaves
    Given users "Alice", "Bob", and "Charlie" are listening to channel "Multi-Wait"  
    And there is an active broadcaster streaming audio
    When the broadcaster leaves the channel
    Then all three listeners should remain connected
    And all should see "Waiting for broadcaster..." status
    And all should receive "WaitingForBroadcaster" notifications
    When a new broadcaster joins and starts streaming
    Then all three listeners should receive the audio stream
    And all should see "Live Audio" status

@channel-persistence @listener-experience
Scenario: Listener UI shows appropriate status during waiting
    Given I am listening to channel "Status-Test"
    And there is an active broadcaster
    When the broadcaster leaves
    Then I should see an hourglass icon instead of broadcast icon
    Then I should see warning-colored status instead of success-colored
    And I should see "Waiting for broadcaster..." message
    And I should see encouraging text "Channel is open, but no one is broadcasting yet. Stay connected!"
    And the audio activation button should be hidden while waiting

@channel-persistence @continuous-connection
Scenario: Maintain SignalR connection throughout broadcaster changes
    Given I am connected to channel "Connection-Test"
    When the broadcaster leaves and returns multiple times
    Then my SignalR connection should remain stable
    And I should not need to reconnect manually
    And I should receive all status change notifications
    And the room membership should persist throughout

@channel-persistence @qr-code-sharing
Scenario: Shared URLs continue to work when broadcaster is absent
    Given a broadcaster shared the QR code for channel "Shared-Wait"
    And the broadcaster has now left the channel  
    When a new user scans the QR code
    Then they should successfully connect to the channel
    And they should see "Waiting for broadcaster..." status
    And they should be ready to receive audio when broadcasting resumes

@channel-persistence @error-recovery
Scenario: Handle temporary connection issues during waiting
    Given I am waiting for a broadcaster on channel "Recovery-Test"
    When my internet connection is temporarily interrupted
    And the connection is restored
    Then I should automatically reconnect to the same channel
    And I should resume waiting for a broadcaster
    And I should receive updated status when a broadcaster joins

@channel-persistence @cleanup
Scenario: Clean up empty channels appropriately
    Given channel "Empty-Channel" has no active broadcaster  
    And all listeners have disconnected from the channel
    When the system performs cleanup
    Then the channel entry should be removed from server memory
    But when new users join the channel later
    Then they should be able to create and use the channel normally