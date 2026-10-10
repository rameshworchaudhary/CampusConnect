package com.campusconnect.service;

import com.campusconnect.dto.*;
import com.campusconnect.entity.*;
import com.campusconnect.repository.*;
import com.campusconnect.security.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AnnouncementService {

    private final AnnouncementRepository announcementRepository;
    private final UserAnnouncementReadRepository readRepository;
    private final ClubRepository clubRepository;
    private final UserRepository userRepository;
    private final ClubService clubService;
    private final AuditLogService auditLogService;

    public AnnouncementService(
            AnnouncementRepository announcementRepository,
            UserAnnouncementReadRepository readRepository,
            ClubRepository clubRepository,
            UserRepository userRepository,
            ClubService clubService,
            AuditLogService auditLogService) {
        this.announcementRepository = announcementRepository;
        this.readRepository = readRepository;
        this.clubRepository = clubRepository;
        this.userRepository = userRepository;
        this.clubService = clubService;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<AnnouncementResponse> getAnnouncements(Long currentUserId) {
        return announcementRepository.findByIsActiveTrueOrderByCreatedAtDesc().stream()
                .map(ann -> mapToResponse(ann, currentUserId))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AnnouncementResponse> getAnnouncementsByClub(Long clubId, Long currentUserId) {
        return announcementRepository.findByClubIdAndIsActiveTrueOrderByCreatedAtDesc(clubId).stream()
                .map(ann -> mapToResponse(ann, currentUserId))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AnnouncementResponse> getAllAnnouncements(Long currentUserId) {
        return announcementRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(ann -> mapToResponse(ann, currentUserId))
                .collect(Collectors.toList());
    }

    @Transactional
    public AnnouncementResponse createAnnouncement(AnnouncementRequest request, UserPrincipal creator, String ipAddress) {
        Club club = null;
        if (request.getClubId() != null) {
            clubService.verifyClubAdminOwnership(request.getClubId(), creator);
            club = clubRepository.findById(request.getClubId())
                    .orElseThrow(() -> new IllegalArgumentException("Club not found."));
        } else if (creator.getRole() != Role.SUPER_ADMIN) {
            throw new IllegalArgumentException("Only super admins can publish global announcements.");
        }

        String postedByName = request.getPostedByName();
        if (postedByName == null || postedByName.isBlank()) {
            postedByName = creator.getFullName();
        }

        Announcement announcement = new Announcement(
                club,
                request.getTitle().trim(),
                request.getContent().trim(),
                postedByName,
                true
        );

        announcement = announcementRepository.save(announcement);

        auditLogService.record("ANNOUNCEMENT_POSTED", creator.getUsername(), creator.getRole().name(),
                club != null ? club.getRefId() : "GLOBAL",
                String.format("Posted announcement: '%s'", announcement.getTitle()), ipAddress);

        return mapToResponse(announcement, creator.getId());
    }

    @Transactional
    public ApiResponse<Void> markAsRead(Long announcementId, UserPrincipal user) {
        Announcement announcement = announcementRepository.findById(announcementId)
                .orElseThrow(() -> new IllegalArgumentException("Announcement not found."));

        if (!readRepository.existsByUserIdAndAnnouncementId(user.getId(), announcementId)) {
            User u = userRepository.findById(user.getId()).orElseThrow();
            UserAnnouncementRead readRecord = new UserAnnouncementRead(u, announcement);
            readRepository.save(readRecord);
        }
        return ApiResponse.success("Announcement marked as read.");
    }

    @Transactional
    public AnnouncementResponse updateAnnouncement(Long id, AnnouncementRequest request, UserPrincipal actor, String ipAddress) {
            Announcement announcement = announcementRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Announcement not found."));
            if (announcement.getClub() != null) {
                clubService.verifyClubAdminOwnership(announcement.getClub().getId(), actor);
            } else if (actor.getRole() != Role.SUPER_ADMIN) {
                throw new org.springframework.security.access.AccessDeniedException("Only super admins can edit global announcements.");
            }
            if (request.getTitle() != null && !request.getTitle().isBlank()) announcement.setTitle(request.getTitle().trim());
            if (request.getContent() != null && !request.getContent().isBlank()) announcement.setContent(request.getContent().trim());
            if (request.getPostedByName() != null && !request.getPostedByName().isBlank()) announcement.setPostedByName(request.getPostedByName().trim());
            if (request.getClubId() != null && !request.getClubId().equals(announcement.getClub() == null ? null : announcement.getClub().getId())) {
                clubService.verifyClubAdminOwnership(request.getClubId(), actor);
                announcement.setClub(clubRepository.findById(request.getClubId()).orElseThrow(() -> new IllegalArgumentException("Club not found.")));
            }
            announcement = announcementRepository.save(announcement);
            auditLogService.record("ANNOUNCEMENT_UPDATED", actor.getUsername(), actor.getRole().name(),
                    announcement.getId().toString(), "Updated announcement", ipAddress);
            return mapToResponse(announcement, actor.getId());
    }

    @Transactional
    public AnnouncementResponse setActive(Long id, boolean active, UserPrincipal actor, String ipAddress) {
            Announcement announcement = announcementRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Announcement not found."));
            if (announcement.getClub() != null) clubService.verifyClubAdminOwnership(announcement.getClub().getId(), actor);
            else if (actor.getRole() != Role.SUPER_ADMIN) throw new org.springframework.security.access.AccessDeniedException("Only super admins can manage global announcements.");
            announcement.setActive(active);
            announcement = announcementRepository.save(announcement);
            auditLogService.record("ANNOUNCEMENT_STATUS_CHANGED", actor.getUsername(), actor.getRole().name(),
                    announcement.getId().toString(), "Announcement active status set to " + active, ipAddress);
            return mapToResponse(announcement, actor.getId());
    }

    @Transactional
    public void deleteAnnouncement(Long id, UserPrincipal actor, String ipAddress) {
            Announcement announcement = announcementRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Announcement not found."));
            if (announcement.getClub() != null) clubService.verifyClubAdminOwnership(announcement.getClub().getId(), actor);
            else if (actor.getRole() != Role.SUPER_ADMIN) throw new org.springframework.security.access.AccessDeniedException("Only super admins can delete global announcements.");
            readRepository.deleteByAnnouncementId(id);
            announcementRepository.delete(announcement);
            auditLogService.record("ANNOUNCEMENT_DELETED", actor.getUsername(), actor.getRole().name(),
                    id.toString(), "Deleted announcement", ipAddress);
    }

    private AnnouncementResponse mapToResponse(Announcement ann, Long currentUserId) {
        AnnouncementResponse res = new AnnouncementResponse();
        res.setId(ann.getId());
        if (ann.getClub() != null) {
            res.setClubId(ann.getClub().getId());
            res.setClubName(ann.getClub().getName());
        }
        res.setTitle(ann.getTitle());
        res.setContent(ann.getContent());
        res.setPostedByName(ann.getPostedByName());
        res.setActive(ann.isActive());
        res.setCreatedAt(ann.getCreatedAt());

        if (currentUserId != null) {
            boolean isRead = readRepository.existsByUserIdAndAnnouncementId(currentUserId, ann.getId());
            res.setRead(isRead);
        }
        return res;
    }
}
