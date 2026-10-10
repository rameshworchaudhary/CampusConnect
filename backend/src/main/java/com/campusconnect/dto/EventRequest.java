package com.campusconnect.dto;

import jakarta.validation.constraints.NotBlank;

public class EventRequest {
    private Long clubId;

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    @NotBlank(message = "Event date is required")
    private String eventDate;

    @NotBlank(message = "Location is required")
    private String location;

    private String eventLink;

    private int capacity = 100;
    private boolean isPublished = true;
    private boolean isPlatformEvent = false;
    private String badgeLabel = "Open RSVP";

    public EventRequest() {}

    public Long getClubId() { return clubId; }
    public void setClubId(Long clubId) { this.clubId = clubId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getEventDate() { return eventDate; }
    public void setEventDate(String eventDate) { this.eventDate = eventDate; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getEventLink() { return eventLink; }
    public void setEventLink(String eventLink) { this.eventLink = eventLink; }

    public int getCapacity() { return capacity; }
    public void setCapacity(int capacity) { this.capacity = capacity; }

    public boolean isPublished() { return isPublished; }
    public void setPublished(boolean published) { isPublished = published; }

    public boolean isPlatformEvent() { return isPlatformEvent; }
    public void setPlatformEvent(boolean platformEvent) { isPlatformEvent = platformEvent; }

    public String getBadgeLabel() { return badgeLabel; }
    public void setBadgeLabel(String badgeLabel) { this.badgeLabel = badgeLabel; }
}
