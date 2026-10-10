package com.campusconnect.controller;

import com.campusconnect.dto.*;
import com.campusconnect.security.UserPrincipal;
import com.campusconnect.service.EventService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class EventController {

    private final EventService eventService;

    public EventController(EventService eventService) {
        this.eventService = eventService;
    }

    // --- Public Events ---
    @GetMapping("/events/public")
    public ResponseEntity<ApiResponse<List<EventResponse>>> getPublishedEvents(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Long userId = currentUser != null ? currentUser.getId() : null;
        List<EventResponse> events = eventService.getPublishedEvents(userId);
        return ResponseEntity.ok(ApiResponse.success("Events retrieved", events));
    }

    // --- Admin & Club Admin Event Management ---
    @PostMapping("/admin/events")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<EventResponse>> createPlatformEvent(
            @Valid @RequestBody EventRequest request,
            @AuthenticationPrincipal UserPrincipal admin,
            HttpServletRequest httpRequest) {
        request.setPlatformEvent(true);
        String ip = httpRequest.getRemoteAddr();
        EventResponse response = eventService.createEvent(request, admin, ip);
        return ResponseEntity.ok(ApiResponse.success("Platform event created successfully", response));
    }

    @GetMapping("/admin/events")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<EventResponse>>> getAllEvents(
            @AuthenticationPrincipal UserPrincipal admin) {
        return ResponseEntity.ok(ApiResponse.success("Events retrieved", eventService.getAllEvents(admin.getId())));
    }

    @PostMapping("/club-admin/events")
    @PreAuthorize("hasAnyRole('CLUB_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<EventResponse>> createClubEvent(
            @Valid @RequestBody EventRequest request,
            @AuthenticationPrincipal UserPrincipal creator,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        EventResponse response = eventService.createEvent(request, creator, ip);
        return ResponseEntity.ok(ApiResponse.success("Club event created successfully", response));
    }

    @PutMapping({"/admin/events/{id}", "/club-admin/events/{id}"})
    @PreAuthorize("hasAnyRole('CLUB_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<EventResponse>> updateEvent(
            @PathVariable("id") Long id,
            @Valid @RequestBody EventRequest request,
            @AuthenticationPrincipal UserPrincipal updater,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        EventResponse response = eventService.updateEvent(id, request, updater, ip);
        return ResponseEntity.ok(ApiResponse.success("Event updated successfully", response));
    }

    @DeleteMapping({"/admin/events/{id}", "/club-admin/events/{id}"})
    @PreAuthorize("hasAnyRole('CLUB_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteEvent(
            @PathVariable Long id, @AuthenticationPrincipal UserPrincipal actor, HttpServletRequest httpRequest) {
        eventService.deleteEvent(id, actor, httpRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("Event deleted successfully"));
    }

    // --- Student Registration ---
    @PostMapping("/student/events/{id}/register")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<EventResponse>> registerForEvent(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal student,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        return ResponseEntity.ok(eventService.registerForEvent(id, student, ip));
    }

    @DeleteMapping("/student/events/{id}/cancel")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Void>> cancelRegistration(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal student,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        return ResponseEntity.ok(eventService.cancelRegistration(id, student, ip));
    }

    @GetMapping("/student/my-events")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<List<EventResponse>>> getMyRegisteredEvents(
            @AuthenticationPrincipal UserPrincipal student) {
        List<EventResponse> events = eventService.getMyRegisteredEvents(student);
        return ResponseEntity.ok(ApiResponse.success("Registered events retrieved", events));
    }
}
