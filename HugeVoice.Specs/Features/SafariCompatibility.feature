Feature: Safari and iOS Audio Compatibility

As a Safari or iOS user
I want reliable audio playback functionality
So that I can participate in HugeVoice audio broadcasts without technical issues

Background:
    Given the HugeVoice application is running
    And I am using Safari or iOS Safari browser

@safari @ios @audio-compatibility
Scenario: Safari audio context activation
    Given I am on the listen page for a channel
    When I first load the page
    Then I should see a prominent "Enable Audio Playback" button
    And I should see Safari-specific instructions
    When I click "Enable Audio Playback"
    Then the audio context should be properly initialized for Safari
    And I should see "? Audio Ready!" confirmation
    And the button should be replaced with success message

@safari @ios @audio-unlocking
Scenario: Safari audio context unlocking with silent buffer
    Given I am activating audio on Safari or iOS
    When the audio context activation is triggered
    Then the system should create a silent audio buffer
    And the system should play the silent buffer to unlock audio
    And the audio context should transition to "running" state
    And subsequent audio should play without issues

@safari @ios @audio-queueing
Scenario: Audio queueing when context not ready
    Given I am on the listen page
    And the audio context is not yet activated
    When I receive audio chunks from a broadcaster
    Then the audio should be queued for later playback
    And I should see a message about audio activation being required
    When I activate the audio context
    Then all queued audio should be played in order
    And future audio should play immediately

@safari @ios @browser-detection
Scenario: Safari and iOS browser detection
    Given I am using Safari on desktop or iOS Safari
    When I visit any page with audio functionality
    Then the system should detect my browser type
    And I should see Safari-specific instructions and tips
    And the audio processing should use Safari-optimized settings
    And buffer sizes should be optimized for Safari (2048 vs 4096)

@safari @ios @audio-processing
Scenario: Safari-optimized audio processing
    Given I am broadcasting from Safari or iOS
    When I start recording audio
    Then the system should use smaller buffer sizes for Safari (2048 samples)
    And audio processing should use Safari-compatible methods
    And the system should handle webkitAudioContext fallback
    And audio conversion should use proper Safari-compatible bit depth handling

@safari @ios @user-interaction-requirement
Scenario: Handle Safari's user interaction requirement
    Given I am on Safari or iOS Safari
    When I try to play audio before user interaction
    Then the audio should be queued instead of failing
    And I should see clear instructions about needing to enable audio
    When I interact with the page (tap/click)
    Then the audio context should be unlocked automatically
    And queued audio should begin playing

@safari @ios @audio-testing
Scenario: Safari audio testing functionality
    Given I am on the About page using Safari or iOS
    When I click "Test Audio Playback"
    Then the system should activate the audio context with user interaction
    And a test tone should be generated and played
    And I should hear a 440Hz tone for 0.5 seconds
    And the system should confirm that audio is working
    And Safari-specific tips should be displayed

@safari @ios @error-handling
Scenario: Safari-specific error handling
    Given I am using Safari or iOS Safari
    When audio activation fails
    Then I should see Safari-specific error messages
    And I should get troubleshooting tips for Safari/iOS
    And the system should suggest refreshing the page
    And I should be advised to check silent mode and volume

@safari @ios @volume-controls
Scenario: Safari volume and silent mode handling
    Given I am listening on iOS Safari
    When my device is in silent mode
    Then I should see tips about checking silent mode
    And I should see instructions to use the volume buttons
    And I should see recommendations to use headphones
    When I have low volume
    Then I should see tips about turning up device volume

@safari @ios @qr-code-scanning
Scenario: iOS Safari QR code scanning integration
    Given someone shares a HugeVoice QR code
    When I scan it with iOS Camera app
    Then it should open in Safari with audio functionality
    And I should immediately see audio activation instructions
    And the audio system should be ready for Safari
    And I should get iOS-specific usage tips

@safari @ios @connection-stability
Scenario: Safari WebSocket and SignalR stability
    Given I am connected to a HugeVoice channel on Safari
    When the connection is maintained over time
    Then Safari should maintain stable SignalR connections
    And audio streaming should continue without dropouts
    And connection recovery should work on Safari
    And the system should handle Safari's memory management

@safari @ios @performance-optimization
Scenario: Safari performance optimization
    Given I am using Safari or iOS Safari
    When processing audio in real-time
    Then the system should use Safari-optimized buffer sizes
    And memory usage should be optimized for Safari
    And the system should handle Safari's garbage collection
    And performance should be stable over extended use

@safari @ios @multiple-tabs
Scenario: Safari multiple tab handling
    Given I have multiple HugeVoice tabs open in Safari
    When I switch between tabs
    Then audio should pause in background tabs (Safari behavior)
    And audio should resume when tab becomes active
    And the system should handle Safari's tab throttling
    And each tab should maintain its own audio context

@safari @ios @offline-online
Scenario: Safari offline/online handling
    Given I am using HugeVoice on Safari
    When my internet connection drops temporarily
    Then Safari should handle reconnection gracefully
    And audio should resume when connection is restored
    And the system should handle Safari's network change events
    And cached audio contexts should be preserved

@safari @ios @autoplay-policy
Scenario: Safari autoplay policy compliance
    Given Safari's strict autoplay policies are in effect
    When I visit a HugeVoice page
    Then no audio should attempt to play automatically
    And all audio playback should require explicit user interaction
    And the system should be compliant with Safari's autoplay policies
    And users should be clearly informed about activation requirements

@safari @ios @accessibility
Scenario: Safari accessibility for audio features
    Given I am using Safari with accessibility features
    When I use VoiceOver or other assistive technology
    Then audio activation buttons should be properly labeled
    And audio status should be announced by screen readers
    And keyboard navigation should work for all audio controls
    And Safari's accessibility features should be supported