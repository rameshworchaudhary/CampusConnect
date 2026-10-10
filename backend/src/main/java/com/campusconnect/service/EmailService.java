package com.campusconnect.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;
    private final String fromEmail;
    private final String frontendUrl;
    private final String smtpUsername;
    private final String smtpPassword;

    public EmailService(
            JavaMailSender mailSender,
            @Value("${app.mail.from:}") String fromEmail,
            @Value("${app.frontend.url:http://localhost:5173}") String frontendUrl,
            @Value("${spring.mail.username:}") String smtpUsername,
            @Value("${spring.mail.password:}") String smtpPassword) {
        this.mailSender = mailSender;
        this.fromEmail = fromEmail;
        this.frontendUrl = frontendUrl;
        this.smtpUsername = smtpUsername;
        this.smtpPassword = smtpPassword;
    }

    public boolean isSmtpConfigured() {
        return StringUtils.hasText(smtpUsername) && StringUtils.hasText(smtpPassword);
    }

    public void sendVerificationEmail(String toEmail, String token) {
        String verifyUrl = frontendUrl + "/verify-email?token=" + token;
        if (!isSmtpConfigured()) {
            throw new IllegalStateException("Email delivery is not configured. Set MAIL_USERNAME and MAIL_PASSWORD before registering.");
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("CampusConnect — Verify Your Student Email");
            message.setText("Welcome to CampusConnect!\n\nPlease click the link below to verify your student account:\n" +
                    verifyUrl + "\n\nThis verification link expires in 24 hours.\n\nBest regards,\nCampusConnect Administration");
            mailSender.send(message);
            logger.info("Verification email successfully dispatched via SMTP to {}", toEmail);
        } catch (Exception ex) {
            logger.error("Verification email delivery failed via SMTP ({})", ex.getClass().getSimpleName());
            throw new RuntimeException("We could not send the verification email. Please try again later.", ex);
        }
    }

    public void sendPasswordResetEmail(String toEmail, String token) {
        String resetUrl = frontendUrl + "/reset-password?token=" + token;
        if (!isSmtpConfigured()) {
            throw new IllegalStateException("Email delivery is not configured. Set MAIL_USERNAME and MAIL_PASSWORD before requesting a password reset.");
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("CampusConnect — Password Reset Request");
            message.setText("Hello,\n\nWe received a request to reset your CampusConnect password.\n" +
                    "Click the link below to set a new password:\n" + resetUrl +
                    "\n\nIf you did not request this, please ignore this email.\nThis link expires in 1 hour.\n\nCampusConnect Security");
            mailSender.send(message);
            logger.info("Password reset email successfully dispatched via SMTP to {}", toEmail);
        } catch (Exception ex) {
            logger.error("Password reset email delivery failed via SMTP ({})", ex.getClass().getSimpleName());
            throw new RuntimeException("We could not send the password reset email. Please try again later.", ex);
        }
    }
}
