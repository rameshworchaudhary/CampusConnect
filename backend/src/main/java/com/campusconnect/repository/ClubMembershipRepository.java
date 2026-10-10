package com.campusconnect.repository;

import com.campusconnect.entity.ClubMembership;
import com.campusconnect.entity.MembershipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClubMembershipRepository extends JpaRepository<ClubMembership, Long> {
    List<ClubMembership> findByClubIdAndStatus(Long clubId, MembershipStatus status);
    List<ClubMembership> findByClubId(Long clubId);
    List<ClubMembership> findByUserId(Long userId);
    List<ClubMembership> findByUserIdAndStatus(Long userId, MembershipStatus status);
    Optional<ClubMembership> findByClubIdAndUserId(Long clubId, Long userId);
    long countByClubIdAndStatus(Long clubId, MembershipStatus status);
    long countByUserIdAndStatus(Long userId, MembershipStatus status);
    long countByStatus(MembershipStatus status);
    void deleteByUserId(Long userId);
    void deleteByClubId(Long clubId);
    List<ClubMembership> findByReviewedById(Long userId);
}
