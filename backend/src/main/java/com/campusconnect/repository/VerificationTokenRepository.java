package com.campusconnect.repository;

import com.campusconnect.entity.TokenType;
import com.campusconnect.entity.VerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VerificationTokenRepository extends JpaRepository<VerificationToken, Long> {
    Optional<VerificationToken> findByToken(String token);
    List<VerificationToken> findByUserIdAndTokenTypeAndIsUsedFalse(Long userId, TokenType tokenType);
    void deleteByUserId(Long userId);
}
