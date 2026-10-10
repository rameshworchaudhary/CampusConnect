package com.campusconnect.dto;

public class ClubResponse {
    private Long id;
    private String refId;
    private String name;
    private String category;
    private String description;
    private String meetingSchedule;
    private String meetingLocation;
    private String facultyAdvisor;
    private boolean isPublished;
    private Long assignedAdminId;
    private String assignedAdminName;
    private long memberCount;
    private long pendingRequestCount;
    private String userMembershipStatus; // "NONE", "PENDING", "APPROVED", "REJECTED"

    public ClubResponse() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRefId() { return refId; }
    public void setRefId(String refId) { this.refId = refId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getMeetingSchedule() { return meetingSchedule; }
    public void setMeetingSchedule(String meetingSchedule) { this.meetingSchedule = meetingSchedule; }

    public String getMeetingLocation() { return meetingLocation; }
    public void setMeetingLocation(String meetingLocation) { this.meetingLocation = meetingLocation; }

    public String getFacultyAdvisor() { return facultyAdvisor; }
    public void setFacultyAdvisor(String facultyAdvisor) { this.facultyAdvisor = facultyAdvisor; }

    public boolean isPublished() { return isPublished; }
    public void setPublished(boolean published) { isPublished = published; }

    public Long getAssignedAdminId() { return assignedAdminId; }
    public void setAssignedAdminId(Long assignedAdminId) { this.assignedAdminId = assignedAdminId; }

    public String getAssignedAdminName() { return assignedAdminName; }
    public void setAssignedAdminName(String assignedAdminName) { this.assignedAdminName = assignedAdminName; }

    public long getMemberCount() { return memberCount; }
    public void setMemberCount(long memberCount) { this.memberCount = memberCount; }

    public long getPendingRequestCount() { return pendingRequestCount; }
    public void setPendingRequestCount(long pendingRequestCount) { this.pendingRequestCount = pendingRequestCount; }

    public String getUserMembershipStatus() { return userMembershipStatus; }
    public void setUserMembershipStatus(String userMembershipStatus) { this.userMembershipStatus = userMembershipStatus; }
}
