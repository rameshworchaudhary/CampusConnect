package com.campusconnect.controller;

import com.campusconnect.dto.*;
import com.campusconnect.security.UserPrincipal;
import com.campusconnect.service.AnnouncementService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class AnnouncementController {

    private final AnnouncementService announcementService;

    public AnnouncementController(AnnouncementService announcementService) {
        this.announcementService = announcementService;
    }

    @GetMapping("/announcements/public")
    public ResponseEntity<ApiResponse<List<AnnouncementResponse>>> getAnnouncements(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Long userId = currentUser != null ? currentUser.getId() : null;
        List<AnnouncementResponse> list = announcementService.getAnnouncements(userId);
        return ResponseEntity.ok(ApiResponse.success("Announcements retrieved", list));
    }

    @PostMapping("/admin/announcements")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AnnouncementResponse>> createGlobalAnnouncement(
            @Valid @RequestBody AnnouncementRequest request,
            @AuthenticationPrincipal UserPrincipal admin,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        AnnouncementResponse response = announcementService.createAnnouncement(request, admin, ip);
        return ResponseEntity.ok(ApiResponse.success("Announcement published successfully", response));
    }

    @GetMapping("/admin/announcements")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<AnnouncementResponse>>> getAllAnnouncements(
            @AuthenticationPrincipal UserPrincipal admin) {
        return ResponseEntity.ok(ApiResponse.success("Announcements retrieved", announcementService.getAllAnnouncements(admin.getId())));
    }

    @PutMapping({"/admin/announcements/{id}", "/club-admin/announcements/{id}"})
    @PreAuthorize("hasAnyRole('CLUB_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AnnouncementResponse>> updateAnnouncement(
            @PathVariable Long id, @Valid @RequestBody AnnouncementRequest request,
            @AuthenticationPrincipal UserPrincipal actor, HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.success("Announcement updated successfully",
                announcementService.updateAnnouncement(id, request, actor, httpRequest.getRemoteAddr())));
    }

    @PatchMapping({"/admin/announcements/{id}/status", "/club-admin/announcements/{id}/status"})
    @PreAuthorize("hasAnyRole('CLUB_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AnnouncementResponse>> setAnnouncementStatus(
            @PathVariable Long id, @RequestBody StatusUpdateRequest request,
            @AuthenticationPrincipal UserPrincipal actor, HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.success("Announcement status updated",
                announcementService.setActive(id, request.isActive(), actor, httpRequest.getRemoteAddr())));
    }

    @DeleteMapping({"/admin/announcements/{id}", "/club-admin/announcements/{id}"})
    @PreAuthorize("hasAnyRole('CLUB_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteAnnouncement(
            @PathVariable Long id, @AuthenticationPrincipal UserPrincipal actor, HttpServletRequest httpRequest) {
        announcementService.deleteAnnouncement(id, actor, httpRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("Announcement deleted successfully"));
    }

    @PostMapping("/club-admin/announcements")
    @PreAuthorize("hasAnyRole('CLUB_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AnnouncementResponse>> createClubAnnouncement(
            @Valid @RequestBody AnnouncementRequest request,
            @AuthenticationPrincipal UserPrincipal creator,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        AnnouncementResponse response = announcementService.createAnnouncement(request, creator, ip);
        return ResponseEntity.ok(ApiResponse.success("Club announcement published successfully", response));
    }

    @PostMapping("/student/announcements/{id}/read")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Void>> markAsRead(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(announcementService.markAsRead(id, user));
    }
}
