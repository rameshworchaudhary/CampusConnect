package com.campusconnect.service;

import com.campusconnect.dto.*;
import com.campusconnect.entity.*;
import com.campusconnect.repository.*;
import com.campusconnect.security.JwtTokenProvider;
import com.campusconnect.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthAndRbacSecurityTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private ClubRepository clubRepository;
    @Mock
    private VerificationTokenRepository tokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtTokenProvider tokenProvider;
    @Mock
    private EmailService emailService;
    @Mock
    private AuditLogService auditLogService;

    private AuthService authService;
    private UserService userService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, clubRepository, tokenRepository, passwordEncoder, tokenProvider, emailService, auditLogService);
        userService = new UserService(userRepository, clubRepository, auditLogService, authService);
    }

    @Test
    @DisplayName("Verify Student registration ALWAYS creates STUDENT role")
    void studentRegistration_AlwaysCreatesStudentRole() {
        RegisterRequest request = new RegisterRequest();
        request.setFullName("Test Student");
        request.setEmail("student@univ.edu");
        request.setPassword("Password123!");
        request.setStudentId("STU-11223");

        when(userRepository.existsByEmail("student@univ.edu")).thenReturn(false);
        when(passwordEncoder.encode(any())).thenReturn("hashedPass");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(10L);
            return u;
        });

        AuthResponse response = authService.register(request, "127.0.0.1");

        assertNotNull(response);
        assertEquals(Role.STUDENT, response.getUser().getRole());
        verify(userRepository).save(argThat(user -> user.getRole() == Role.STUDENT && !user.isVerified()));
    }

    @Test
    @DisplayName("Verify Unverified accounts cannot log in")
    void unverifiedAccount_CannotLogin() {
        LoginRequest request = new LoginRequest();
        request.setEmail("unverified@univ.edu");
        request.setPassword("Password123!");

        User unverifiedUser = new User("Unverified", "unverified@univ.edu", "hashedPass", "STU-001", "CS", Role.STUDENT, true, false);
        when(userRepository.findByEmail("unverified@univ.edu")).thenReturn(Optional.of(unverifiedUser));
        when(passwordEncoder.matches("Password123!", "hashedPass")).thenReturn(true);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> authService.login(request, "127.0.0.1"));
        assertTrue(ex.getMessage().contains("verified"));
    }

    @Test
    @DisplayName("Verify valid email token marks the account verified and consumes the token")
    void validVerificationToken_VerifiesAndConsumesAccount() {
        User user = new User("Verified Student", "verified@univ.edu", "hash", "STU-003", "CS", Role.STUDENT, true, false);
        user.setId(3L);
        String rawToken = "valid-verification-token";
        VerificationToken verificationToken = new VerificationToken(
                user,
                sha256(rawToken),
                TokenType.EMAIL_VERIFY,
                LocalDateTime.now().plusHours(1)
        );

        when(tokenRepository.findByToken(sha256(rawToken))).thenReturn(Optional.of(verificationToken));

        ApiResponse<String> response = authService.verifyEmail(" " + rawToken + " ");

        assertTrue(response.isSuccess());
        assertTrue(user.isVerified());
        assertTrue(verificationToken.isUsed());
        verify(userRepository).save(user);
        verify(tokenRepository).save(verificationToken);
    }

    @Test
    @DisplayName("Verify invalid email token does not verify an account")
    void invalidVerificationToken_DoesNotVerifyAccount() {
        when(tokenRepository.findByToken(any())).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> authService.verifyEmail("invalid-token"));

        verify(userRepository, never()).save(any(User.class));
        verify(tokenRepository, never()).save(any(VerificationToken.class));
    }

    @Test
    @DisplayName("Verify expired email token does not verify an account")
    void expiredVerificationToken_DoesNotVerifyAccount() {
        User user = new User("Expired Student", "expired@univ.edu", "hash", "STU-004", "CS", Role.STUDENT, true, false);
        VerificationToken verificationToken = new VerificationToken(
                user,
                sha256("expired-token"),
                TokenType.EMAIL_VERIFY,
                LocalDateTime.now().minusMinutes(1)
        );
        when(tokenRepository.findByToken(sha256("expired-token"))).thenReturn(Optional.of(verificationToken));

        assertThrows(IllegalArgumentException.class, () -> authService.verifyEmail("expired-token"));

        assertFalse(user.isVerified());
        assertFalse(verificationToken.isUsed());
        verify(userRepository, never()).save(any(User.class));
        verify(tokenRepository, never()).save(any(VerificationToken.class));
    }

    @Test
    @DisplayName("Verify reused email token does not verify an account")
    void reusedVerificationToken_DoesNotVerifyAccount() {
        User user = new User("Reused Student", "reused@univ.edu", "hash", "STU-005", "CS", Role.STUDENT, true, false);
        VerificationToken verificationToken = new VerificationToken(
                user,
                sha256("reused-token"),
                TokenType.EMAIL_VERIFY,
                LocalDateTime.now().plusHours(1)
        );
        verificationToken.setUsed(true);
        when(tokenRepository.findByToken(sha256("reused-token"))).thenReturn(Optional.of(verificationToken));

        assertThrows(IllegalArgumentException.class, () -> authService.verifyEmail("reused-token"));

        assertFalse(user.isVerified());
        verify(userRepository, never()).save(any(User.class));
        verify(tokenRepository, never()).save(any(VerificationToken.class));
    }

    @Test
    @DisplayName("Verify Deactivated accounts cannot log in")
    void deactivatedAccount_CannotLogin() {
        LoginRequest request = new LoginRequest();
        request.setEmail("deactivated@univ.edu");
        request.setPassword("Password123!");

        User inactiveUser = new User("Inactive", "deactivated@univ.edu", "hashedPass", "STU-002", "CS", Role.STUDENT, false, true);
        when(userRepository.findByEmail("deactivated@univ.edu")).thenReturn(Optional.of(inactiveUser));
        when(passwordEncoder.matches("Password123!", "hashedPass")).thenReturn(true);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> authService.login(request, "127.0.0.1"));
        assertTrue(ex.getMessage().contains("deactivated"));
    }

    @Test
    @DisplayName("Verify Last active Super Admin cannot be demoted")
    void lastActiveSuperAdmin_CannotBeDemoted() {
        User admin = new User("Root Admin", "admin@univ.edu", "hash", "ADM-1", "Admin", Role.SUPER_ADMIN, true, true);
        admin.setId(1L);

        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.countByRoleAndIsActiveTrue(Role.SUPER_ADMIN)).thenReturn(1L);

        RoleUpdateRequest request = new RoleUpdateRequest(Role.STUDENT, null);
        UserPrincipal actor = UserPrincipal.create(admin);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> userService.updateUserRole(1L, request, actor, "127.0.0.1"));
        assertTrue(ex.getMessage().contains("Cannot demote the last active SUPER_ADMIN"));
    }

    @Test
    @DisplayName("Verify Last active Super Admin cannot be deactivated")
    void lastActiveSuperAdmin_CannotBeDeactivated() {
        User admin = new User("Root Admin", "admin@univ.edu", "hash", "ADM-1", "Admin", Role.SUPER_ADMIN, true, true);
        admin.setId(1L);

        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepository.countByRoleAndIsActiveTrue(Role.SUPER_ADMIN)).thenReturn(1L);

        UserPrincipal actor = UserPrincipal.create(admin);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> userService.updateUserStatus(1L, false, actor, "127.0.0.1"));
        assertTrue(ex.getMessage().contains("Cannot deactivate the last active SUPER_ADMIN"));
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hash = new StringBuilder(digest.length * 2);
            for (byte item : digest) {
                hash.append(String.format("%02x", item));
            }
            return hash.toString();
        } catch (Exception ex) {
            throw new AssertionError(ex);
        }
    }
}
