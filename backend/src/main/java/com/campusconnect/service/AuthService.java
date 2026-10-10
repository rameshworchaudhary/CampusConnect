package com.campusconnect.service;

import com.campusconnect.dto.*;
import com.campusconnect.entity.*;
import com.campusconnect.repository.ClubRepository;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.repository.VerificationTokenRepository;
import com.campusconnect.security.JwtTokenProvider;
import com.campusconnect.security.UserPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;

@Service
public class AuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final ClubRepository clubRepository;
    private final VerificationTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final EmailService emailService;
    private final AuditLogService auditLogService;

    public AuthService(
            UserRepository userRepository,
            ClubRepository clubRepository,
            VerificationTokenRepository tokenRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider tokenProvider,
            EmailService emailService,
            AuditLogService auditLogService) {
        this.userRepository = userRepository;
        this.clubRepository = clubRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.emailService = emailService;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request, String ipAddress) {
        if (userRepository.existsByEmail(request.getEmail().toLowerCase().trim())) {
            throw new IllegalArgumentException("An account with this email address already exists.");
        }

        // Strict security rule: public registration ALWAYS creates STUDENT role
        User user = new User(
                request.getFullName().trim(),
                request.getEmail().toLowerCase().trim(),
                passwordEncoder.encode(request.getPassword()),
                request.getStudentId() != null && !request.getStudentId().isBlank() ? request.getStudentId().trim() : "STU-" + (10000 + (int)(Math.random() * 89999)),
                request.getDepartment() != null && !request.getDepartment().isBlank() ? request.getDepartment().trim() : "General Studies",
                Role.STUDENT,
                true,
                false // requires verification
        );

        user = userRepository.save(user);

        // Generate email verification token (24-hour expiration)
        String tokenStr = generateToken();
        VerificationToken verificationToken = new VerificationToken(
                user,
                hashToken(tokenStr),
                TokenType.EMAIL_VERIFY,
                LocalDateTime.now().plusHours(24)
        );
        tokenRepository.save(verificationToken);

        // Send email or log token
        emailService.sendVerificationEmail(user.getEmail(), tokenStr);

        auditLogService.record("USER_REGISTERED", user.getEmail(), Role.STUDENT.name(),
                user.getStudentId(), "New student registered with email " + user.getEmail(), ipAddress);

        String message = "Registration successful! A verification email has been sent to your email address. Please check your inbox and spam folder.";

        UserResponse userResponse = mapToUserResponse(user);
        return new AuthResponse(null, userResponse, message);
    }

    @Transactional
    public ApiResponse<String> verifyEmail(String tokenStr) {
        if (tokenStr == null || tokenStr.isBlank()) {
            throw new IllegalArgumentException("A verification token is required.");
        }

        VerificationToken token = tokenRepository.findByToken(hashToken(tokenStr.trim()))
                .orElseThrow(() -> new IllegalArgumentException("Invalid verification link or token."));

        if (token.getTokenType() != TokenType.EMAIL_VERIFY) {
            throw new IllegalArgumentException("Invalid token type.");
        }

        if (token.isUsed()) {
            throw new IllegalArgumentException("This verification link has already been used.");
        }

        if (token.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("This verification link has expired. Please request a new one.");
        }

        User user = token.getUser();
        user.setVerified(true);
        token.setUsed(true);

        userRepository.save(user);
        tokenRepository.save(token);

        auditLogService.record("EMAIL_VERIFIED", user.getEmail(), user.getRole().name(),
                user.getStudentId(), "User email verified successfully", "127.0.0.1");

        return ApiResponse.success("Email verified successfully! You can now log in to your account.", null);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request, String ipAddress) {
        User user = userRepository.findByEmail(request.getEmail().toLowerCase().trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password.");
        }

        if (!user.isActive()) {
            throw new IllegalStateException("Your account has been deactivated. Please contact campus administration.");
        }

        if (!user.isVerified()) {
            throw new IllegalStateException("Your email address has not been verified yet. Please check your inbox or verify your account.");
        }

        UserPrincipal principal = UserPrincipal.create(user);
        String jwt = tokenProvider.generateToken(principal);

        UserResponse userResponse = mapToUserResponse(user);
        return new AuthResponse(jwt, userResponse, "Login successful");
    }

    @Transactional
    public ApiResponse<String> forgotPassword(ForgotPasswordRequest request, String ipAddress) {
        String email = request.getEmail().toLowerCase().trim();
        userRepository.findByEmail(email).ifPresent(user -> {
            String tokenStr = generateToken();
            VerificationToken token = new VerificationToken(
                    user,
                    hashToken(tokenStr),
                    TokenType.PASSWORD_RESET,
                    LocalDateTime.now().plusHours(1)
            );
            tokenRepository.save(token);
            emailService.sendPasswordResetEmail(user.getEmail(), tokenStr);
            auditLogService.record("PASSWORD_RESET_REQUESTED", user.getEmail(), user.getRole().name(),
                    user.getStudentId(), "Password reset link requested", ipAddress);
        });

        return ApiResponse.success("If an account exists for that email, a password reset link has been sent.", null);
    }

    @Transactional
    public ApiResponse<Void> resetPassword(ResetPasswordRequest request, String ipAddress) {
        VerificationToken token = tokenRepository.findByToken(hashToken(request.getToken()))
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired password reset token."));

        if (token.getTokenType() != TokenType.PASSWORD_RESET) {
            throw new IllegalArgumentException("Invalid token type.");
        }

        if (token.isUsed() || token.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Password reset link has expired or has already been used.");
        }

        User user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        token.setUsed(true);

        userRepository.save(user);
        tokenRepository.save(token);

        auditLogService.record("PASSWORD_RESET_COMPLETED", user.getEmail(), user.getRole().name(),
                user.getStudentId(), "Password successfully reset via token", ipAddress);

        return ApiResponse.success("Password reset successfully. You may now log in with your new password.");
    }

    @Transactional
    public ApiResponse<Void> changePassword(Long userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        auditLogService.record("PASSWORD_CHANGED", user.getEmail(), user.getRole().name(),
                user.getStudentId(), "User changed password from account settings", "127.0.0.1");

        return ApiResponse.success("Password changed successfully.");
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte value : digest) {
                hex.append(String.format("%02x", value));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("Secure token hashing is unavailable.", ex);
        }
    }

    public UserResponse mapToUserResponse(User user) {
        Long assignedClubId = null;
        String assignedClubName = null;

        if (user.getRole() == Role.CLUB_ADMIN) {
            Club club = clubRepository.findByAssignedAdminId(user.getId()).orElse(null);
            if (club != null) {
                assignedClubId = club.getId();
                assignedClubName = club.getName();
            }
        }

        return new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getStudentId(),
                user.getDepartment(),
                user.getRole(),
                user.isActive(),
                user.isVerified(),
                assignedClubId,
                assignedClubName
        );
    }
}
