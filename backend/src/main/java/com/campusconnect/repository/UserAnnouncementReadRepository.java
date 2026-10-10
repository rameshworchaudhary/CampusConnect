package com.campusconnect.repository;

import com.campusconnect.entity.UserAnnouncementRead;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserAnnouncementReadRepository extends JpaRepository<UserAnnouncementRead, Long> {
    boolean existsByUserIdAndAnnouncementId(Long userId, Long announcementId);
    List<UserAnnouncementRead> findByUserId(Long userId);
    void deleteByUserId(Long userId);
    void deleteByAnnouncementId(Long announcementId);
}
