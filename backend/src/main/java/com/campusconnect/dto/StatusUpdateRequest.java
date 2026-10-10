package com.campusconnect.dto;

public class StatusUpdateRequest {
    private boolean active;

    public StatusUpdateRequest() {}

    public StatusUpdateRequest(boolean active) {
        this.active = active;
    }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
