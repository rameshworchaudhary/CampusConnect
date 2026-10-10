package com.campusconnect.service;

import com.campusconnect.dto.*;
import com.campusconnect.entity.*;
import com.campusconnect.repository.ClubRepository;
import com.campusconnect.repository.EventRegistrationRepository;
import com.campusconnect.repository.EventRepository;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.security.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class EventService {

    private final EventRepository eventRepository;
    private final EventRegistrationRepository registrationRepository;
    private final ClubRepository clubRepository;
    private final UserRepository userRepository;
    private final ClubService clubService;
    private final AuditLogService auditLogService;

    public EventService(EventRepository eventRepository, EventRegistrationRepository registrationRepository, ClubRepository clubRepository, UserRepository userRepository, ClubService clubService, AuditLogService auditLogService) {
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.clubRepository = clubRepository;
        this.userRepository = userRepository;
        this.clubService = clubService;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<EventResponse> getPublishedEvents(Long currentUserId) {
        return eventRepository.findByIsPublishedTrue().stream()
                .map(event -> mapToEventResponse(event, currentUserId))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<EventResponse> getEventsByClub(Long clubId, Long currentUserId) {
        return eventRepository.findByClubId(clubId).stream()
                .map(event -> mapToEventResponse(event, currentUserId))
                .collect(Collectors.toList());
    }

    @Transactional
    public EventResponse createEvent(EventRequest request, UserPrincipal creator, String ipAddress) {
        Club club = null;
        if (request.getClubId() != null) {
            clubService.verifyClubAdminOwnership(request.getClubId(), creator);
            club = clubRepository.findById(request.getClubId())
                    .orElseThrow(() -> new IllegalArgumentException("Club not found."));
        } else if (creator.getRole() != Role.SUPER_ADMIN) {
            throw new IllegalArgumentException("Club ID is required to create a club event.");
        }

        Event event = new Event(
                club,
                request.getTitle().trim(),
                request.getDescription(),
                request.getEventDate(),
                request.getLocation(),
                request.getCapacity() > 0 ? request.getCapacity() : 100,
                0,
                request.isPublished(),
                request.isPlatformEvent() || club == null,
                request.getBadgeLabel() != null ? request.getBadgeLabel() : "Open RSVP"
        );
        event.setEventLink(normalizeEventLink(request.getEventLink()));

        event = eventRepository.save(event);

        auditLogService.record("EVENT_CREATED", creator.getUsername(), creator.getRole().name(),
                "EVT-" + event.getId(), "Created event: " + event.getTitle(), ipAddress);

        return mapToEventResponse(event, creator.getId());
    }

    @Transactional
    public EventResponse updateEvent(Long eventId, EventRequest request, UserPrincipal updater, String ipAddress) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Event not found with id: " + eventId));

        if (event.getClub() != null) {
            clubService.verifyClubAdminOwnership(event.getClub().getId(), updater);
        } else if (updater.getRole() != Role.SUPER_ADMIN) {
            throw new IllegalArgumentException("Only super admins can edit platform events.");
        }

        if (request.getTitle() != null) event.setTitle(request.getTitle().trim());
        if (request.getDescription() != null) event.setDescription(request.getDescription());
        if (request.getEventDate() != null) event.setEventDate(request.getEventDate());
        if (request.getLocation() != null) event.setLocation(request.getLocation());
        if (request.getEventLink() != null) event.setEventLink(normalizeEventLink(request.getEventLink()));
        if (request.getCapacity() > 0) event.setCapacity(request.getCapacity());
        event.setPublished(request.isPublished());
        if (request.getBadgeLabel() != null) event.setBadgeLabel(request.getBadgeLabel());

        event = eventRepository.save(event);

        auditLogService.record("EVENT_UPDATED", updater.getUsername(), updater.getRole().name(),
                "EVT-" + event.getId(), "Updated event: " + event.getTitle(), ipAddress);

        return mapToEventResponse(event, updater.getId());
    }

    @Transactional(readOnly = true)
    public List<EventResponse> getAllEvents(Long currentUserId) {
        return eventRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(event -> mapToEventResponse(event, currentUserId))
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteEvent(Long eventId, UserPrincipal actor, String ipAddress) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Event not found."));
        if (event.getClub() != null) clubService.verifyClubAdminOwnership(event.getClub().getId(), actor);
        else if (actor.getRole() != Role.SUPER_ADMIN) throw new org.springframework.security.access.AccessDeniedException("Only super admins can delete platform events.");
        registrationRepository.deleteByEventId(eventId);
        eventRepository.delete(event);
        auditLogService.record("EVENT_DELETED", actor.getUsername(), actor.getRole().name(),
                "EVT-" + eventId, "Deleted event: " + event.getTitle(), ipAddress);
    }

    // --- Student Registration ---
    @Transactional
    public ApiResponse<EventResponse> registerForEvent(Long eventId, UserPrincipal student, String ipAddress) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Event not found."));

        if (!event.isPublished()) {
            throw new IllegalStateException("Event is not currently open for registrations.");
        }

        User user = userRepository.findById(student.getId())
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        Optional<EventRegistration> existing = registrationRepository.findByEventIdAndUserId(eventId, student.getId());
        if (existing.isPresent()) {
            EventRegistration reg = existing.get();
            if (reg.getStatus() == RegistrationStatus.REGISTERED) {
                throw new IllegalStateException("You are already registered for this event.");
            }
            // Re-register if previously cancelled
            if (event.getRegisteredCount() >= event.getCapacity()) {
                throw new IllegalStateException(String.format("Event has reached maximum capacity (%d/%d).", event.getCapacity(), event.getCapacity()));
            }
            reg.setStatus(RegistrationStatus.REGISTERED);
            registrationRepository.save(reg);
            event.setRegisteredCount(event.getRegisteredCount() + 1);
            eventRepository.save(event);
            return ApiResponse.success("Registration confirmed!", mapToEventResponse(event, student.getId()));
        }

        // Check capacity atomically
        if (event.getRegisteredCount() >= event.getCapacity()) {
            throw new IllegalStateException(String.format("Event has reached maximum capacity (%d/%d).", event.getCapacity(), event.getCapacity()));
        }

        EventRegistration registration = new EventRegistration(event, user, RegistrationStatus.REGISTERED);
        registrationRepository.save(registration);

        event.setRegisteredCount(event.getRegisteredCount() + 1);
        eventRepository.save(event);

        auditLogService.record("EVENT_REGISTRATION", user.getEmail(), user.getRole().name(),
                "EVT-" + event.getId(), user.getFullName() + " registered for " + event.getTitle(), ipAddress);

        return ApiResponse.success("Successfully registered for event!", mapToEventResponse(event, student.getId()));
    }

    @Transactional
    public ApiResponse<Void> cancelRegistration(Long eventId, UserPrincipal student, String ipAddress) {
        EventRegistration registration = registrationRepository.findByEventIdAndUserId(eventId, student.getId())
                .orElseThrow(() -> new IllegalArgumentException("Registration record not found for this event."));

        if (registration.getStatus() == RegistrationStatus.CANCELLED) {
            throw new IllegalStateException("Registration is already cancelled.");
        }

        registration.setStatus(RegistrationStatus.CANCELLED);
        registrationRepository.save(registration);

        Event event = registration.getEvent();
        if (event.getRegisteredCount() > 0) {
            event.setRegisteredCount(event.getRegisteredCount() - 1);
            eventRepository.save(event);
        }

        auditLogService.record("EVENT_REG_CANCELLED", student.getUsername(), student.getRole().name(),
                "EVT-" + event.getId(), "Cancelled registration for " + event.getTitle(), ipAddress);

        return ApiResponse.success("Registration cancelled successfully.");
    }

    @Transactional(readOnly = true)
    public List<EventResponse> getMyRegisteredEvents(UserPrincipal student) {
        return registrationRepository.findByUserIdAndStatus(student.getId(), RegistrationStatus.REGISTERED).stream()
                .map(reg -> {
                    EventResponse res = mapToEventResponse(reg.getEvent(), student.getId());
                    res.setUserRegistered(true);
                    return res;
                })
                .collect(Collectors.toList());
    }

    public EventResponse mapToEventResponse(Event event, Long currentUserId) {
        EventResponse res = new EventResponse();
        res.setId(event.getId());
        if (event.getClub() != null) {
            res.setClubId(event.getClub().getId());
            res.setClubName(event.getClub().getName());
        }
        res.setTitle(event.getTitle());
        res.setDescription(event.getDescription());
        res.setEventDate(event.getEventDate());
        res.setLocation(event.getLocation());
        res.setEventLink(event.getEventLink());
        res.setCapacity(event.getCapacity());
        res.setRegisteredCount(event.getRegisteredCount());
        res.setPublished(event.isPublished());
        res.setPlatformEvent(event.isPlatformEvent());
        res.setBadgeLabel(event.getBadgeLabel());
        res.setCreatedAt(event.getCreatedAt());

        if (currentUserId != null) {
            boolean registered = registrationRepository.findByEventIdAndUserId(event.getId(), currentUserId)
                    .map(r -> r.getStatus() == RegistrationStatus.REGISTERED)
                    .orElse(false);
            res.setUserRegistered(registered);
        }
        return res;
    }

    private String normalizeEventLink(String eventLink) {
        if (eventLink == null || eventLink.isBlank()) {
            return null;
        }
        String normalized = eventLink.trim();
        if (!normalized.startsWith("https://") && !normalized.startsWith("http://")) {
            throw new IllegalArgumentException("Event link must start with http:// or https://.");
        }
        return normalized;
    }
}
