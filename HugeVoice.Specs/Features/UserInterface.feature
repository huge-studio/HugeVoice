Feature: User Interface and Navigation

As a user
I want an intuitive and responsive user interface
So that I can easily navigate and use the HugeVoice application

Background:
    Given the HugeVoice application is running

@ui @navigation
Scenario: Navigate between main pages
    Given I am on the home page
    When I view the main navigation
    Then I should see options for "Start Broadcasting" and "Listen to Broadcast"
    When I click "Start Broadcasting"
    Then I should be taken to the broadcast page
    When I click "Listen to Broadcast" or access a listen URL
    Then I should be taken to the listen page

@ui @responsive
Scenario: Responsive design across devices
    Given I am using the application on different screen sizes
    When I view the page on desktop
    Then the layout should be optimized for large screens with side-by-side content
    When I view the page on mobile
    Then the layout should stack vertically for better mobile experience
    And all buttons and controls should remain accessible

@ui @broadcasting-interface
Scenario: Broadcasting page user interface
    Given I am on the broadcast page
    Then I should see a QR code generation area
    And I should see channel setup controls
    And I should see a channel ID input field with generate button
    And I should see copy buttons for sharing
    And I should see connection status indicators
    And I should see broadcasting control buttons
    And I should see the new channel status display card

@ui @channel-status-display
Scenario: Enhanced channel status display
    Given I am connected to a channel on the broadcast page
    When the channel has no broadcaster
    Then I should see a success-colored status card
    And I should see "? Channel available for broadcasting" with green check icon
    When another user becomes the broadcaster
    Then I should see a warning-colored status card
    And I should see "? Channel occupied by another broadcaster" with warning icon
    When I become the broadcaster
    Then I should see a success-colored status card
    And I should see "? You are the broadcaster" with broadcast icon

@ui @real-time-status-updates
Scenario: Real-time UI status updates
    Given I am on the broadcast page
    When broadcaster status changes occur
    Then the channel status card should update immediately
    And the status colors should change appropriately
    And the status icons should update
    And the status text should reflect current state
    And updates should happen without page refresh

@ui @listening-interface
Scenario: Listening page user interface
    Given I am on the listen page for a channel
    Then I should see the channel connection status
    And I should see a QR code for sharing
    And I should see the room ID and listener URL
    And I should see audio status indicators
    And I should see an audio activation button if needed
    And I should see appropriate waiting/listening status displays

@ui @visual-feedback
Scenario: Visual feedback for user actions
    Given I am using the application
    When I am connecting to a channel
    Then I should see loading spinners and progress indicators
    When I successfully connect
    Then I should see success messages with green styling
    When an error occurs
    Then I should see error messages with red styling and warning icons
    When I am broadcasting
    Then I should see live indicators with animated elements
    When validation fails
    Then I should see specific error messages with helpful guidance

@ui @enhanced-error-messaging
Scenario: Enhanced error messaging for validation
    Given I am attempting to broadcast
    When single-broadcaster validation fails
    Then I should see "Another broadcaster is already active on this channel"
    And I should see "Please try a different channel" guidance
    When I'm already broadcasting
    Then I should see "You are already broadcasting on this channel"
    When connection fails
    Then I should see "Not connected to the server. Please try connecting first"
    When race condition occurs
    Then I should see "Another broadcaster became active on this channel just now"

@ui @accessibility
Scenario: Accessibility features
    Given I am using the application with accessibility needs
    When I navigate using keyboard only
    Then all interactive elements should be accessible via keyboard
    When I use a screen reader
    Then appropriate ARIA labels and descriptions should be available
    And status changes should be announced
    And channel status changes should be communicated to screen readers

@ui @home-page
Scenario: Home page information and guidance
    Given I am on the home page
    Then I should see the HugeVoice branding and logo
    And I should see a clear explanation of how the app works
    And I should see the three-step process: "Create a channel", "Share your channel", "Start broadcasting"
    And I should see attractive cards for "Start Broadcasting" and "Listen to Broadcast"
    And I should see helpful information about QR codes and channel names

@ui @improved-warning-messages
Scenario: Enhanced warning and information messages
    Given I am on the broadcast page
    When I view the warning section
    Then I should see information about microphone permissions
    And I should see "Single Broadcaster Rule" explanation
    And I should see "Only one broadcaster is allowed per channel at a time"
    And I should see information about validation errors
    And the warning should be more comprehensive than before

@ui @color-coding-system
Scenario: Consistent color coding for status
    Given I am using the application
    When I see success states
    Then they should use green colors consistently
    When I see warning states
    Then they should use yellow/orange colors consistently
    When I see error states
    Then they should use red colors consistently
    When I see info states
    Then they should use blue colors consistently
    And color coding should be consistent across all components

@ui @loading-states
Scenario: Loading states during validation
    Given I am attempting to start broadcasting
    When validation is in progress
    Then UI should show appropriate loading indicators
    And buttons should be disabled during validation
    And status should indicate "checking broadcaster status" or similar
    And loading should complete with success or error state

@ui @responsive-status-cards
Scenario: Responsive channel status cards
    Given I am viewing the channel status card
    When I view it on different screen sizes
    Then the card should adapt to screen width
    And text should remain readable
    And icons should remain visible
    And color coding should be preserved
    And the card should integrate well with the overall layout