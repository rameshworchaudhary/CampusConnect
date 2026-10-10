-- ==============================================================
-- CampusConnect - Database Schema DDL
-- ==============================================================

CREATE DATABASE IF NOT EXISTS `campusconnect` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `campusconnect`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `full_name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `student_id` VARCHAR(50),
    `department` VARCHAR(100),
    `role` VARCHAR(30) NOT NULL DEFAULT 'STUDENT',
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `is_verified` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_user_email` (`email`),
    INDEX `idx_user_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Clubs Table
CREATE TABLE IF NOT EXISTS `clubs` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `ref_id` VARCHAR(50) UNIQUE,
    `name` VARCHAR(150) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `description` TEXT,
    `meeting_schedule` VARCHAR(150),
    `meeting_location` VARCHAR(150),
    `faculty_advisor` VARCHAR(150),
    `is_published` BOOLEAN NOT NULL DEFAULT TRUE,
    `assigned_admin_id` BIGINT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_clubs_admin` FOREIGN KEY (`assigned_admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    INDEX `idx_clubs_published` (`is_published`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Club Memberships Table
CREATE TABLE IF NOT EXISTS `club_memberships` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `club_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `reviewed_at` TIMESTAMP NULL,
    `reviewed_by_id` BIGINT NULL,
    CONSTRAINT `fk_membership_club` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_membership_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_membership_reviewer` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    UNIQUE KEY `uk_club_user_membership` (`club_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Events Table
CREATE TABLE IF NOT EXISTS `events` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `club_id` BIGINT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT,
    `event_date` VARCHAR(100) NOT NULL,
    `location` VARCHAR(150) NOT NULL,
    `event_link` VARCHAR(500),
    `capacity` INT NOT NULL DEFAULT 100,
    `registered_count` INT NOT NULL DEFAULT 0,
    `is_published` BOOLEAN NOT NULL DEFAULT TRUE,
    `is_platform_event` BOOLEAN NOT NULL DEFAULT FALSE,
    `badge_label` VARCHAR(50) DEFAULT 'Open RSVP',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_events_club` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`) ON DELETE CASCADE,
    INDEX `idx_events_published` (`is_published`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Event Registrations Table
CREATE TABLE IF NOT EXISTS `event_registrations` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `event_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'REGISTERED',
    `registered_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_registration_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_registration_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_event_user_registration` (`event_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Announcements Table
CREATE TABLE IF NOT EXISTS `announcements` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `club_id` BIGINT NULL,
    `title` VARCHAR(250) NOT NULL,
    `content` TEXT NOT NULL,
    `posted_by_name` VARCHAR(150) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_announcements_club` FOREIGN KEY (`club_id`) REFERENCES `clubs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. User Announcement Reads Table
CREATE TABLE IF NOT EXISTS `user_announcement_reads` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT NOT NULL,
    `announcement_id` BIGINT NOT NULL,
    `read_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_read_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_read_announcement` FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_user_announcement_read` (`user_id`, `announcement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Verification Tokens Table
CREATE TABLE IF NOT EXISTS `verification_tokens` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT NOT NULL,
    `token` VARCHAR(100) NOT NULL UNIQUE,
    `token_type` VARCHAR(50) NOT NULL,
    `expiry_date` TIMESTAMP NOT NULL,
    `is_used` BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT `fk_token_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Landing Page CMS Table
CREATE TABLE IF NOT EXISTS `landing_cms` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `site_name` VARCHAR(100) NOT NULL DEFAULT 'CampusConnect',
    `hero_tag` VARCHAR(100),
    `hero_heading` VARCHAR(255) NOT NULL DEFAULT 'One place for campus life.',
    `hero_description` TEXT DEFAULT 'CampusConnect helps students discover clubs, join communities, and register for campus events while giving campus teams one reliable place to manage activities.',
    `stat_clubs_label` VARCHAR(50),
    `stat_clubs_value` VARCHAR(50),
    `stat_students_label` VARCHAR(50),
    `stat_students_value` VARCHAR(50),
    `stat_events_label` VARCHAR(50),
    `stat_events_value` VARCHAR(50),
    `notice_banner_title` VARCHAR(255),
    `notice_banner_text` TEXT,
    `about_text` TEXT DEFAULT 'CampusConnect connects students, club administrators, and campus leadership through one role-based platform for clubs, events, memberships, and announcements.',
    `footer_text` TEXT DEFAULT 'CampusConnect — a central hub for discovering and managing campus communities.',
    `featured_club_ids` VARCHAR(255) DEFAULT '',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Audit Logs Table
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `action_type` VARCHAR(100) NOT NULL,
    `actor_email` VARCHAR(150) NOT NULL,
    `actor_role` VARCHAR(50) NOT NULL,
    `target_identifier` VARCHAR(150),
    `details` TEXT,
    `ip_address` VARCHAR(50),
    `sha_hash` VARCHAR(100),
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
