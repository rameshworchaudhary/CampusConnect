package com.campusconnect.service;

import com.campusconnect.dto.*;
import com.campusconnect.entity.*;
import com.campusconnect.repository.ClubRepository;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.repository.ClubMembershipRepository;
import com.campusconnect.repository.EventRegistrationRepository;
import com.campusconnect.repository.UserAnnouncementReadRepository;
import com.campusconnect.repository.VerificationTokenRepository;
import com.campusconnect.security.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final ClubRepository clubRepository;
    private final AuditLogService auditLogService;
    private final AuthService authService;
    private final ClubMembershipRepository membershipRepository;
    private final EventRegistrationRepository registrationRepository;
    private final UserAnnouncementReadRepository readRepository;
    private final VerificationTokenRepository tokenRepository;

    @Autowired
    public UserService(UserRepository userRepository, ClubRepository clubRepository, AuditLogService auditLogService, AuthService authService,
                       ClubMembershipRepository membershipRepository, EventRegistrationRepository registrationRepository,
                       UserAnnouncementReadRepository readRepository, VerificationTokenRepository tokenRepository) {
        this.userRepository = userRepository;
        this.clubRepository = clubRepository;
        this.auditLogService = auditLogService;
        this.authService = authService;
        this.membershipRepository = membershipRepository;
        this.registrationRepository = registrationRepository;
        this.readRepository = readRepository;
        this.tokenRepository = tokenRepository;
    }

    public UserService(UserRepository userRepository, ClubRepository clubRepository, AuditLogService auditLogService, AuthService authService) {
        this(userRepository, clubRepository, auditLogService, authService, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers(String search, Role roleFilter, Boolean activeFilter) {
        return userRepository.findAll().stream()
                .filter(u -> {
                    if (search != null && !search.isBlank()) {
                        String s = search.toLowerCase();
                        boolean matchesName = u.getFullName() != null && u.getFullName().toLowerCase().contains(s);
                        boolean matchesEmail = u.getEmail() != null && u.getEmail().toLowerCase().contains(s);
                        boolean matchesId = u.getStudentId() != null && u.getStudentId().toLowerCase().contains(s);
                        boolean matchesDept = u.getDepartment() != null && u.getDepartment().toLowerCase().contains(s);
                        if (!matchesName && !matchesEmail && !matchesId && !matchesDept) return false;
                    }
                    if (roleFilter != null && u.getRole() != roleFilter) return false;
                    if (activeFilter != null && u.isActive() != activeFilter) return false;
                    return true;
                })
                .map(authService::mapToUserResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + id));
        return authService.mapToUserResponse(user);
    }

    @Transactional
    public UserResponse updateUserRole(Long targetUserId, RoleUpdateRequest request, UserPrincipal actor, String ipAddress) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Target user not found."));

        Role oldRole = target.getRole();
        Role newRole = request.getRole();

        // Security check: Protect against demoting or removing the last active SUPER_ADMIN
        if (oldRole == Role.SUPER_ADMIN && newRole != Role.SUPER_ADMIN) {
            long activeSuperAdmins = userRepository.countByRoleAndIsActiveTrue(Role.SUPER_ADMIN);
            if (activeSuperAdmins <= 1) {
                throw new IllegalStateException("Security Violation: Cannot demote the last active SUPER_ADMIN.");
            }
        }

        target.setRole(newRole);
        userRepository.save(target);

        // If assigning CLUB_ADMIN and a clubId is provided
        if (newRole == Role.CLUB_ADMIN && request.getAssignedClubId() != null) {
            Club club = clubRepository.findById(request.getAssignedClubId())
                    .orElseThrow(() -> new IllegalArgumentException("Club not found with id: " + request.getAssignedClubId()));
            club.setAssignedAdmin(target);
            clubRepository.save(club);
            
            auditLogService.record("ROLE_MODIFIED", actor.getUsername(), actor.getRole().name(),
                    target.getStudentId(), String.format("Elevated %s (%s) from %s to %s for %s",
                            target.getFullName(), target.getStudentId(), oldRole, newRole, club.getName()), ipAddress);
        } else {
            // If demoted from CLUB_ADMIN to STUDENT, clear any previous club assignments
            if (oldRole == Role.CLUB_ADMIN && newRole != Role.CLUB_ADMIN) {
                clubRepository.findByAssignedAdminId(target.getId()).ifPresent(c -> {
                    c.setAssignedAdmin(null);
                    clubRepository.save(c);
                });
            }

            auditLogService.record("ROLE_MODIFIED", actor.getUsername(), actor.getRole().name(),
                    target.getStudentId(), String.format("Changed role of %s (%s) from %s to %s",
                            target.getFullName(), target.getStudentId(), oldRole, newRole), ipAddress);
        }

        return authService.mapToUserResponse(target);
    }

    @Transactional
    public UserResponse updateUserStatus(Long targetUserId, boolean active, UserPrincipal actor, String ipAddress) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        // Protect last active super admin from deactivation
        if (!active && target.getRole() == Role.SUPER_ADMIN) {
            long activeSuperAdmins = userRepository.countByRoleAndIsActiveTrue(Role.SUPER_ADMIN);
            if (activeSuperAdmins <= 1) {
                throw new IllegalStateException("Security Violation: Cannot deactivate the last active SUPER_ADMIN.");
            }
        }

        target.setActive(active);
        userRepository.save(target);

        auditLogService.record("STATUS_MODIFIED", actor.getUsername(), actor.getRole().name(),
                target.getStudentId(), String.format("Account status of %s (%s) set to %s",
                        target.getFullName(), target.getStudentId(), active ? "ACTIVE" : "DEACTIVATED"), ipAddress);

        return authService.mapToUserResponse(target);
    }

    @Transactional
    public UserResponse updateUser(Long targetUserId, AdminUserUpdateRequest request, UserPrincipal actor, String ipAddress) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));
        userRepository.findByEmail(request.getEmail().trim().toLowerCase())
                .filter(existing -> !existing.getId().equals(targetUserId))
                .ifPresent(existing -> { throw new IllegalArgumentException("Email is already registered."); });

        target.setFullName(request.getFullName().trim());
        target.setEmail(request.getEmail().trim().toLowerCase());
        target.setStudentId(request.getStudentId() == null ? null : request.getStudentId().trim());
        target.setDepartment(request.getDepartment() == null ? null : request.getDepartment().trim());
        target = userRepository.save(target);
        auditLogService.record("USER_UPDATED", actor.getUsername(), actor.getRole().name(),
                target.getStudentId(), "Updated user profile", ipAddress);
        return authService.mapToUserResponse(target);
    }

    @Transactional
    public void deleteUser(Long targetUserId, UserPrincipal actor, String ipAddress) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));
        if (target.getRole() == Role.SUPER_ADMIN) {
            throw new IllegalStateException("SUPER_ADMIN accounts cannot be deleted.");
        }
        clubRepository.findByAssignedAdminId(targetUserId).ifPresent(club -> {
            club.setAssignedAdmin(null);
            clubRepository.save(club);
        });
        if (membershipRepository != null) membershipRepository.deleteByUserId(targetUserId);
        if (membershipRepository != null) membershipRepository.findByReviewedById(targetUserId).forEach(membership -> {
            membership.setReviewedBy(null);
            membershipRepository.save(membership);
        });
        if (registrationRepository != null) registrationRepository.deleteByUserId(targetUserId);
        if (readRepository != null) readRepository.deleteByUserId(targetUserId);
        if (tokenRepository != null) tokenRepository.deleteByUserId(targetUserId);
        userRepository.delete(target);
        auditLogService.record("USER_DELETED", actor.getUsername(), actor.getRole().name(),
                target.getStudentId(), "Deleted user account", ipAddress);
    }
}
