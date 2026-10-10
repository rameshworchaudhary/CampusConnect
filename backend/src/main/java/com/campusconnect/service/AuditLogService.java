package com.campusconnect.service;

import com.campusconnect.dto.AuditLogResponse;
import com.campusconnect.entity.AuditLog;
import com.campusconnect.repository.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public void record(String actionType, String actorEmail, String actorRole, String targetIdentifier, String details, String ipAddress) {
        String shaHash = generateHash(actionType, actorEmail, targetIdentifier, details);
        AuditLog log = new AuditLog(actionType, actorEmail, actorRole, targetIdentifier, details, ipAddress != null ? ipAddress : "127.0.0.1", shaHash);
        auditLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public List<AuditLogResponse> getRecentLogs() {
        return auditLogRepository.findTop50ByOrderByCreatedAtDesc().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private String generateHash(String actionType, String actorEmail, String target, String details) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String raw = actionType + ":" + actorEmail + ":" + target + ":" + details + ":" + System.currentTimeMillis();
            byte[] encoded = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder("SHA256-");
            for (int i = 0; i < 4; i++) {
                String hex = Integer.toHexString(0xff & encoded[i]);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            hexString.append("...");
            for (int i = encoded.length - 4; i < encoded.length; i++) {
                String hex = Integer.toHexString(0xff & encoded[i]);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return "SHA256-" + UUID.randomUUID().toString().substring(0, 8);
        }
    }

    private AuditLogResponse mapToResponse(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getActionType(),
                log.getActorEmail(),
                log.getActorRole(),
                log.getTargetIdentifier(),
                log.getDetails(),
                log.getIpAddress(),
                log.getShaHash(),
                log.getCreatedAt()
        );
    }
}
