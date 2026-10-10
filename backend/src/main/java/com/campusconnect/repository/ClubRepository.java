package com.campusconnect.repository;

import com.campusconnect.entity.Club;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClubRepository extends JpaRepository<Club, Long> {
    List<Club> findByIsPublishedTrue();
    Optional<Club> findByAssignedAdminId(Long adminId);
    Optional<Club> findByRefId(String refId);
    List<Club> findByCategory(String category);
}
