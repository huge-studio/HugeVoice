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

@ui @listening-interface
Scenario: Listening page user interface
    Given I am on the listen page for a channel
    Then I should see the channel connection status
    And I should see a QR code for sharing
    And I should see the room ID and listener URL
    And I should see audio status indicators
    And I should see an audio activation button if needed

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

@ui @accessibility
Scenario: Accessibility features
    Given I am using the application with accessibility needs
    When I navigate using keyboard only
    Then all interactive elements should be accessible via keyboard
    When I use a screen reader
    Then appropriate ARIA labels and descriptions should be available
    And status changes should be announced

@ui @home-page
Scenario: Home page information and guidance
    Given I am on the home page
    Then I should see the HugeVoice branding and logo
    And I should see a clear explanation of how the app works
    And I should see the three-step process: "Create a channel", "Share your channel", "Start broadcasting"
    And I should see attractive cards for "Start Broadcasting" and "Listen to Broadcast"
    And I should see helpful information about QR codes and channel names

@ui @error-handling
Scenario: User-friendly error messages
    Given I encounter various error conditions
    When a connection fails
    Then I should see "Failed to connect to audio hub" with details
    When microphone access is denied
    Then I should see appropriate browser permission guidance
    When a channel is occupied
    Then I should see "Channel Occupied: Another broadcaster is already active"
    And I should be provided with actionable next steps