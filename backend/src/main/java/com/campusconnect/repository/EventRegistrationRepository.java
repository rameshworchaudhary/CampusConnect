package com.campusconnect.repository;

import com.campusconnect.entity.EventRegistration;
import com.campusconnect.entity.RegistrationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EventRegistrationRepository extends JpaRepository<EventRegistration, Long> {
    List<EventRegistration> findByEventId(Long eventId);
    List<EventRegistration> findByUserId(Long userId);
    List<EventRegistration> findByUserIdAndStatus(Long userId, RegistrationStatus status);
    Optional<EventRegistration> findByEventIdAndUserId(Long eventId, Long userId);
    long countByEventIdAndStatus(Long eventId, RegistrationStatus status);
    long countByUserIdAndStatus(Long userId, RegistrationStatus status);
    long countByStatus(RegistrationStatus status);
    void deleteByUserId(Long userId);
    void deleteByEventId(Long eventId);
}
