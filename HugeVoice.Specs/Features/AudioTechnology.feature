Feature: Audio Technology Integration

As a user
I want reliable audio capture and playback
So that I can broadcast and listen to high-quality audio streams

Background:
    Given the HugeVoice application is running
    And the browser supports Web Audio APIs

@audio @microphone
Scenario: Request and handle microphone permissions
    Given I am on the broadcast page
    When I start broadcasting
    Then the browser should request microphone permission
    When I grant microphone permission
    Then the system should access the microphone successfully
    When I deny microphone permission
    Then I should see appropriate error guidance

@audio @capture
Scenario: Capture audio from microphone
    Given I have granted microphone permission
    And I am broadcasting on a channel
    When I speak into the microphone
    Then the audio should be captured in real-time
    And the audio should be processed into chunks
    And the chunks should be encoded for transmission

@audio @streaming
Scenario: Stream audio via SignalR
    Given I am actively broadcasting
    When audio chunks are captured
    Then they should be sent via SignalR to the server
    And the server should broadcast them to all listeners in the room
    And the transmission should maintain audio quality

@audio @playback
Scenario: Play received audio on listener side
    Given I am listening to a channel with active broadcast
    When I receive audio chunks via SignalR
    Then the audio should be decoded from base64
    And the audio should be played through the browser's audio system
    And the playback should be smooth and continuous

@audio @browser-compatibility
Scenario: Handle browser audio context restrictions
    Given I am on a browser that requires user interaction for audio
    When I first load the listen page
    Then I should see an audio activation button
    When I click the activation button
    Then the audio context should be activated
    And subsequent audio should play automatically

@audio @quality
Scenario: Maintain audio quality during transmission
    Given I am broadcasting high-quality audio
    When the audio is captured, transmitted, and played
    Then the quality should be preserved as much as possible
    And latency should be minimized for real-time experience
    And there should be no significant audio artifacts

@audio @error-recovery
Scenario: Handle audio system errors gracefully
    Given I am using the audio system
    When the microphone becomes unavailable during broadcast
    Then I should receive an appropriate error message
    And broadcasting should stop gracefully
    When audio playback fails on the listener side
    Then the error should be logged and handled without crashing

@audio @multiple-streams
Scenario: Support concurrent audio streams
    Given there are multiple active channels
    When different broadcasters are streaming on different channels
    Then each stream should be isolated
    And listeners should only receive audio from their joined channel
    And there should be no cross-channel audio leakage

@audio @cleanup
Scenario: Clean up audio resources
    Given I am using audio resources
    When I stop broadcasting
    Then microphone access should be released
    And audio processing should stop
    When I leave a listening session
    Then audio playback resources should be cleaned up
    And no background audio processing should continue