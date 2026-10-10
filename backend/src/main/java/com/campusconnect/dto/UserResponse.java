package com.campusconnect.dto;

import com.campusconnect.entity.Role;

public class UserResponse {
    private Long id;
    private String fullName;
    private String email;
    private String studentId;
    private String department;
    private Role role;
    private boolean isActive;
    private boolean isVerified;
    private Long assignedClubId;
    private String assignedClubName;

    public UserResponse() {}

    public UserResponse(Long id, String fullName, String email, String studentId, String department, Role role, boolean isActive, boolean isVerified, Long assignedClubId, String assignedClubName) {
        this.id = id;
        this.fullName = fullName;
        this.email = email;
        this.studentId = studentId;
        this.department = department;
        this.role = role;
        this.isActive = isActive;
        this.isVerified = isVerified;
        this.assignedClubId = assignedClubId;
        this.assignedClubName = assignedClubName;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public boolean isVerified() { return isVerified; }
    public void setVerified(boolean verified) { isVerified = verified; }

    public Long getAssignedClubId() { return assignedClubId; }
    public void setAssignedClubId(Long assignedClubId) { this.assignedClubId = assignedClubId; }

    public String getAssignedClubName() { return assignedClubName; }
    public void setAssignedClubName(String assignedClubName) { this.assignedClubName = assignedClubName; }
}
