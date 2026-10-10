package com.campusconnect.dto;

import com.campusconnect.entity.Role;
import jakarta.validation.constraints.NotNull;

public class RoleUpdateRequest {
    @NotNull(message = "Role is required")
    private Role role;

    private Long assignedClubId;

    public RoleUpdateRequest() {}

    public RoleUpdateRequest(Role role, Long assignedClubId) {
        this.role = role;
        this.assignedClubId = assignedClubId;
    }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public Long getAssignedClubId() { return assignedClubId; }
    public void setAssignedClubId(Long assignedClubId) { this.assignedClubId = assignedClubId; }
}
