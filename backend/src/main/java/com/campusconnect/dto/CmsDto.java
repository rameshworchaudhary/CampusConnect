package com.campusconnect.dto;

import java.time.LocalDateTime;

public class CmsDto {
    private Long id;
    private String siteName;
    private String heroTag;
    private String heroHeading;
    private String heroDescription;
    private String statClubsLabel;
    private String statClubsValue;
    private String statStudentsLabel;
    private String statStudentsValue;
    private String statEventsLabel;
    private String statEventsValue;
    private String exploreButtonText;
    private String viewEventsButtonText;
    private String noticeBannerTitle;
    private String noticeBannerText;
    private String aboutText;
    private String footerText;
    private String featuredClubIds;
    private String upcomingEventIds;
    private LocalDateTime updatedAt;

    public CmsDto() {}

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
