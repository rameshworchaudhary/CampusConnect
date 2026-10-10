package com.campusconnect.dto;

import java.time.LocalDateTime;

public class EventResponse {
    private Long id;
    private Long clubId;
    private String clubName;
    private String title;
    private String description;
    private String eventDate;
    private String location;
    private String eventLink;
    private int capacity;
    private int registeredCount;
    private boolean isPublished;
    private boolean isPlatformEvent;
    private String badgeLabel;
    private boolean isUserRegistered;
    private LocalDateTime createdAt;

    public EventResponse() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getClubId() { return clubId; }
    public void setClubId(Long clubId) { this.clubId = clubId; }

    public String getClubName() { return clubName; }
    public void setClubName(String clubName) { this.clubName = clubName; }

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

    public int getRegisteredCount() { return registeredCount; }
    public void setRegisteredCount(int registeredCount) { this.registeredCount = registeredCount; }

    public boolean isPublished() { return isPublished; }
    public void setPublished(boolean published) { isPublished = published; }

    public boolean isPlatformEvent() { return isPlatformEvent; }
    public void setPlatformEvent(boolean platformEvent) { isPlatformEvent = platformEvent; }

    public String getBadgeLabel() { return badgeLabel; }
    public void setBadgeLabel(String badgeLabel) { this.badgeLabel = badgeLabel; }

    public boolean isUserRegistered() { return isUserRegistered; }
    public void setUserRegistered(boolean userRegistered) { isUserRegistered = userRegistered; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
