Feature: Channel Management

As a user
I want to manage audio channels effectively
So that I can organize and control audio broadcasting sessions

Background:
    Given the HugeVoice application is running

@channels @naming
Scenario: Generate fun animal-based channel names
    Given I am using the channel name generator
    When I request a new channel name
    Then I should receive a name in the format "Adjective-Animal"
    And the name should be easy to remember and share
    And examples should include names like "Happy-Panda", "Brave-Bear", "Silly-Monkey"

@channels @custom-names
Scenario: Use custom channel names
    Given I am on the broadcast page
    When I enter a custom channel ID "MyPodcast2024"
    Then the channel should be set to "MyPodcast2024"
    And the listener URL should be updated accordingly
    And the QR code should reflect the custom channel name

@channels @validation
Scenario: Handle invalid channel names
    Given I am on the broadcast page
    When I enter an empty channel ID
    Then I should not be able to connect to a channel
    When I enter a channel ID with special characters "Test@#$%"
    Then the system should handle the channel name appropriately

@channels @availability
Scenario: Check channel availability before broadcasting
    Given channel "Occupied-Channel" has an active broadcaster
    When I try to connect to "Occupied-Channel" as a broadcaster
    Then I should see that the channel is occupied
    And I should be prevented from broadcasting
    And I should be offered alternatives like trying a different channel

@channels @url-generation
Scenario: Generate shareable URLs for channels
    Given I have created channel "ShareThis-Channel"
    When I view the listener URL
    Then it should be in the format "https://[domain]/listen/ShareThis-Channel"
    And the URL should be copyable to clipboard
    And the URL should work when shared with others

@channels @qr-codes
Scenario: Generate QR codes for easy sharing
    Given I have created channel "QR-Test-Channel"
    When the system generates a QR code
    Then the QR code should contain the listener URL
    And the QR code should be scannable by mobile devices
    And scanning should redirect to the listen page

@channels @persistence
Scenario: Channel state management
    Given I am broadcasting on channel "Persistent-Channel"
    When I refresh the browser page
    Then I should maintain my broadcaster role
    And listeners should continue receiving audio
    When I close the browser tab
    Then the broadcaster role should be released
    And the channel should become available