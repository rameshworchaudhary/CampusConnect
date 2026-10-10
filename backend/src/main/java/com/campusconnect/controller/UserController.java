package com.campusconnect.controller;

import com.campusconnect.dto.*;
import com.campusconnect.entity.Role;
import com.campusconnect.security.UserPrincipal;
import com.campusconnect.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<UserResponse>>> getAllUsers(
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "role", required = false) Role role,
            @RequestParam(value = "active", required = false) Boolean active) {
        List<UserResponse> users = userService.getAllUsers(search, role, active);
        return ResponseEntity.ok(ApiResponse.success("Users retrieved", users));
    }

    @PutMapping("/{id}/role")
    public ResponseEntity<ApiResponse<UserResponse>> updateUserRole(
            @PathVariable("id") Long id,
            @Valid @RequestBody RoleUpdateRequest request,
            @AuthenticationPrincipal UserPrincipal actor,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        UserResponse response = userService.updateUserRole(id, request, actor, ip);
        return ResponseEntity.ok(ApiResponse.success("Role updated successfully", response));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<UserResponse>> updateUserStatus(
            @PathVariable("id") Long id,
            @RequestBody StatusUpdateRequest request,
            @AuthenticationPrincipal UserPrincipal actor,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        UserResponse response = userService.updateUserStatus(id, request.isActive(), actor, ip);
        return ResponseEntity.ok(ApiResponse.success("User status updated", response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<UserResponse>> updateUser(
            @PathVariable("id") Long id,
            @Valid @RequestBody AdminUserUpdateRequest request,
            @AuthenticationPrincipal UserPrincipal actor,
            HttpServletRequest httpRequest) {
        UserResponse response = userService.updateUser(id, request, actor, httpRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("User updated successfully", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteUser(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserPrincipal actor,
            HttpServletRequest httpRequest) {
        userService.deleteUser(id, actor, httpRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success("User deleted successfully"));
    }
}
