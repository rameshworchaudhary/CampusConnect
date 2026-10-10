package com.campusconnect.dto;

public class PlatformStatsResponse {
    private long totalUsers;
    private long totalStudents;
    private long totalClubs;
    private long publishedEvents;
    private long totalRegistrations;
    private long pendingRequests;
    public PlatformStatsResponse() {}

    public long getTotalUsers() { return totalUsers; }
    public void setTotalUsers(long totalUsers) { this.totalUsers = totalUsers; }

    public long getTotalStudents() { return totalStudents; }
    public void setTotalStudents(long totalStudents) { this.totalStudents = totalStudents; }

    public long getTotalClubs() { return totalClubs; }
    public void setTotalClubs(long totalClubs) { this.totalClubs = totalClubs; }

    public long getPublishedEvents() { return publishedEvents; }
    public void setPublishedEvents(long publishedEvents) { this.publishedEvents = publishedEvents; }

    public long getTotalRegistrations() { return totalRegistrations; }
    public void setTotalRegistrations(long totalRegistrations) { this.totalRegistrations = totalRegistrations; }

    public long getPendingRequests() { return pendingRequests; }
    public void setPendingRequests(long pendingRequests) { this.pendingRequests = pendingRequests; }

}
