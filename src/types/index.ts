export type Role = 'STUDENT' | 'CLUB_ADMIN' | 'SUPER_ADMIN';

export interface User {
  id: string;
  fullName: string;
  email: string;
  studentId?: string;
  department?: string;
  role: Role;
  isActive: boolean;
  isVerified: boolean;
  assignedClubId?: string;
  assignedClubName?: string;
  avatarUrl?: string;
  avatarPath?: string;
}

export interface Club {
  id: string;
  refId: string;
  name: string;
  category: string;
  description: string;
  meetingSchedule?: string;
  meetingLocation?: string;
  facultyAdvisor?: string;
  contactEmail?: string;
  contactPhone?: string;
  logoUrl?: string | null;
  logoPath?: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  isPublished: boolean;
  assignedAdminId?: string;
  assignedAdminName?: string;
  memberCount: number;
  pendingRequestCount: number;
  userMembershipStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface Membership {
  id: string;
  clubId: string;
  clubName: string;
  userId: string;
  userName: string;
  userEmail: string;
  studentId: string;
  department: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  appliedAt: string;
  reviewedAt?: string;
}

export interface EventItem {
  id: string;
  clubId?: string;
  clubName?: string;
  title: string;
  description?: string;
  eventDate: string;
  location: string;
  eventLink?: string;
  posterUrl?: string | null;
  posterPath?: string;
  capacity: number;
  registeredCount: number;
  isPublished: boolean;
  isPlatformEvent: boolean;
  badgeLabel?: string;
  isUserRegistered?: boolean;
}

export interface AnnouncementItem {
  id: string;
  clubId?: string;
  clubName?: string;
  title: string;
  content: string;
  postedByName: string;
  isActive: boolean;
  isRead?: boolean;
  createdAt: string;
  imageUrl?: string;
  imagePath?: string;
}

export interface AuditLogItem {
  id: string;
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
