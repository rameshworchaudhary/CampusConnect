package com.campusconnect.dto;

import com.campusconnect.entity.MembershipStatus;
import jakarta.validation.constraints.NotNull;

public class ReviewMembershipRequest {
    @NotNull(message = "Review status is required")
    private MembershipStatus status;

    public ReviewMembershipRequest() {}

    public ReviewMembershipRequest(MembershipStatus status) {
        this.status = status;
    }

    public MembershipStatus getStatus() { return status; }
    public void setStatus(MembershipStatus status) { this.status = status; }
}
