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
    And I should be able to start broadcasting

@broadcasting @single-broadcaster
Scenario: Prevent multiple broadcasters on the same channel
    Given user "Alice" is already broadcasting on channel "Happy-Panda"
    When user "Bob" tries to connect to channel "Happy-Panda"
    And user "Bob" requests broadcaster role for "Happy-Panda"
    Then user "Bob" should be denied broadcaster role
    And user "Bob" should see "Channel Occupied: Another broadcaster is already active" message
    And user "Bob" should not be able to start broadcasting

@broadcasting @channel-management
Scenario: Generate and use custom channel names
    Given I am on the broadcast page
    When I generate a new channel ID
    Then I should see a fun animal-based channel name like "Brave-Bear" or "Silly-Monkey"
    When I enter a custom channel ID "MyCustomChannel"
    Then the channel ID should be updated to "MyCustomChannel"
    And the QR code should be updated with the new channel URL

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

@broadcasting @rejoin-channel
Scenario: Broadcaster can rejoin their own channel after leaving
    Given I was broadcasting on channel "My-Channel"
    And I stopped broadcasting but listeners remained connected
    When I reconnect to the same channel "My-Channel"
    And I request broadcaster role again
    Then I should be granted broadcaster role
    And listeners should receive "BroadcasterJoined" notification
    And listeners should see "Live Audio" status
    And I should be able to resume broadcasting

@broadcasting @channel-takeover
Scenario: New broadcaster can take over a channel after original leaves
    Given user "Alice" was broadcasting on channel "Takeover-Test"
    And "Alice" has left but listeners remain connected
    And listeners are seeing "Waiting for broadcaster..." status
    When user "Bob" connects to channel "Takeover-Test"
    And user "Bob" requests broadcaster role
    Then user "Bob" should be granted broadcaster role
    And listeners should receive "BroadcasterJoined" notification
    And listeners should start receiving audio from "Bob"