Feature: Audio Broadcasting

As a user
I want to broadcast audio to a named channel
So that others can listen to my audio stream in real-time

Background:
    Given the HugeVoice application is running
    And the SignalR hub is available

@broadcasting @happy-path
Scenario: Create and start broadcasting on a new channel
    Given I am on the broadcast page
    When I generate a random channel ID
    And I connect to the hub
    And I request broadcaster role for the channel
    Then I should become the active broadcaster for the channel
    And I should see "Channel Available: Ready to broadcast" message
    And I should see "? Channel available for broadcasting" status
    And I should be able to start broadcasting

@broadcasting @single-broadcaster @multi-layer-validation
Scenario: Prevent multiple broadcasters with enhanced validation
    Given user "Alice" is already broadcasting on channel "Happy-Panda"
    When user "Bob" connects to channel "Happy-Panda" as potential broadcaster
    Then user "Bob" should see "? Channel occupied by another broadcaster" status
    And user "Bob" should see "Channel Occupied: Another broadcaster is already active" warning
    When user "Bob" attempts to start broadcasting
    Then the system should perform client-side validation first
    And the system should perform server-side double-check validation
    And user "Bob" should be denied with message "This channel already has an active broadcaster"
    And user "Bob" should not be able to start broadcasting
    And the system should log the validation failure for debugging

@broadcasting @validation-layers
Scenario: Multi-layer broadcaster validation process
    Given I am on the broadcast page
    And I am connected to channel "Validation-Test"
    When another user starts broadcasting on "Validation-Test"
    Then I should receive "BroadcasterJoined" notification
    And my UI should update to show "? Channel occupied by another broadcaster"
    When I attempt to start broadcasting
    Then the system should check if I am already a broadcaster (layer 1)
    And the system should check client-side broadcaster status (layer 2)
    And the system should double-check with server using "CheckBroadcasterStatus" (layer 3)
    And the system should request broadcaster role from server (layer 4)
    And I should be denied at layer 3 with appropriate error message
    And I should see "This channel already has an active broadcaster. Please try a different channel."

@broadcasting @race-condition-prevention
Scenario: Handle concurrent broadcaster attempts safely
    Given channel "Race-Test" has no active broadcaster
    When user "Alice" and user "Bob" attempt to start broadcasting simultaneously
    Then only one user should be granted broadcaster role
    And the other user should receive "Another broadcaster became active on this channel just now"
    And the server should maintain consistent state
    And all validation layers should work correctly under race conditions

@broadcasting @channel-status-display
Scenario: Real-time channel status display
    Given I am connected to channel "Status-Display"
    When the channel has no broadcaster
    Then I should see "? Channel available for broadcasting" with green styling
    When another user becomes the broadcaster
    Then I should see "? Channel occupied by another broadcaster" with warning styling
    And the status should update in real-time via SignalR notifications
    When I become the broadcaster
    Then I should see "? You are the broadcaster" with success styling

@broadcasting @error-handling-validation
Scenario: Comprehensive error handling during validation
    Given I am attempting to broadcast on channel "Error-Test"
    When the SignalR connection is lost during validation
    Then I should see "Not connected to the server. Please try connecting first."
    When I am already broadcasting on another channel
    Then I should see "You are already broadcasting on this channel."
    When the server validation fails unexpectedly
    Then I should see appropriate error message with debugging information
    And the system should gracefully reset the broadcaster state

@broadcasting @debug-information
Scenario: Debug information for troubleshooting
    Given I am connected as an administrator or developer
    When I request debug information from the server
    Then I should receive current broadcaster state information
    And I should see total active broadcasters count
    And I should see active broadcasters per channel
    And I should see room listener counts
    And I should see my requesting connection ID
    And the information should be logged on the server for debugging

@broadcasting @channel-management
Scenario: Generate and use custom channel names
    Given I am on the broadcast page
    When I generate a new channel ID
    Then I should see a fun animal-based channel name like "Brave-Bear" or "Silly-Monkey"
    When I enter a custom channel ID "MyCustomChannel"
    Then the channel ID should be updated to "MyCustomChannel"
    And the QR code should be updated with the new channel URL
    And the channel status should be checked for the new channel

@broadcasting @connectivity
Scenario: Handle SignalR connection states
    Given I am on the broadcast page
    When the SignalR hub is not connected
    Then I should see "Connection Status: Not Connected" warning
    And I should see a "Create Channel" button
    When I click "Create Channel"
    Then the system should connect to the SignalR hub
    And I should join the specified room as a potential broadcaster
    And the connection status should show as connected
    And I should receive current channel status via "RoomStatus" message

@broadcasting @cleanup
Scenario: Release broadcaster role when stopping but keep channel open
    Given I am broadcasting on channel "Test-Channel"
    And there are listeners waiting in the channel
    When I stop broadcasting
    Then I should release the broadcaster role for "Test-Channel"
    And listeners should be notified that the broadcaster left
    And listeners should see "Waiting for broadcaster..." status
    And the channel should remain open for listeners
    And the channel should become available for new broadcasters
    And my UI should update to show "? Channel available for broadcasting"

@broadcasting @disconnection
Scenario: Handle broadcaster disconnection gracefully for listeners
    Given user "Alice" is broadcasting on channel "Lost-Connection"
    And there are multiple listeners in the channel
    When user "Alice" disconnects unexpectedly
    Then the broadcaster role for "Lost-Connection" should be automatically released
    And all listeners should receive "BroadcasterLeft" notification
    And all listeners should see "Waiting for broadcaster..." status
    And the channel should remain open for listeners to wait
    And the channel should become available for new broadcasters
    And the server should log the disconnection cleanup process

@broadcasting @rejoin-channel
Scenario: Broadcaster can rejoin their own channel after leaving
    Given I was broadcasting on channel "My-Channel"
    And I stopped broadcasting but listeners remained connected
    When I reconnect to the same channel "My-Channel"
    And I request broadcaster role again
    Then the validation system should allow me to regain broadcaster role
    And listeners should receive "BroadcasterJoined" notification
    And listeners should see "Live Audio" status
    And I should be able to resume broadcasting
    And my status should show "? You are the broadcaster"

@broadcasting @channel-takeover
Scenario: New broadcaster can take over a channel after original leaves
    Given user "Alice" was broadcasting on channel "Takeover-Test"
    And "Alice" has left but listeners remain connected
    And listeners are seeing "Waiting for broadcaster..." status
    When user "Bob" connects to channel "Takeover-Test"
    And user "Bob" requests broadcaster role
    Then the validation system should detect no active broadcaster
    And user "Bob" should be granted broadcaster role
    And listeners should receive "BroadcasterJoined" notification
    And listeners should start receiving audio from "Bob"
    And "Bob" should see "? You are the broadcaster" status