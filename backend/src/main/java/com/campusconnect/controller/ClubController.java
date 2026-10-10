package com.campusconnect.controller;

import com.campusconnect.dto.*;
import com.campusconnect.security.UserPrincipal;
import com.campusconnect.service.ClubService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ClubController {

    private final ClubService clubService;

    public ClubController(ClubService clubService) {
        this.clubService = clubService;
    }

    // --- Public Endpoints ---
    @GetMapping("/clubs/public")
    public ResponseEntity<ApiResponse<List<ClubResponse>>> getPublishedClubs(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Long userId = currentUser != null ? currentUser.getId() : null;
        List<ClubResponse> clubs = clubService.getPublishedClubs(userId);
        return ResponseEntity.ok(ApiResponse.success("Published clubs retrieved", clubs));
    }

    @GetMapping("/clubs/public/{id}")
    public ResponseEntity<ApiResponse<ClubResponse>> getClubDetails(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Long userId = currentUser != null ? currentUser.getId() : null;
        ClubResponse club = clubService.getClubById(id, userId);
        return ResponseEntity.ok(ApiResponse.success("Club details retrieved", club));
    }

    // --- Super Admin Club Management ---
    @GetMapping("/admin/clubs")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<ClubResponse>>> getAllClubsForAdmin() {
        List<ClubResponse> clubs = clubService.getAllClubsForAdmin();
        return ResponseEntity.ok(ApiResponse.success("All clubs retrieved for admin", clubs));
    }

    @PostMapping("/admin/clubs")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<ClubResponse>> createClub(
            @Valid @RequestBody ClubRequest request,
            @AuthenticationPrincipal UserPrincipal admin,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        ClubResponse response = clubService.createClub(request, admin, ip);
        return ResponseEntity.ok(ApiResponse.success("Club created successfully", response));
    }

    @PutMapping("/admin/clubs/{id}/assign-admin")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<ClubResponse>> assignClubAdmin(
            @PathVariable("id") Long clubId,
            @RequestParam("userId") Long userId,
            @AuthenticationPrincipal UserPrincipal admin,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        ClubResponse response = clubService.assignClubAdmin(clubId, userId, admin, ip);
        return ResponseEntity.ok(ApiResponse.success("Club Admin assigned successfully", response));
    }

    @DeleteMapping("/admin/clubs/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteClub(
            @PathVariable Long id, @AuthenticationPrincipal UserPrincipal admin, HttpServletRequest httpRequest) {
        clubService.deleteClub(id, admin, httpRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("Club deleted successfully"));
    }

    // --- Club Admin Management ---
    @GetMapping("/club-admin/my-club")
    @PreAuthorize("hasAnyRole('CLUB_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<ClubResponse>> getMyClub(
            @AuthenticationPrincipal UserPrincipal admin) {
        ClubResponse response = clubService.getAssignedClubForAdmin(admin);
        return ResponseEntity.ok(ApiResponse.success("Assigned club retrieved", response));
    }

    @PutMapping({"/admin/clubs/{id}", "/club-admin/clubs/{id}"})
    @PreAuthorize("hasAnyRole('CLUB_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<ClubResponse>> updateClub(
            @PathVariable("id") Long id,
            @Valid @RequestBody ClubRequest request,
            @AuthenticationPrincipal UserPrincipal admin,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        ClubResponse response = clubService.updateClubByAdmin(id, request, admin, ip);
        return ResponseEntity.ok(ApiResponse.success("Club updated successfully", response));
    }

    @GetMapping("/club-admin/clubs/{clubId}/requests")
    @PreAuthorize("hasAnyRole('CLUB_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<MembershipResponse>>> getPendingRequests(
            @PathVariable("clubId") Long clubId,
            @AuthenticationPrincipal UserPrincipal admin) {
        List<MembershipResponse> requests = clubService.getPendingRequestsForClub(clubId, admin);
        return ResponseEntity.ok(ApiResponse.success("Pending membership requests retrieved", requests));
    }

    @PutMapping("/club-admin/memberships/{membershipId}/review")
    @PreAuthorize("hasAnyRole('CLUB_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<MembershipResponse>> reviewMembership(
            @PathVariable("membershipId") Long membershipId,
            @Valid @RequestBody ReviewMembershipRequest request,
            @AuthenticationPrincipal UserPrincipal admin,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        return ResponseEntity.ok(clubService.reviewMembershipRequest(membershipId, request, admin, ip));
    }

    // --- Student Actions ---
    @PostMapping("/student/clubs/{clubId}/join")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<MembershipResponse>> requestMembership(
            @PathVariable("clubId") Long clubId,
            @AuthenticationPrincipal UserPrincipal student,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        return ResponseEntity.ok(clubService.requestMembership(clubId, student, ip));
    }

    @DeleteMapping("/student/clubs/{clubId}/cancel-request")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Void>> cancelMembershipRequest(
            @PathVariable("clubId") Long clubId,
            @AuthenticationPrincipal UserPrincipal student) {
        return ResponseEntity.ok(clubService.cancelMembershipRequest(clubId, student));
    }

    @GetMapping("/student/memberships")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<List<MembershipResponse>>> getMyMemberships(
            @AuthenticationPrincipal UserPrincipal student) {
        List<MembershipResponse> list = clubService.getMyMemberships(student);
        return ResponseEntity.ok(ApiResponse.success("Student memberships retrieved", list));
    }
}
