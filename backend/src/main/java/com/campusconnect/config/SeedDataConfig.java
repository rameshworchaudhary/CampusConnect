package com.campusconnect.config;

import com.campusconnect.entity.*;
import com.campusconnect.repository.*;
import com.campusconnect.service.AuditLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Configuration
public class SeedDataConfig implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(SeedDataConfig.class);

    private final UserRepository userRepository;
    private final ClubRepository clubRepository;
    private final ClubMembershipRepository membershipRepository;
    private final EventRepository eventRepository;
    private final EventRegistrationRepository registrationRepository;
    private final AnnouncementRepository announcementRepository;
    private final LandingCmsRepository cmsRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    @Value("${app.admin.bootstrap.email:admin@univ.edu}")
    private String adminEmail;

    @Value("${app.admin.bootstrap.password}")
    private String adminPassword;

    @Value("${app.admin.bootstrap.name:SuperAdmin}")
    private String adminName;

    @Value("${app.seed-demo-data:false}")
    private boolean seedDemoData;

    public SeedDataConfig(
            UserRepository userRepository,
            ClubRepository clubRepository,
            ClubMembershipRepository membershipRepository,
            EventRepository eventRepository,
            EventRegistrationRepository registrationRepository,
            AnnouncementRepository announcementRepository,
            LandingCmsRepository cmsRepository,
            PasswordEncoder passwordEncoder,
            AuditLogService auditLogService) {
        this.userRepository = userRepository;
        this.clubRepository = clubRepository;
        this.membershipRepository = membershipRepository;
        this.eventRepository = eventRepository;
        this.registrationRepository = registrationRepository;
        this.announcementRepository = announcementRepository;
        this.cmsRepository = cmsRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
    }

    @Override
    @Transactional
    public void run(String... args) {
        bootstrapSuperAdmin();
        if (seedDemoData && clubRepository.count() == 0) {
            seedStitchReferenceData();
        }
    }

    private void bootstrapSuperAdmin() {
        if (!userRepository.existsByEmail(adminEmail.toLowerCase().trim())) {
            User superAdmin = new User(
                    adminName,
                    adminEmail.toLowerCase().trim(),
                    passwordEncoder.encode(adminPassword),
                    "ADMIN-001",
                    "Campus Administration",
                    Role.SUPER_ADMIN,
                    true,
                    true // Verified by default for bootstrap super admin
            );
            userRepository.save(superAdmin);
            logger.info("==================================================================");
            logger.info("BOOTSTRAP: Initial SUPER_ADMIN account created successfully!");
            logger.info("Email: {}", adminEmail);
            logger.info("Password: [SECURE VALUE SUPPLIED IN CONFIG]");
            logger.info("==================================================================");

            auditLogService.record("ADMIN_BOOTSTRAP", adminEmail, Role.SUPER_ADMIN.name(),
                    "ADMIN-001", "Platform initialized with bootstrap Super Admin", "127.0.0.1");
        }
    }

    private void seedStitchReferenceData() {
        logger.info("Seeding Stitch Academic Monolith reference data...");

        // 1. Demo Users
        User sarah = new User("Sarah Chen", "sarah.chen@univ.edu", passwordEncoder.encode("Password123!"),
                "CA-102", "Computer Science Dept", Role.CLUB_ADMIN, true, true);
        sarah = userRepository.save(sarah);

        User david = new User("David Park", "david.park@univ.edu", passwordEncoder.encode("Password123!"),
                "CA-103", "Political Science Dept", Role.CLUB_ADMIN, true, true);
        david = userRepository.save(david);

        User jordan = new User("Jordan Vance", "jordan.vance@univ.edu", passwordEncoder.encode("Password123!"),
                "STU-84920", "Computer Science Dept", Role.STUDENT, true, true);
        jordan = userRepository.save(jordan);

        User alex = new User("Alex Morgan", "alex.morgan@univ.edu", passwordEncoder.encode("Password123!"),
                "STU-91823", "CS Dept", Role.STUDENT, true, true);
        alex = userRepository.save(alex);

        User elena = new User("Elena Rostova", "elena.rostova@univ.edu", passwordEncoder.encode("Password123!"),
                "STU-88310", "Math Dept", Role.STUDENT, true, true);
        elena = userRepository.save(elena);

        User michael = new User("Michael Torres", "michael.torres@univ.edu", passwordEncoder.encode("Password123!"),
                "STU-44012", "Engineering Dept", Role.STUDENT, true, true);
        michael = userRepository.save(michael);

        // 2. Demo Clubs
        Club csSociety = new Club("ORG-0104", "Computer Science Society", "Academic",
                "Coding hackathons, peer tutoring, and tech talks.", "Meets Wednesdays",
                "Main Quad Tech Hub & Lab B", "Dr. R. Miller", true, sarah);
        csSociety = clubRepository.save(csSociety);

        Club debateUnion = new Club("ORG-0082", "Debate & Forensics Union", "Humanities",
                "Weekly parliamentary debates and intercollegiate tournaments.", "Meets Thursdays",
                "Student Union Aud. B", "Prof. H. Collins", true, david);
        debateUnion = clubRepository.save(debateUnion);

        Club roboticsClub = new Club("ORG-0215", "Robotics & Automation Club", "Engineering",
                "Hands-on robotics kits, hardware projects, and annual battle-bot competition.", "Meets Fridays",
                "MakerSpace Lab 102", "Dr. K. Vance", true, null);
        roboticsClub = clubRepository.save(roboticsClub);

        Club solarCar = new Club("ORG-0319", "Solar Car Racing Team", "Engineering",
                "Design, fabricate, and test collegiate solar-powered vehicles.", "Meets Saturdays",
                "Automotive Bay 3", "Prof. T. Henderson", true, null);
        solarCar = clubRepository.save(solarCar);

        // 3. Demo Memberships
        membershipRepository.save(new ClubMembership(csSociety, jordan, MembershipStatus.APPROVED));
        membershipRepository.save(new ClubMembership(debateUnion, jordan, MembershipStatus.APPROVED));
        membershipRepository.save(new ClubMembership(roboticsClub, jordan, MembershipStatus.PENDING));

        membershipRepository.save(new ClubMembership(csSociety, alex, MembershipStatus.PENDING));
        membershipRepository.save(new ClubMembership(csSociety, elena, MembershipStatus.PENDING));

        // 4. Demo Events
        Event hackathon = new Event(csSociety, "Fall Campus Hackathon 2025",
                "24-hour building challenge open to all departments.", "Oct 24, 2025 • 09:00 AM",
                "Engineering Hall 302", 100, 88, true, false, "Open RSVP");
        hackathon = eventRepository.save(hackathon);

        Event systemsProg = new Event(csSociety, "Intro to Systems Programming",
                "Low-level memory management and systems architecture in Rust.", "Nov 05, 2025 • 02:00 PM",
                "Turing Hall 401", 50, 32, true, false, "Published");
        eventRepository.save(systemsProg);

        Event debateOpen = new Event(debateUnion, "Inter-Club Debate Open",
                "Exhibition debate on AI ethics in academia.", "Nov 02, 2025 • 05:30 PM",
                "Student Union Aud. B", 100, 15, true, false, "Seated");
        eventRepository.save(debateOpen);

        Event acmPrep = new Event(csSociety, "ACM Technical Interview Prep",
                "Algorithms practice and whiteboard problem solving session.", "Nov 12, 2025 • 4:00 PM",
                "Science Complex 104", 60, 42, true, false, "Confirmed");
        acmPrep = eventRepository.save(acmPrep);

        // Event registrations for Jordan
        registrationRepository.save(new EventRegistration(hackathon, jordan, RegistrationStatus.REGISTERED));
        registrationRepository.save(new EventRegistration(acmPrep, jordan, RegistrationStatus.REGISTERED));

        // 5. Demo Announcements
        announcementRepository.save(new Announcement(null, "Annual Club Budget Allocation Policy Update",
                "All recognized clubs must submit semester activity audits by Friday 5 PM. Late submissions may forfeit secondary grant allocations.",
                "Student Affairs", true));

        announcementRepository.save(new Announcement(csSociety, "Workshop venue change",
                "Due to lab maintenance, the Python profiling workshop is moved to Turing Hall 401.",
                "Sarah Chen", true));

        // 6. Default Landing CMS
        LandingCms cms = new LandingCms();
        cmsRepository.save(cms);

        // 7. Seed initial Audit Logs matching Stitch
        auditLogService.record("ROLE_MODIFIED", "admin@univ.edu", "SUPER_ADMIN",
                "STU-3091", "SuperAdmin admin@univ.edu changed role of STU-3091 to CLUB_ADMIN for Chess Club", "10.14.22.4");
        auditLogService.record("EVENT_PUBLISHED", "sarah.chen@univ.edu", "CLUB_ADMIN",
                "ORG-0104", "Club Admin Sarah Chen published event 'Fall Hackathon'", "10.14.22.8");

        logger.info("Demo data seeding completed successfully.");
    }
}
