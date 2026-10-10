package com.campusconnect.dto;

import java.time.LocalDateTime;

public class AuditLogResponse {
    private Long id;
    private String actionType;
    private String actorEmail;
    private String actorRole;
    private String targetIdentifier;
    private String details;
    private String ipAddress;
    private String shaHash;
    private LocalDateTime createdAt;

    public AuditLogResponse() {}

    public AuditLogResponse(Long id, String actionType, String actorEmail, String actorRole, String targetIdentifier, String details, String ipAddress, String shaHash, LocalDateTime createdAt) {
        this.id = id;
        this.actionType = actionType;
        this.actorEmail = actorEmail;
        this.actorRole = actorRole;
        this.targetIdentifier = targetIdentifier;
        this.details = details;
        this.ipAddress = ipAddress;
        this.shaHash = shaHash;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }

    public String getActorEmail() { return actorEmail; }
    public void setActorEmail(String actorEmail) { this.actorEmail = actorEmail; }

    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }

    public String getTargetIdentifier() { return targetIdentifier; }
    public void setTargetIdentifier(String targetIdentifier) { this.targetIdentifier = targetIdentifier; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getShaHash() { return shaHash; }
    public void setShaHash(String shaHash) { this.shaHash = shaHash; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
