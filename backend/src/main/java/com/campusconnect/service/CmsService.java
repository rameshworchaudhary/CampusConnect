package com.campusconnect.service;

import com.campusconnect.dto.CmsDto;
import com.campusconnect.entity.LandingCms;
import com.campusconnect.repository.LandingCmsRepository;
import com.campusconnect.security.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CmsService {

    private final LandingCmsRepository cmsRepository;
    private final AuditLogService auditLogService;

    public CmsService(LandingCmsRepository cmsRepository, AuditLogService auditLogService) {
        this.cmsRepository = cmsRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public CmsDto getCmsContent() {
        LandingCms cms = cmsRepository.findTopByOrderByIdAsc()
                .orElseGet(this::createDefaultCms);
        return mapToDto(cms);
    }

    @Transactional
    public CmsDto updateCmsContent(CmsDto dto, UserPrincipal admin, String ipAddress) {
        LandingCms cms = cmsRepository.findTopByOrderByIdAsc()
                .orElseGet(this::createDefaultCms);

        if (dto.getSiteName() != null) cms.setSiteName(dto.getSiteName().trim());
        if (dto.getHeroTag() != null) cms.setHeroTag(dto.getHeroTag().trim());
        if (dto.getHeroHeading() != null) cms.setHeroHeading(dto.getHeroHeading().trim());
        if (dto.getHeroDescription() != null) cms.setHeroDescription(dto.getHeroDescription().trim());
        if (dto.getStatClubsLabel() != null) cms.setStatClubsLabel(dto.getStatClubsLabel().trim());
        if (dto.getStatClubsValue() != null) cms.setStatClubsValue(dto.getStatClubsValue().trim());
        if (dto.getStatStudentsLabel() != null) cms.setStatStudentsLabel(dto.getStatStudentsLabel().trim());
        if (dto.getStatStudentsValue() != null) cms.setStatStudentsValue(dto.getStatStudentsValue().trim());
        if (dto.getStatEventsLabel() != null) cms.setStatEventsLabel(dto.getStatEventsLabel().trim());
        if (dto.getStatEventsValue() != null) cms.setStatEventsValue(dto.getStatEventsValue().trim());
        if (dto.getExploreButtonText() != null) cms.setExploreButtonText(dto.getExploreButtonText().trim());
        if (dto.getViewEventsButtonText() != null) cms.setViewEventsButtonText(dto.getViewEventsButtonText().trim());
        if (dto.getNoticeBannerTitle() != null) cms.setNoticeBannerTitle(dto.getNoticeBannerTitle().trim());
        if (dto.getNoticeBannerText() != null) cms.setNoticeBannerText(dto.getNoticeBannerText().trim());
        if (dto.getAboutText() != null) cms.setAboutText(dto.getAboutText().trim());
        if (dto.getFooterText() != null) cms.setFooterText(dto.getFooterText().trim());
        if (dto.getFeaturedClubIds() != null) cms.setFeaturedClubIds(dto.getFeaturedClubIds().trim());
        if (dto.getUpcomingEventIds() != null) cms.setUpcomingEventIds(dto.getUpcomingEventIds().trim());

        cms = cmsRepository.save(cms);

        auditLogService.record("CMS_UPDATED", admin.getUsername(), admin.getRole().name(),
                "LANDING_PAGE", "Updated public landing page CMS content", ipAddress);

        return mapToDto(cms);
    }

    private LandingCms createDefaultCms() {
        LandingCms cms = new LandingCms();
        return cmsRepository.save(cms);
    }

    private CmsDto mapToDto(LandingCms c) {
        CmsDto dto = new CmsDto();
        dto.setId(c.getId());
        dto.setSiteName(c.getSiteName());
        dto.setHeroTag(c.getHeroTag());
        dto.setHeroHeading(c.getHeroHeading());
        dto.setHeroDescription(c.getHeroDescription());
        dto.setStatClubsLabel(c.getStatClubsLabel());
        dto.setStatClubsValue(c.getStatClubsValue());
        dto.setStatStudentsLabel(c.getStatStudentsLabel());
        dto.setStatStudentsValue(c.getStatStudentsValue());
        dto.setStatEventsLabel(c.getStatEventsLabel());
        dto.setStatEventsValue(c.getStatEventsValue());
        dto.setExploreButtonText(c.getExploreButtonText());
        dto.setViewEventsButtonText(c.getViewEventsButtonText());
        dto.setNoticeBannerTitle(c.getNoticeBannerTitle());
        dto.setNoticeBannerText(c.getNoticeBannerText());
        dto.setAboutText(c.getAboutText());
        dto.setFooterText(c.getFooterText());
        dto.setFeaturedClubIds(c.getFeaturedClubIds());
        dto.setUpcomingEventIds(c.getUpcomingEventIds());
        dto.setUpdatedAt(c.getUpdatedAt());
        return dto;
    }
}
