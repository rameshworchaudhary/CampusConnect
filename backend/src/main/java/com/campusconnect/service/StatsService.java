package com.campusconnect.service;

import com.campusconnect.dto.PlatformStatsResponse;
import com.campusconnect.entity.*;
import com.campusconnect.repository.*;
import com.campusconnect.security.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
public class StatsService {

    private final UserRepository userRepository;
    private final ClubRepository clubRepository;
    private final EventRepository eventRepository;
    private final EventRegistrationRepository registrationRepository;
    private final ClubMembershipRepository membershipRepository;
    private final AnnouncementRepository announcementRepository;
    private final UserAnnouncementReadRepository readRepository;

    public StatsService(
            UserRepository userRepository,
            ClubRepository clubRepository,
            EventRepository eventRepository,
            EventRegistrationRepository registrationRepository,
            ClubMembershipRepository membershipRepository,
            AnnouncementRepository announcementRepository,
            UserAnnouncementReadRepository readRepository) {
        this.userRepository = userRepository;
        this.clubRepository = clubRepository;
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.membershipRepository = membershipRepository;
        this.announcementRepository = announcementRepository;
        this.readRepository = readRepository;
    }

    @Transactional(readOnly = true)
    public PlatformStatsResponse getPlatformStats() {
        PlatformStatsResponse res = new PlatformStatsResponse();
        res.setTotalUsers(userRepository.count());
        res.setTotalStudents(userRepository.countByRole(Role.STUDENT));
        res.setTotalClubs(clubRepository.count());
        res.setPublishedEvents(eventRepository.countByIsPublishedTrue());
        res.setTotalRegistrations(registrationRepository.countByStatus(RegistrationStatus.REGISTERED));
        res.setPendingRequests(membershipRepository.countByStatus(MembershipStatus.PENDING));
        return res;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getClubAdminStats(UserPrincipal admin) {
        Map<String, Object> stats = new HashMap<>();
        Club club = clubRepository.findByAssignedAdminId(admin.getId()).orElse(null);

        if (club == null) {
            stats.put("totalMembers", 0);
            stats.put("pendingRequests", 0);
            stats.put("upcomingEvents", 0);
            stats.put("activeRegistrations", 0);
            return stats;
        }

        long totalMembers = membershipRepository.countByClubIdAndStatus(club.getId(), MembershipStatus.APPROVED);
        long pendingRequests = membershipRepository.countByClubIdAndStatus(club.getId(), MembershipStatus.PENDING);
        long upcomingEvents = eventRepository.findByClubIdAndIsPublishedTrue(club.getId()).size();

        long activeRegistrations = eventRepository.findByClubId(club.getId()).stream()
                .mapToLong(Event::getRegisteredCount)
                .sum();

        stats.put("clubId", club.getId());
        stats.put("clubName", club.getName());
        stats.put("refId", club.getRefId());
        stats.put("facultyAdvisor", club.getFacultyAdvisor());
        stats.put("totalMembers", totalMembers);
        stats.put("pendingRequests", pendingRequests);
        stats.put("upcomingEvents", upcomingEvents);
        stats.put("activeRegistrations", activeRegistrations);
        return stats;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStudentStats(UserPrincipal student) {
        Map<String, Object> stats = new HashMap<>();

        long joinedClubs = membershipRepository.countByUserIdAndStatus(student.getId(), MembershipStatus.APPROVED);
        long pendingRequests = membershipRepository.countByUserIdAndStatus(student.getId(), MembershipStatus.PENDING);
        long upcomingEvents = registrationRepository.countByUserIdAndStatus(student.getId(), RegistrationStatus.REGISTERED);

        long totalAnnouncements = announcementRepository.count();
        long readAnnouncements = readRepository.findByUserId(student.getId()).size();
        long unreadAnnouncements = Math.max(0, totalAnnouncements - readAnnouncements);

        stats.put("joinedClubs", joinedClubs);
        stats.put("pendingRequests", pendingRequests);
        stats.put("upcomingEvents", upcomingEvents);
        stats.put("unreadAnnouncements", unreadAnnouncements);
        return stats;
    }
}
