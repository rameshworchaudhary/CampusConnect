package com.campusconnect.repository;

import com.campusconnect.entity.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    List<Announcement> findByIsActiveTrueOrderByCreatedAtDesc();
    List<Announcement> findByClubIdAndIsActiveTrueOrderByCreatedAtDesc(Long clubId);
    List<Announcement> findByClubIsNullAndIsActiveTrueOrderByCreatedAtDesc();
    List<Announcement> findAllByOrderByCreatedAtDesc();
    List<Announcement> findByClubId(Long clubId);
}
