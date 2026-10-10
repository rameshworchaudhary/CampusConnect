package com.campusconnect.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_announcement_reads", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "announcement_id"})
})
public class UserAnnouncementRead {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "announcement_id")
    private Announcement announcement;

    @Column(nullable = false, updatable = false)
    private LocalDateTime readAt = LocalDateTime.now();

    public UserAnnouncementRead() {}

    public UserAnnouncementRead(User user, Announcement announcement) {
        this.user = user;
        this.announcement = announcement;
        this.readAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Announcement getAnnouncement() { return announcement; }
    public void setAnnouncement(Announcement announcement) { this.announcement = announcement; }

    public LocalDateTime getReadAt() { return readAt; }
    public void setReadAt(LocalDateTime readAt) { this.readAt = readAt; }
}
