package com.campusconnect.repository;

import com.campusconnect.entity.Role;
import com.campusconnect.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    long countByRole(Role role);
    long countByRoleAndIsActiveTrue(Role role);
    long countByIsActiveTrue();
    List<User> findByRole(Role role);
}
