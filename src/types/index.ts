export type Role = 'STUDENT' | 'CLUB_ADMIN' | 'SUPER_ADMIN';

export interface User {
  id: number;
  fullName: string;
  email: string;
  studentId?: string;
  department?: string;
  role: Role;
  isActive: boolean;
  isVerified: boolean;
  assignedClubId?: number;
  assignedClubName?: string;
}

export interface Club {
  id: number;
  refId: string;
  name: string;
  category: string;
  description: string;
  meetingSchedule?: string;
  meetingLocation?: string;
  facultyAdvisor?: string;
  isPublished: boolean;
  assignedAdminId?: number;
  assignedAdminName?: string;
  memberCount: number;
  pendingRequestCount: number;
  userMembershipStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface Membership {
  id: number;
  clubId: number;
  clubName: string;
  userId: number;
  userName: string;
  userEmail: string;
  studentId: string;
  department: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  appliedAt: string;
  reviewedAt?: string;
}

export interface EventItem {
  id: number;
  clubId?: number;
  clubName?: string;
  title: string;
  description?: string;
  eventDate: string;
  location: string;
  eventLink?: string;
  capacity: number;
  registeredCount: number;
  isPublished: boolean;
  isPlatformEvent: boolean;
  badgeLabel?: string;
  isUserRegistered?: boolean;
}

export interface AnnouncementItem {
  id: number;
  clubId?: number;
  clubName?: string;
  title: string;
  content: string;
  postedByName: string;
  isActive: boolean;
  isRead?: boolean;
  createdAt: string;
}

export interface LandingCms {
  id?: number;
  siteName: string;
  heroHeading: string;
  heroDescription: string;
  statClubsLabel: string;
  statClubsValue: string;
  statStudentsLabel: string;
  statStudentsValue: string;
  statEventsLabel: string;
  statEventsValue: string;
  exploreButtonText: string;
  viewEventsButtonText: string;
  noticeBannerTitle: string;
  noticeBannerText: string;
  aboutText: string;
  footerText: string;
  featuredClubIds?: string;
  upcomingEventIds?: string;
}

export interface AuditLogItem {
  id: number;
  actionType: string;
  actorEmail: string;
  actorRole: string;
  targetIdentifier?: string;
  details: string;
  ipAddress?: string;
  shaHash?: string;
  createdAt: string;
}

export interface PlatformStats {
  totalUsers: number;
  totalStudents: number;
  totalClubs: number;
  publishedEvents: number;
  totalRegistrations: number;
  pendingRequests: number;
}
