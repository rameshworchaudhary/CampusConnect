package com.campusconnect.repository;

import com.campusconnect.entity.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {
    List<Event> findByIsPublishedTrue();
    List<Event> findByClubIdAndIsPublishedTrue(Long clubId);
    List<Event> findByIsPlatformEventTrueAndIsPublishedTrue();
    long countByIsPublishedTrue();
    List<Event> findAllByOrderByCreatedAtDesc();
    List<Event> findByClubId(Long clubId);
}
