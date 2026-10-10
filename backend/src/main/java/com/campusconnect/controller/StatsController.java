package com.campusconnect.controller;

import com.campusconnect.dto.ApiResponse;
import com.campusconnect.dto.PlatformStatsResponse;
import com.campusconnect.security.UserPrincipal;
import com.campusconnect.service.StatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    @GetMapping("/stats/platform")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<PlatformStatsResponse>> getPlatformStats() {
        PlatformStatsResponse stats = statsService.getPlatformStats();
        return ResponseEntity.ok(ApiResponse.success("Platform statistics retrieved", stats));
    }

    @GetMapping("/club-admin/stats")
    @PreAuthorize("hasAnyRole('CLUB_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getClubAdminStats(
            @AuthenticationPrincipal UserPrincipal admin) {
        Map<String, Object> stats = statsService.getClubAdminStats(admin);
        return ResponseEntity.ok(ApiResponse.success("Club metrics retrieved", stats));
    }

    @GetMapping("/student/stats")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStudentStats(
            @AuthenticationPrincipal UserPrincipal student) {
        Map<String, Object> stats = statsService.getStudentStats(student);
        return ResponseEntity.ok(ApiResponse.success("Student metrics retrieved", stats));
    }
}
