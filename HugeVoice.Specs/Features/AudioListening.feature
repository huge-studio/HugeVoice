Feature: Audio Listening

As a user
I want to listen to audio broadcasts from a specific channel
So that I can hear real-time audio streams from broadcasters

Background:
    Given the HugeVoice application is running
    And the SignalR hub is available

@listening @happy-path
Scenario: Connect to a channel and listen to audio
    Given there is an active broadcaster on channel "Happy-Panda"
    When I navigate to the listen page for channel "Happy-Panda"
    Then I should connect to the SignalR hub
    And I should join the "Happy-Panda" room
    And I should see "Connected" status with spinning indicator
    And I should be ready to receive audio chunks

@listening @qr-code
Scenario: Access channel via QR code
    Given a broadcaster has shared a QR code for channel "Shared-Channel"
    When I scan the QR code
    Then I should be redirected to the listen page for "Shared-Channel"
    And I should automatically connect to the audio stream

@listening @audio-activation
Scenario: Activate audio context for browser compatibility
    Given I am on the listen page for channel "Test-Channel"
    And the browser requires user interaction for audio
    When I see the "Tap here if you don't hear anything" button
    And I click the audio activation button
    Then the audio context should be activated
    And I should see "Audio ready!" confirmation
    And the activation button should be hidden

@listening @channel-sharing
Scenario: Share listening URL with others
    Given I am listening to channel "Popular-Stream"
    When I view the listener URL field
    Then I should see the full URL for the channel
    And I should be able to copy the URL to clipboard
    When I share the URL with another user
    Then they should be able to access the same audio stream

@listening @connection-handling
Scenario: Handle connection errors gracefully
    Given I try to connect to channel "Non-Existent-Channel"
    When the SignalR connection fails
    Then I should see an appropriate error message
    And I should see connection troubleshooting information

@listening @multiple-listeners
Scenario: Support multiple listeners on the same channel
    Given there is an active broadcaster on channel "Multi-Listen"
    When user "Alice" connects to channel "Multi-Listen"
    And user "Bob" connects to channel "Multi-Listen"
    And user "Charlie" connects to channel "Multi-Listen"
    Then all three users should receive the same audio stream
    And the broadcaster should be able to stream to all listeners simultaneously

@listening @real-time-audio
Scenario: Receive and play audio chunks in real-time
    Given I am connected to channel "Live-Audio"
    And there is an active broadcaster streaming audio
    When the broadcaster sends audio chunks
    Then I should receive the audio data via SignalR
    And the audio should be played through the browser's audio system
    And the audio should play with minimal latency