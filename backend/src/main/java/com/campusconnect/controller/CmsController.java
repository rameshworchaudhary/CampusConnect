package com.campusconnect.controller;

import com.campusconnect.dto.ApiResponse;
import com.campusconnect.dto.CmsDto;
import com.campusconnect.security.UserPrincipal;
import com.campusconnect.service.CmsService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class CmsController {

    private final CmsService cmsService;

    public CmsController(CmsService cmsService) {
        this.cmsService = cmsService;
    }

    @GetMapping("/cms/public")
    public ResponseEntity<ApiResponse<CmsDto>> getPublicCms() {
        CmsDto dto = cmsService.getCmsContent();
        return ResponseEntity.ok(ApiResponse.success("Landing CMS content retrieved", dto));
    }

    @PutMapping("/admin/cms")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<CmsDto>> updateCms(
            @RequestBody CmsDto request,
            @AuthenticationPrincipal UserPrincipal admin,
            HttpServletRequest httpRequest) {
        String ip = httpRequest.getRemoteAddr();
        CmsDto updated = cmsService.updateCmsContent(request, admin, ip);
        return ResponseEntity.ok(ApiResponse.success("Landing page CMS updated successfully", updated));
    }
}
