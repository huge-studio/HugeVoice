Feature: Enhanced Broadcaster Validation

As a system administrator
I want robust multi-layer broadcaster validation
So that the system prevents channel conflicts and maintains data integrity

Background:
    Given the HugeVoice application is running
    And the SignalR hub is available
    And the enhanced validation system is active

@validation @multi-layer
Scenario: Four-layer validation process
    Given I am attempting to broadcast on channel "Validation-Test"
    When I click "Start Broadcasting"
    Then the system should execute Layer 1: Check if already broadcasting
    And the system should execute Layer 2: Check client-side broadcaster status
    And the system should execute Layer 3: Server-side double-check validation
    And the system should execute Layer 4: Server-side role request validation
    And each layer should be logged for debugging purposes
    And validation should fail at the first applicable layer

@validation @layer-1-self-check
Scenario: Layer 1 - Prevent self-broadcasting conflict
    Given I am already broadcasting on channel "Self-Test"
    When I attempt to start broadcasting again
    Then Layer 1 validation should catch this immediately
    And I should see "You are already broadcasting on this channel."
    And no server calls should be made
    And the validation should stop at Layer 1

@validation @layer-2-client-state
Scenario: Layer 2 - Client-side state validation
    Given I am connected to channel "Client-State-Test"
    And another user is broadcasting (client knows via _channelHasBroadcaster)
    When I attempt to start broadcasting
    Then Layer 1 should pass (not already broadcasting myself)
    And Layer 2 should fail due to client-side state
    And I should see appropriate error message
    And validation should stop at Layer 2

@validation @layer-3-server-doublecheck
Scenario: Layer 3 - Server double-check validation
    Given I am connected to channel "DoubleCheck-Test"
    And client-side state shows channel as available
    But server actually has an active broadcaster
    When I attempt to start broadcasting
    Then Layer 1 and Layer 2 should pass
    And Layer 3 server double-check should fail
    And I should see "This channel already has an active broadcaster"
    And client state should be updated to reflect server state
    And validation should stop at Layer 3

@validation @layer-4-role-request
Scenario: Layer 4 - Server role request validation
    Given I am connected to channel "RoleRequest-Test"
    And all previous layers pass validation
    But another user requests broadcaster role simultaneously
    When I attempt to start broadcasting
    Then Layers 1, 2, and 3 should pass
    And Layer 4 server role request should handle race condition
    And only one user should be granted broadcaster role
    And the other should see "Another broadcaster became active on this channel just now"

@validation @server-side-logging
Scenario: Comprehensive server-side logging
    Given I am attempting broadcaster validation
    When each validation step occurs
    Then the server should log connection IDs and channel names
    And the server should log existing broadcaster information
    And the server should log validation results
    And the server should log race condition handling
    And logs should include timestamp and connection details

@validation @client-side-logging
Scenario: Client-side console logging for debugging
    Given I am in development mode
    When broadcaster validation occurs
    Then console should log "Requesting broadcaster role for channel: [ChannelId]"
    And console should log "Server broadcaster status check result: [true/false]"
    And console should log "Broadcaster role request result: [true/false]"
    And console should log "Successfully became broadcaster" or appropriate error
    And console should log validation layer failures

@validation @ui-feedback
Scenario: Real-time UI feedback during validation
    Given I am on the broadcast page
    When broadcaster validation is in progress
    Then UI should show appropriate loading states
    And status should update in real-time
    And error messages should be user-friendly
    And success messages should be clear
    And channel status card should reflect current state

@validation @concurrent-requests
Scenario: Handle multiple concurrent validation requests
    Given channel "Concurrent-Test" has no active broadcaster
    When 3 users attempt to become broadcaster simultaneously
    Then server should handle requests atomically
    And only 1 user should be granted broadcaster role
    And 2 users should receive denial messages
    And server state should remain consistent
    And all clients should receive correct status updates

@validation @error-recovery
Scenario: Validation error recovery
    Given broadcaster validation fails due to network error
    When I retry the broadcast attempt
    Then the system should reset validation state
    And all validation layers should execute again
    And previous failed state should not affect new attempt
    And error messages should be cleared

@validation @debug-endpoints
Scenario: Debug information for troubleshooting
    Given I need to troubleshoot broadcaster validation issues
    When I call the debug endpoint
    Then I should receive current active broadcasters list
    And I should see room listener counts
    And I should see my connection ID
    And I should see total broadcaster count
    And information should help identify validation problems

@validation @state-synchronization
Scenario: Client-server state synchronization
    Given I am connected to a channel
    When broadcaster status changes occur
    Then client should receive "RoomStatus" updates
    And client should receive "BroadcasterJoined" notifications
    And client should receive "BroadcasterLeft" notifications
    And client UI should synchronize with server state
    And validation decisions should be based on current state

@validation @security-validation
Scenario: Security validation for unauthorized broadcasting
    Given user "Attacker" attempts to bypass validation
    When "Attacker" tries to send audio without broadcaster role
    Then server should validate broadcaster status for every audio chunk
    And unauthorized audio should be rejected
    And "Attacker" should receive "BroadcastError" message
    And server should log the unauthorized attempt
    And other users should not receive the unauthorized audio