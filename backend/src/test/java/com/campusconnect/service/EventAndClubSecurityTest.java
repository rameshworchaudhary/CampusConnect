package com.campusconnect.service;

import com.campusconnect.dto.*;
import com.campusconnect.entity.*;
import com.campusconnect.repository.*;
import com.campusconnect.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EventAndClubSecurityTest {

    @Mock
    private ClubRepository clubRepository;
    @Mock
    private ClubMembershipRepository membershipRepository;
    @Mock
    private EventRepository eventRepository;
    @Mock
    private EventRegistrationRepository registrationRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private AuditLogService auditLogService;

    private ClubService clubService;
    private EventService eventService;

    @BeforeEach
    void setUp() {
        clubService = new ClubService(clubRepository, membershipRepository, userRepository, auditLogService);
        eventService = new EventService(eventRepository, registrationRepository, clubRepository, userRepository, clubService, auditLogService);
    }

    @Test
    @DisplayName("Verify Club Admin cannot access or modify a club they do not own")
    void clubAdmin_CannotModifyUnassignedClub() {
        User adminUser = new User("Sarah Chen", "sarah@univ.edu", "hash", "CA-102", "CS", Role.CLUB_ADMIN, true, true);
        adminUser.setId(102L);

        User anotherAdmin = new User("David Park", "david@univ.edu", "hash", "CA-103", "PoliSci", Role.CLUB_ADMIN, true, true);
        anotherAdmin.setId(103L);

        Club debateClub = new Club("ORG-0082", "Debate Union", "Humanities", "Desc", "Thurs", "Room B", "Prof C", true, anotherAdmin);
        debateClub.setId(2L);

        when(clubRepository.findById(2L)).thenReturn(Optional.of(debateClub));

        UserPrincipal sarahPrincipal = UserPrincipal.create(adminUser);
        ClubRequest updateRequest = new ClubRequest();
        updateRequest.setName("Hacked Name");

        assertThrows(AccessDeniedException.class, () ->
                clubService.updateClubByAdmin(2L, updateRequest, sarahPrincipal, "127.0.0.1")
        );
    }

    @Test
    @DisplayName("Verify Event registration strictly rejects when capacity is full")
    void eventRegistration_RejectsWhenFull() {
        User student = new User("Jordan Vance", "jordan@univ.edu", "hash", "STU-84920", "CS", Role.STUDENT, true, true);
        student.setId(50L);

        Event fullEvent = new Event(null, "Popular Workshop", "Desc", "Tomorrow", "Hall 1", 50, 50, true, true, "Full");
        fullEvent.setId(99L);

        when(eventRepository.findById(99L)).thenReturn(Optional.of(fullEvent));
        when(userRepository.findById(50L)).thenReturn(Optional.of(student));
        when(registrationRepository.findByEventIdAndUserId(99L, 50L)).thenReturn(Optional.empty());

        UserPrincipal studentPrincipal = UserPrincipal.create(student);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                eventService.registerForEvent(99L, studentPrincipal, "127.0.0.1")
        );
        assertTrue(ex.getMessage().contains("maximum capacity"));
    }

    @Test
    @DisplayName("Verify Event registration succeeds when capacity is available")
    void eventRegistration_SucceedsWhenCapacityAvailable() {
        User student = new User("Jordan Vance", "jordan@univ.edu", "hash", "STU-84920", "CS", Role.STUDENT, true, true);
        student.setId(50L);

        Event openEvent = new Event(null, "Hackathon", "Desc", "Tomorrow", "Hall 1", 100, 88, true, true, "Open RSVP");
        openEvent.setId(100L);

        when(eventRepository.findById(100L)).thenReturn(Optional.of(openEvent));
        when(userRepository.findById(50L)).thenReturn(Optional.of(student));
        when(registrationRepository.findByEventIdAndUserId(100L, 50L)).thenReturn(Optional.empty());
        when(eventRepository.save(any(Event.class))).thenReturn(openEvent);

        UserPrincipal studentPrincipal = UserPrincipal.create(student);

        ApiResponse<EventResponse> response = eventService.registerForEvent(100L, studentPrincipal, "127.0.0.1");
        assertTrue(response.isSuccess());
        assertEquals(89, openEvent.getRegisteredCount());
        verify(registrationRepository).save(any(EventRegistration.class));
    }
}
