package com.campusconnect.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "landing_cms")
public class LandingCms {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String siteName = "CampusConnect";

    @Column(length = 100)
    private String heroTag;

    @Column(nullable = false, length = 255)
    private String heroHeading = "One place for campus life.";

    @Column(columnDefinition = "TEXT")
    private String heroDescription = "CampusConnect helps students discover clubs, join communities, and register for campus events while giving campus teams one reliable place to manage activities.";

    @Column(length = 50)
    private String statClubsLabel;

    @Column(length = 50)
    private String statClubsValue;

    @Column(length = 50)
    private String statStudentsLabel;

    @Column(length = 50)
    private String statStudentsValue;

    @Column(length = 50)
    private String statEventsLabel;

    @Column(length = 50)
    private String statEventsValue;

    @Column(length = 100)
    private String exploreButtonText = "Explore Clubs";

    @Column(length = 100)
    private String viewEventsButtonText = "Browse Events";

    @Column(length = 255)
    private String noticeBannerTitle;

    @Column(columnDefinition = "TEXT")
    private String noticeBannerText;

    @Column(columnDefinition = "TEXT")
    private String aboutText = "CampusConnect connects students, club administrators, and campus leadership through one role-based platform for clubs, events, memberships, and announcements.";

    @Column(columnDefinition = "TEXT")
    private String footerText = "CampusConnect — a central hub for discovering and managing campus communities.";

    @Column(length = 255)
    private String featuredClubIds = "";

    @Column(length = 255)
    private String upcomingEventIds = "";

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public LandingCms() {}

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSiteName() { return siteName; }
    public void setSiteName(String siteName) { this.siteName = siteName; }

    public String getHeroTag() { return heroTag; }
    public void setHeroTag(String heroTag) { this.heroTag = heroTag; }

    public String getHeroHeading() { return heroHeading; }
    public void setHeroHeading(String heroHeading) { this.heroHeading = heroHeading; }

    public String getHeroDescription() { return heroDescription; }
    public void setHeroDescription(String heroDescription) { this.heroDescription = heroDescription; }

    public String getStatClubsLabel() { return statClubsLabel; }
    public void setStatClubsLabel(String statClubsLabel) { this.statClubsLabel = statClubsLabel; }

    public String getStatClubsValue() { return statClubsValue; }
    public void setStatClubsValue(String statClubsValue) { this.statClubsValue = statClubsValue; }

    public String getStatStudentsLabel() { return statStudentsLabel; }
    public void setStatStudentsLabel(String statStudentsLabel) { this.statStudentsLabel = statStudentsLabel; }

    public String getStatStudentsValue() { return statStudentsValue; }
    public void setStatStudentsValue(String statStudentsValue) { this.statStudentsValue = statStudentsValue; }

    public String getStatEventsLabel() { return statEventsLabel; }
    public void setStatEventsLabel(String statEventsLabel) { this.statEventsLabel = statEventsLabel; }

    public String getStatEventsValue() { return statEventsValue; }
    public void setStatEventsValue(String statEventsValue) { this.statEventsValue = statEventsValue; }

    public String getExploreButtonText() { return exploreButtonText; }
    public void setExploreButtonText(String exploreButtonText) { this.exploreButtonText = exploreButtonText; }

    public String getViewEventsButtonText() { return viewEventsButtonText; }
    public void setViewEventsButtonText(String viewEventsButtonText) { this.viewEventsButtonText = viewEventsButtonText; }

    public String getNoticeBannerTitle() { return noticeBannerTitle; }
    public void setNoticeBannerTitle(String noticeBannerTitle) { this.noticeBannerTitle = noticeBannerTitle; }

    public String getNoticeBannerText() { return noticeBannerText; }
    public void setNoticeBannerText(String noticeBannerText) { this.noticeBannerText = noticeBannerText; }

    public String getAboutText() { return aboutText; }
    public void setAboutText(String aboutText) { this.aboutText = aboutText; }

    public String getFooterText() { return footerText; }
    public void setFooterText(String footerText) { this.footerText = footerText; }

    public String getFeaturedClubIds() { return featuredClubIds; }
    public void setFeaturedClubIds(String featuredClubIds) { this.featuredClubIds = featuredClubIds; }

    public String getUpcomingEventIds() { return upcomingEventIds; }
    public void setUpcomingEventIds(String upcomingEventIds) { this.upcomingEventIds = upcomingEventIds; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
