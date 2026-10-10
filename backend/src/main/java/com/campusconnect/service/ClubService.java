package com.campusconnect.service;

import com.campusconnect.dto.*;
import com.campusconnect.entity.*;
import com.campusconnect.repository.ClubMembershipRepository;
import com.campusconnect.repository.ClubRepository;
import com.campusconnect.repository.EventRepository;
import com.campusconnect.repository.EventRegistrationRepository;
import com.campusconnect.repository.AnnouncementRepository;
import com.campusconnect.repository.UserAnnouncementReadRepository;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.security.UserPrincipal;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ClubService {

    private final ClubRepository clubRepository;
    private final ClubMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final EventRepository eventRepository;
    private final EventRegistrationRepository registrationRepository;
    private final AnnouncementRepository announcementRepository;
    private final UserAnnouncementReadRepository readRepository;

    @Autowired
    public ClubService(ClubRepository clubRepository, ClubMembershipRepository membershipRepository, UserRepository userRepository, AuditLogService auditLogService,
                       EventRepository eventRepository, EventRegistrationRepository registrationRepository,
                       AnnouncementRepository announcementRepository, UserAnnouncementReadRepository readRepository) {
        this.clubRepository = clubRepository;
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.announcementRepository = announcementRepository;
        this.readRepository = readRepository;
    }

    public ClubService(ClubRepository clubRepository, ClubMembershipRepository membershipRepository, UserRepository userRepository, AuditLogService auditLogService) {
        this(clubRepository, membershipRepository, userRepository, auditLogService, null, null, null, null);
    }

    // --- Public / General ---
    @Transactional(readOnly = true)
    public List<ClubResponse> getPublishedClubs(Long currentUserId) {
        return clubRepository.findByIsPublishedTrue().stream()
                .map(club -> mapToClubResponse(club, currentUserId))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ClubResponse> getAllClubsForAdmin() {
        return clubRepository.findAll().stream()
                .map(club -> mapToClubResponse(club, null))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ClubResponse getClubById(Long id, Long currentUserId) {
        Club club = clubRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Club not found with id: " + id));
        return mapToClubResponse(club, currentUserId);
    }

    // --- Club Admin Specific ---
    @Transactional(readOnly = true)
    public ClubResponse getAssignedClubForAdmin(UserPrincipal admin) {
        Club club = clubRepository.findByAssignedAdminId(admin.getId())
                .orElseThrow(() -> new IllegalArgumentException("No club currently assigned to your account."));
        return mapToClubResponse(club, admin.getId());
    }

    public void verifyClubAdminOwnership(Long clubId, UserPrincipal user) {
        if (user.getRole() == Role.SUPER_ADMIN) {
            return; // Super Admin has access
        }
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new IllegalArgumentException("Club not found with id: " + clubId));
        if (club.getAssignedAdmin() == null || !club.getAssignedAdmin().getId().equals(user.getId())) {
            throw new AccessDeniedException("Access Denied: You are not authorized to manage this club.");
        }
    }

    @Transactional
    public ClubResponse updateClubByAdmin(Long clubId, ClubRequest request, UserPrincipal admin, String ipAddress) {
        verifyClubAdminOwnership(clubId, admin);

        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new IllegalArgumentException("Club not found."));

        if (request.getName() != null && !request.getName().isBlank()) club.setName(request.getName().trim());
        if (request.getDescription() != null) club.setDescription(request.getDescription().trim());
        if (request.getMeetingSchedule() != null) club.setMeetingSchedule(request.getMeetingSchedule().trim());
        if (request.getMeetingLocation() != null) club.setMeetingLocation(request.getMeetingLocation().trim());
        if (request.getFacultyAdvisor() != null) club.setFacultyAdvisor(request.getFacultyAdvisor().trim());
        if (request.getCategory() != null) club.setCategory(request.getCategory().trim());

        // Only super admin can toggle publish or reassign admin directly via this endpoint
        if (admin.getRole() == Role.SUPER_ADMIN) {
            club.setPublished(request.isPublished());
            if (request.getAssignedAdminId() != null) {
                User newAdmin = userRepository.findById(request.getAssignedAdminId())
                        .orElseThrow(() -> new IllegalArgumentException("Assigned admin user not found."));
                club.setAssignedAdmin(newAdmin);
            }
        }

        club = clubRepository.save(club);

        auditLogService.record("CLUB_UPDATED", admin.getUsername(), admin.getRole().name(),
                club.getRefId(), "Updated club details for " + club.getName(), ipAddress);

        return mapToClubResponse(club, admin.getId());
    }

    // --- Super Admin Management ---
    @Transactional
    public ClubResponse createClub(ClubRequest request, UserPrincipal admin, String ipAddress) {
        User assignedAdmin = null;
        if (request.getAssignedAdminId() != null) {
            assignedAdmin = userRepository.findById(request.getAssignedAdminId())
                    .orElse(null);
        }

        String refId = request.getRefId();
        if (refId == null || refId.isBlank()) {
            refId = "ORG-" + String.format("%04d", (int)(Math.random() * 9000 + 100));
        }

        Club club = new Club(
                refId,
                request.getName().trim(),
                request.getCategory().trim(),
                request.getDescription(),
                request.getMeetingSchedule(),
                request.getMeetingLocation(),
                request.getFacultyAdvisor(),
                request.isPublished(),
                assignedAdmin
        );

        club = clubRepository.save(club);

        auditLogService.record("CLUB_CREATED", admin.getUsername(), admin.getRole().name(),
                club.getRefId(), "Created new club: " + club.getName(), ipAddress);

        return mapToClubResponse(club, null);
    }

    @Transactional
    public ClubResponse assignClubAdmin(Long clubId, Long userId, UserPrincipal actor, String ipAddress) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new IllegalArgumentException("Club not found."));

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Target user not found."));

        targetUser.setRole(Role.CLUB_ADMIN);
        userRepository.save(targetUser);

        club.setAssignedAdmin(targetUser);
        club = clubRepository.save(club);

        auditLogService.record("CLUB_ADMIN_ASSIGNED", actor.getUsername(), actor.getRole().name(),
                club.getRefId(), String.format("Assigned %s as Club Admin for %s", targetUser.getFullName(), club.getName()), ipAddress);

        return mapToClubResponse(club, null);
    }

    @Transactional
    public void deleteClub(Long clubId, UserPrincipal admin, String ipAddress) {
        if (admin.getRole() != Role.SUPER_ADMIN) {
            throw new org.springframework.security.access.AccessDeniedException("Only super admins can delete clubs.");
        }
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new IllegalArgumentException("Club not found."));
        if (announcementRepository != null) announcementRepository.findByClubId(clubId).forEach(announcement -> {
            readRepository.deleteByAnnouncementId(announcement.getId());
            announcementRepository.delete(announcement);
        });
        if (eventRepository != null) eventRepository.findByClubId(clubId).forEach(event -> {
            registrationRepository.deleteByEventId(event.getId());
            eventRepository.delete(event);
        });
        membershipRepository.deleteByClubId(clubId);
        clubRepository.delete(club);
        auditLogService.record("CLUB_DELETED", admin.getUsername(), admin.getRole().name(),
                club.getRefId(), "Deleted club: " + club.getName(), ipAddress);
    }

    // --- Student Memberships ---
    @Transactional
    public ApiResponse<MembershipResponse> requestMembership(Long clubId, UserPrincipal student, String ipAddress) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new IllegalArgumentException("Club not found."));

        User user = userRepository.findById(student.getId())
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        Optional<ClubMembership> existing = membershipRepository.findByClubIdAndUserId(clubId, student.getId());
        if (existing.isPresent()) {
            ClubMembership m = existing.get();
            if (m.getStatus() == MembershipStatus.APPROVED) {
                throw new IllegalStateException("You are already an active member of this club.");
            }
            if (m.getStatus() == MembershipStatus.PENDING) {
                throw new IllegalStateException("You already have a pending membership request for this club.");
            }
            // If previously rejected, re-apply as PENDING
            m.setStatus(MembershipStatus.PENDING);
            m.setAppliedAt(LocalDateTime.now());
            m.setReviewedAt(null);
            m.setReviewedBy(null);
            membershipRepository.save(m);
            return ApiResponse.success("Membership request resubmitted.", mapToMembershipResponse(m));
        }

        ClubMembership membership = new ClubMembership(club, user, MembershipStatus.PENDING);
        membership = membershipRepository.save(membership);

        auditLogService.record("MEMBERSHIP_REQUESTED", user.getEmail(), user.getRole().name(),
                club.getRefId(), user.getFullName() + " submitted membership request for " + club.getName(), ipAddress);

        return ApiResponse.success("Membership request submitted successfully.", mapToMembershipResponse(membership));
    }

    @Transactional
    public ApiResponse<Void> cancelMembershipRequest(Long clubId, UserPrincipal student) {
        ClubMembership membership = membershipRepository.findByClubIdAndUserId(clubId, student.getId())
                .orElseThrow(() -> new IllegalArgumentException("No membership request found for this club."));

        if (membership.getStatus() != MembershipStatus.PENDING) {
            throw new IllegalStateException("Can only cancel requests that are currently pending review.");
        }

        membershipRepository.delete(membership);
        return ApiResponse.success("Membership request cancelled successfully.");
    }

    @Transactional(readOnly = true)
    public List<MembershipResponse> getPendingRequestsForClub(Long clubId, UserPrincipal user) {
        verifyClubAdminOwnership(clubId, user);
        return membershipRepository.findByClubIdAndStatus(clubId, MembershipStatus.PENDING).stream()
                .map(this::mapToMembershipResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ApiResponse<MembershipResponse> reviewMembershipRequest(Long membershipId, ReviewMembershipRequest request, UserPrincipal reviewer, String ipAddress) {
        ClubMembership membership = membershipRepository.findById(membershipId)
                .orElseThrow(() -> new IllegalArgumentException("Membership request not found."));

        verifyClubAdminOwnership(membership.getClub().getId(), reviewer);

        membership.setStatus(request.getStatus());
        membership.setReviewedAt(LocalDateTime.now());
        membership.setReviewedBy(userRepository.findById(reviewer.getId()).orElse(null));
        membership = membershipRepository.save(membership);

        String action = request.getStatus() == MembershipStatus.APPROVED ? "MEMBERSHIP_APPROVED" : "MEMBERSHIP_REJECTED";
        auditLogService.record(action, reviewer.getUsername(), reviewer.getRole().name(),
                membership.getUser().getStudentId(),
                String.format("%s membership request of %s for %s",
                        request.getStatus(), membership.getUser().getFullName(), membership.getClub().getName()), ipAddress);

        return ApiResponse.success("Membership request " + request.getStatus().name().toLowerCase() + " successfully.", mapToMembershipResponse(membership));
    }

    @Transactional(readOnly = true)
    public List<MembershipResponse> getMyMemberships(UserPrincipal student) {
        return membershipRepository.findByUserId(student.getId()).stream()
                .map(this::mapToMembershipResponse)
                .collect(Collectors.toList());
    }

    public ClubResponse mapToClubResponse(Club club, Long currentUserId) {
        long memberCount = membershipRepository.countByClubIdAndStatus(club.getId(), MembershipStatus.APPROVED);
        long pendingCount = membershipRepository.countByClubIdAndStatus(club.getId(), MembershipStatus.PENDING);

        String userStatus = "NONE";
        if (currentUserId != null) {
            Optional<ClubMembership> m = membershipRepository.findByClubIdAndUserId(club.getId(), currentUserId);
            if (m.isPresent()) {
                userStatus = m.get().getStatus().name();
            }
        }

        ClubResponse res = new ClubResponse();
        res.setId(club.getId());
        res.setRefId(club.getRefId());
        res.setName(club.getName());
        res.setCategory(club.getCategory());
        res.setDescription(club.getDescription());
        res.setMeetingSchedule(club.getMeetingSchedule());
        res.setMeetingLocation(club.getMeetingLocation());
        res.setFacultyAdvisor(club.getFacultyAdvisor());
        res.setPublished(club.isPublished());
        if (club.getAssignedAdmin() != null) {
            res.setAssignedAdminId(club.getAssignedAdmin().getId());
            res.setAssignedAdminName(club.getAssignedAdmin().getFullName());
        }
        res.setMemberCount(memberCount);
        res.setPendingRequestCount(pendingCount);
        res.setUserMembershipStatus(userStatus);
        return res;
    }

    public MembershipResponse mapToMembershipResponse(ClubMembership m) {
        MembershipResponse res = new MembershipResponse();
        res.setId(m.getId());
        res.setClubId(m.getClub().getId());
        res.setClubName(m.getClub().getName());
        res.setUserId(m.getUser().getId());
        res.setUserName(m.getUser().getFullName());
        res.setUserEmail(m.getUser().getEmail());
        res.setStudentId(m.getUser().getStudentId());
        res.setDepartment(m.getUser().getDepartment());
        res.setStatus(m.getStatus());
        res.setAppliedAt(m.getAppliedAt());
        res.setReviewedAt(m.getReviewedAt());
        return res;
    }
}
