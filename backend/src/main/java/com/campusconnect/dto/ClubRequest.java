package com.campusconnect.dto;

import jakarta.validation.constraints.NotBlank;

public class ClubRequest {
    private String refId;

    @NotBlank(message = "Club name is required")
    private String name;

    @NotBlank(message = "Category is required")
    private String category;

    private String description;
    private String meetingSchedule;
    private String meetingLocation;
    private String facultyAdvisor;
    private boolean isPublished = true;
    private Long assignedAdminId;

    public ClubRequest() {}

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
}
