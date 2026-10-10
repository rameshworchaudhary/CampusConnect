package com.campusconnect.repository;

import com.campusconnect.entity.LandingCms;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LandingCmsRepository extends JpaRepository<LandingCms, Long> {
    Optional<LandingCms> findTopByOrderByIdAsc();
}
