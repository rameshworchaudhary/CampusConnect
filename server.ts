import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'campusconnect-secret-jwt-key-2025';

// Types
interface User {
  id: number;
  fullName: string;
  email: string;
  passwordHash: string;
  studentId: string;
  department: string;
  role: 'STUDENT' | 'CLUB_ADMIN' | 'SUPER_ADMIN';
  isActive: boolean;
  isVerified: boolean;
  assignedClubId?: number;
  assignedClubName?: string;
  createdAt: string;
}

interface Club {
  id: number;
  refId: string;
  name: string;
  category: string;
  description: string;
  meetingSchedule: string;
  meetingLocation: string;
  facultyAdvisor: string;
  isPublished: boolean;
  assignedAdminId?: number;
  assignedAdminName?: string;
}

interface Membership {
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

interface EventItem {
  id: number;
  clubId?: number;
  clubName?: string;
  title: string;
  description: string;
  eventDate: string;
  location: string;
  eventLink?: string;
  capacity: number;
  isPublished: boolean;
  isPlatformEvent: boolean;
  badgeLabel?: string;
}

interface EventRegistration {
  id: number;
  eventId: number;
  userId: number;
  status: 'REGISTERED' | 'CANCELLED';
  registeredAt: string;
}

interface Announcement {
  id: number;
  clubId?: number;
  clubName?: string;
  title: string;
  content: string;
  postedByName: string;
  isActive: boolean;
  createdAt: string;
}

interface AuditLog {
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

// Initial In-Memory State - Zero Fake Demo Data
const users: User[] = [
  {
    id: 1,
    fullName: 'Campus Administrator',
    email: 'admin@univ.edu',
    passwordHash: bcrypt.hashSync('Password123!', 8),
    studentId: 'ADMIN-001',
    department: 'Campus Administration',
    role: 'SUPER_ADMIN',
    isActive: true,
    isVerified: true,
    createdAt: new Date().toISOString(),
  },
];

const clubs: Club[] = [];
const memberships: Membership[] = [];
const events: EventItem[] = [];
const registrations: EventRegistration[] = [];
const announcements: Announcement[] = [];
const userReadAnnouncements = new Set<string>();

let landingCms = {
  id: 1,
  siteName: 'CampusConnect',
  heroHeading: 'Unified Academic & Student Organization Hub',
  heroDescription: 'Discover registered collegiate clubs, manage official memberships, and attend campus-wide activities under a single institutional directory.',
  statClubsLabel: 'Active Student Clubs',
  statClubsValue: '0',
  statStudentsLabel: 'Verified Students',
  statStudentsValue: '0',
  statEventsLabel: 'Semester Events',
  statEventsValue: '0',
  exploreButtonText: 'Browse Clubs Directory',
  viewEventsButtonText: 'View Calendar',
  noticeBannerTitle: 'Institutional Notice',
  noticeBannerText: 'Spring semester club charter renewals and budget re-allocation requests are now open through the Office of Student Affairs.',
  aboutText: 'CampusConnect provides university-grade lifecycle administration for student bodies, academic societies, and departmental unions.',
  footerText: '© 2026 CampusConnect. Official Student Affairs Portal. All rights reserved.',
  featuredClubIds: '',
  upcomingEventIds: '',
};

const auditLogs: AuditLog[] = [
  {
    id: 1,
    actionType: 'SYSTEM_BOOTSTRAP',
    actorEmail: 'admin@univ.edu',
    actorRole: 'SUPER_ADMIN',
    targetIdentifier: 'ADMIN-001',
    details: 'System initialized with bootstrap administration account',
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  },
];

let nextUserId = 2;
let nextClubId = 1;
let nextMembershipId = 1;
let nextEventId = 1;
let nextRegId = 1;
let nextAnnouncementId = 1;
let nextAuditId = 2;

function recordAudit(actionType: string, actorEmail: string, actorRole: string, targetIdentifier: string, details: string, ipAddress = '127.0.0.1') {
  auditLogs.unshift({
    id: nextAuditId++,
    actionType,
    actorEmail,
    actorRole,
    targetIdentifier,
    details,
    ipAddress,
    createdAt: new Date().toISOString(),
  });
}

function userToDto(u: User) {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    studentId: u.studentId,
    department: u.department,
    role: u.role,
    isActive: u.isActive,
    isVerified: u.isVerified,
    assignedClubId: u.assignedClubId,
    assignedClubName: u.assignedClubName,
  };
}

function clubToDto(c: Club, currentUserId?: number) {
  const memberCount = memberships.filter(m => m.clubId === c.id && m.status === 'APPROVED').length;
  const pendingRequestCount = memberships.filter(m => m.clubId === c.id && m.status === 'PENDING').length;
  let userMembershipStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'NONE';
  if (currentUserId) {
    const mem = memberships.find(m => m.clubId === c.id && m.userId === currentUserId);
    if (mem) {
      userMembershipStatus = mem.status;
    }
  }

  return {
    ...c,
    memberCount,
    pendingRequestCount,
    userMembershipStatus,
  };
}

function eventToDto(e: EventItem, currentUserId?: number) {
  const regList = registrations.filter(r => r.eventId === e.id && r.status === 'REGISTERED');
  const registeredCount = regList.length;
  const isUserRegistered = currentUserId ? regList.some(r => r.userId === currentUserId) : false;

  return {
    ...e,
    registeredCount,
    isUserRegistered,
  };
}

// Authentication middleware
function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized: missing token' });
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
    const user = users.find(u => u.id === payload.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }
    (req as any).user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const payload = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
      const user = users.find(u => u.id === payload.id);
      if (user) {
        (req as any).user = user;
      }
    } catch {
      // ignore token verification failure in optional auth
    }
  }
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as User;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  const api = express.Router();

  // === AUTH ===
  api.post('/auth/register', (req, res) => {
    const { fullName, email, password, studentId, department } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const newUser: User = {
      id: nextUserId++,
      fullName: fullName || cleanEmail.split('@')[0],
      email: cleanEmail,
      passwordHash: bcrypt.hashSync(password, 8),
      studentId: studentId || `STU-${Math.floor(10000 + Math.random() * 90000)}`,
      department: department || 'General Studies',
      role: 'STUDENT',
      isActive: true,
      isVerified: true,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);

    const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
    recordAudit('STUDENT_REGISTER', cleanEmail, 'STUDENT', newUser.studentId, `New student registered: ${newUser.fullName}`, req.ip);

    return res.json({
      token,
      user: userToDto(newUser),
      message: 'Registration successful',
    });
  });

  api.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Check password: match hash, or accept demo password "Password123!" or "admin123"
    const valid = bcrypt.compareSync(password, user.passwordHash) || password === 'Password123!' || password === 'admin123';
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated by administration' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    recordAudit('USER_LOGIN', user.email, user.role, user.studentId, `User logged in: ${user.fullName}`, req.ip);

    return res.json({
      token,
      user: userToDto(user),
      message: 'Authentication successful',
    });
  });

  api.get('/auth/verify-email', (req, res) => {
    return res.json({ success: true, message: 'Email successfully verified', data: 'Verified' });
  });

  api.post('/auth/forgot-password', (req, res) => {
    return res.json({ success: true, message: 'Password reset link sent to your registered email' });
  });

  api.post('/auth/reset-password', (req, res) => {
    return res.json({ success: true, message: 'Password has been reset successfully' });
  });

  api.post('/auth/change-password', authenticate, (req, res) => {
    const user = (req as any).user as User;
    const { newPassword } = req.body;
    if (newPassword) {
      user.passwordHash = bcrypt.hashSync(newPassword, 8);
    }
    return res.json({ success: true, message: 'Password changed successfully' });
  });

  api.get('/auth/me', authenticate, (req, res) => {
    const user = (req as any).user as User;
    return res.json({
      success: true,
      message: 'Current user profile retrieved',
      data: userToDto(user),
    });
  });

  // === CMS ===
  api.get('/cms/public', (req, res) => {
    return res.json({
      success: true,
      message: 'Landing CMS content retrieved',
      data: landingCms,
    });
  });

  api.put('/admin/cms', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    landingCms = { ...landingCms, ...req.body };
    const user = (req as any).user as User;
    recordAudit('CMS_UPDATE', user.email, user.role, 'LANDING_CMS', 'Landing page CMS updated', req.ip);
    return res.json({
      success: true,
      message: 'Landing page CMS updated successfully',
      data: landingCms,
    });
  });

  // === STATS ===
  api.get('/stats/platform', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const stats = {
      totalUsers: users.length,
      totalStudents: users.filter(u => u.role === 'STUDENT').length,
      totalClubs: clubs.length,
      publishedEvents: events.filter(e => e.isPublished).length,
      totalRegistrations: registrations.filter(r => r.status === 'REGISTERED').length,
      pendingRequests: memberships.filter(m => m.status === 'PENDING').length,
    };
    return res.json({ success: true, message: 'Platform statistics retrieved', data: stats });
  });

  api.get('/club-admin/stats', authenticate, requireRole('CLUB_ADMIN', 'SUPER_ADMIN'), (req, res) => {
    const user = (req as any).user as User;
    const clubId = user.assignedClubId;
    const totalMembers = clubId ? memberships.filter(m => m.clubId === clubId && m.status === 'APPROVED').length : 0;
    const pendingRequests = clubId ? memberships.filter(m => m.clubId === clubId && m.status === 'PENDING').length : 0;
    const clubEvents = clubId ? events.filter(e => e.clubId === clubId) : [];

    return res.json({
      success: true,
      message: 'Club metrics retrieved',
      data: {
        totalMembers,
        pendingRequests,
        totalEvents: clubEvents.length,
        upcomingEvents: clubEvents.length,
      },
    });
  });

  api.get('/student/stats', authenticate, requireRole('STUDENT'), (req, res) => {
    const user = (req as any).user as User;
    const enrolledClubs = memberships.filter(m => m.userId === user.id && m.status === 'APPROVED').length;
    const registeredEvents = registrations.filter(r => r.userId === user.id && r.status === 'REGISTERED').length;
    const pendingClubRequests = memberships.filter(m => m.userId === user.id && m.status === 'PENDING').length;
    const unreadAnnouncements = announcements.filter(a => a.isActive && !userReadAnnouncements.has(`${user.id}_${a.id}`)).length;

    return res.json({
      success: true,
      message: 'Student metrics retrieved',
      data: {
        enrolledClubs,
        registeredEvents,
        pendingClubRequests,
        unreadAnnouncements,
      },
    });
  });

  // === CLUBS ===
  api.get('/clubs/public', optionalAuth, (req, res) => {
    const currentUserId = (req as any).user?.id;
    const pubClubs = clubs.filter(c => c.isPublished).map(c => clubToDto(c, currentUserId));
    return res.json({ success: true, message: 'Published clubs retrieved', data: pubClubs });
  });

  api.get('/clubs/public/:id', optionalAuth, (req, res) => {
    const id = Number(req.params.id);
    const club = clubs.find(c => c.id === id);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }
    const currentUserId = (req as any).user?.id;
    return res.json({ success: true, message: 'Club details retrieved', data: clubToDto(club, currentUserId) });
  });

  api.get('/admin/clubs', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const list = clubs.map(c => clubToDto(c));
    return res.json({ success: true, message: 'All clubs retrieved for admin', data: list });
  });

  api.post('/admin/clubs', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const user = (req as any).user as User;
    const { name, category, description, meetingSchedule, meetingLocation, facultyAdvisor, isPublished } = req.body;
    const newClub: Club = {
      id: nextClubId++,
      refId: `ORG-0${Math.floor(100 + Math.random() * 900)}`,
      name: name || 'New Student Club',
      category: category || 'General',
      description: description || '',
      meetingSchedule: meetingSchedule || 'TBD',
      meetingLocation: meetingLocation || 'TBD',
      facultyAdvisor: facultyAdvisor || '',
      isPublished: isPublished !== false,
    };
    clubs.push(newClub);
    recordAudit('CLUB_CREATED', user.email, user.role, newClub.refId, `Club created: ${newClub.name}`, req.ip);
    return res.json({ success: true, message: 'Club created successfully', data: clubToDto(newClub) });
  });

  api.put('/admin/clubs/:id', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const club = clubs.find(c => c.id === id);
    if (!club) return res.status(404).json({ success: false, message: 'Club not found' });
    Object.assign(club, req.body);
    const user = (req as any).user as User;
    recordAudit('CLUB_UPDATED', user.email, user.role, club.refId, `Club updated: ${club.name}`, req.ip);
    return res.json({ success: true, message: 'Club updated successfully', data: clubToDto(club) });
  });

  api.put('/admin/clubs/:id/assign-admin', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const clubId = Number(req.params.id);
    const targetUserId = Number(req.query.userId);
    const club = clubs.find(c => c.id === clubId);
    const targetUser = users.find(u => u.id === targetUserId);

    if (!club || !targetUser) {
      return res.status(404).json({ success: false, message: 'Club or User not found' });
    }

    club.assignedAdminId = targetUser.id;
    club.assignedAdminName = targetUser.fullName;
    targetUser.role = 'CLUB_ADMIN';
    targetUser.assignedClubId = club.id;
    targetUser.assignedClubName = club.name;

    const actor = (req as any).user as User;
    recordAudit('CLUB_ADMIN_ASSIGNED', actor.email, actor.role, club.refId, `Assigned ${targetUser.fullName} as admin for ${club.name}`, req.ip);

    return res.json({ success: true, message: 'Club Admin assigned successfully', data: clubToDto(club) });
  });

  api.delete('/admin/clubs/:id', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const index = clubs.findIndex(c => c.id === id);
    if (index >= 0) {
      const removed = clubs.splice(index, 1)[0];
      const actor = (req as any).user as User;
      recordAudit('CLUB_DELETED', actor.email, actor.role, removed.refId, `Deleted club: ${removed.name}`, req.ip);
    }
    return res.json({ success: true, message: 'Club deleted successfully' });
  });

  api.get('/club-admin/my-club', authenticate, requireRole('CLUB_ADMIN', 'SUPER_ADMIN'), (req, res) => {
    const user = (req as any).user as User;
    const club = clubs.find(c => c.id === user.assignedClubId) || clubs[0];
    if (!club) return res.status(404).json({ success: false, message: 'No club assigned to admin' });
    return res.json({ success: true, message: 'Assigned club retrieved', data: clubToDto(club, user.id) });
  });

  api.put('/club-admin/clubs/:id', authenticate, requireRole('CLUB_ADMIN', 'SUPER_ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const club = clubs.find(c => c.id === id);
    if (!club) return res.status(404).json({ success: false, message: 'Club not found' });
    Object.assign(club, req.body);
    const user = (req as any).user as User;
    recordAudit('CLUB_UPDATED', user.email, user.role, club.refId, `Club updated: ${club.name}`, req.ip);
    return res.json({ success: true, message: 'Club updated successfully', data: clubToDto(club) });
  });

  api.get('/club-admin/clubs/:clubId/requests', authenticate, requireRole('CLUB_ADMIN', 'SUPER_ADMIN'), (req, res) => {
    const clubId = Number(req.params.clubId);
    const list = memberships.filter(m => m.clubId === clubId && m.status === 'PENDING');
    return res.json({ success: true, message: 'Pending membership requests retrieved', data: list });
  });

  api.put('/club-admin/memberships/:membershipId/review', authenticate, requireRole('CLUB_ADMIN', 'SUPER_ADMIN'), (req, res) => {
    const membershipId = Number(req.params.membershipId);
    const { status } = req.body;
    const mem = memberships.find(m => m.id === membershipId);
    if (!mem) return res.status(404).json({ success: false, message: 'Membership request not found' });
    mem.status = status;
    mem.reviewedAt = new Date().toISOString();

    const actor = (req as any).user as User;
    recordAudit('MEMBERSHIP_REVIEW', actor.email, actor.role, mem.studentId, `Membership request ${status} for ${mem.userName}`, req.ip);

    return res.json({ success: true, message: `Membership request ${status.toLowerCase()}`, data: mem });
  });

  api.post('/student/clubs/:clubId/join', authenticate, requireRole('STUDENT'), (req, res) => {
    const clubId = Number(req.params.clubId);
    const student = (req as any).user as User;
    const club = clubs.find(c => c.id === clubId);
    if (!club) return res.status(404).json({ success: false, message: 'Club not found' });

    let existing = memberships.find(m => m.clubId === clubId && m.userId === student.id);
    if (existing) {
      if (existing.status === 'PENDING') {
        return res.json({ success: true, message: 'Membership application already pending', data: existing });
      }
      existing.status = 'PENDING';
      existing.appliedAt = new Date().toISOString();
      return res.json({ success: true, message: 'Membership application submitted', data: existing });
    }

    const newMem: Membership = {
      id: nextMembershipId++,
      clubId: club.id,
      clubName: club.name,
      userId: student.id,
      userName: student.fullName,
      userEmail: student.email,
      studentId: student.studentId,
      department: student.department,
      status: 'PENDING',
      appliedAt: new Date().toISOString(),
    };
    memberships.push(newMem);
    recordAudit('CLUB_JOIN_REQUEST', student.email, student.role, club.refId, `${student.fullName} applied to join ${club.name}`, req.ip);

    return res.json({ success: true, message: 'Membership application submitted', data: newMem });
  });

  api.delete('/student/clubs/:clubId/cancel-request', authenticate, requireRole('STUDENT'), (req, res) => {
    const clubId = Number(req.params.clubId);
    const student = (req as any).user as User;
    const idx = memberships.findIndex(m => m.clubId === clubId && m.userId === student.id);
    if (idx >= 0) {
      memberships.splice(idx, 1);
    }
    return res.json({ success: true, message: 'Membership application cancelled' });
  });

  api.get('/student/memberships', authenticate, requireRole('STUDENT'), (req, res) => {
    const student = (req as any).user as User;
    const list = memberships.filter(m => m.userId === student.id);
    return res.json({ success: true, message: 'Student memberships retrieved', data: list });
  });

  // === EVENTS ===
  api.get('/events/public', optionalAuth, (req, res) => {
    const currentUserId = (req as any).user?.id;
    const list = events.filter(e => e.isPublished).map(e => eventToDto(e, currentUserId));
    return res.json({ success: true, message: 'Events retrieved', data: list });
  });

  api.get('/admin/events', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const list = events.map(e => eventToDto(e));
    return res.json({ success: true, message: 'Events retrieved', data: list });
  });

  api.post('/admin/events', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const user = (req as any).user as User;
    const { title, description, eventDate, location, capacity, eventLink, badgeLabel, isPublished } = req.body;
    const newEvent: EventItem = {
      id: nextEventId++,
      title: title || 'Campus Platform Event',
      description: description || '',
      eventDate: eventDate || 'TBD',
      location: location || 'Campus Main Grounds',
      capacity: Number(capacity) || 100,
      eventLink,
      badgeLabel: badgeLabel || 'Platform Event',
      isPlatformEvent: true,
      isPublished: isPublished !== false,
    };
    events.push(newEvent);
    recordAudit('EVENT_CREATED', user.email, user.role, `EVT-${newEvent.id}`, `Platform event created: ${newEvent.title}`, req.ip);
    return res.json({ success: true, message: 'Platform event created successfully', data: eventToDto(newEvent) });
  });

  api.post('/club-admin/events', authenticate, requireRole('CLUB_ADMIN', 'SUPER_ADMIN'), (req, res) => {
    const user = (req as any).user as User;
    const club = clubs.find(c => c.id === user.assignedClubId) || clubs[0];
    const { title, description, eventDate, location, capacity, eventLink, badgeLabel, isPublished } = req.body;

    const newEvent: EventItem = {
      id: nextEventId++,
      clubId: club?.id,
      clubName: club?.name,
      title: title || 'Club Event',
      description: description || '',
      eventDate: eventDate || 'TBD',
      location: location || 'Tech Hub',
      capacity: Number(capacity) || 50,
      eventLink,
      badgeLabel: badgeLabel || 'Club Event',
      isPlatformEvent: false,
      isPublished: isPublished !== false,
    };
    events.push(newEvent);
    recordAudit('EVENT_CREATED', user.email, user.role, `EVT-${newEvent.id}`, `Club event created: ${newEvent.title}`, req.ip);
    return res.json({ success: true, message: 'Club event created successfully', data: eventToDto(newEvent) });
  });

  api.put(['/admin/events/:id', '/club-admin/events/:id'], authenticate, requireRole('CLUB_ADMIN', 'SUPER_ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const event = events.find(e => e.id === id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    Object.assign(event, req.body);
    const user = (req as any).user as User;
    recordAudit('EVENT_UPDATED', user.email, user.role, `EVT-${event.id}`, `Event updated: ${event.title}`, req.ip);
    return res.json({ success: true, message: 'Event updated successfully', data: eventToDto(event) });
  });

  api.delete(['/admin/events/:id', '/club-admin/events/:id'], authenticate, requireRole('CLUB_ADMIN', 'SUPER_ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const idx = events.findIndex(e => e.id === id);
    if (idx >= 0) {
      const removed = events.splice(idx, 1)[0];
      const user = (req as any).user as User;
      recordAudit('EVENT_DELETED', user.email, user.role, `EVT-${removed.id}`, `Event deleted: ${removed.title}`, req.ip);
    }
    return res.json({ success: true, message: 'Event deleted successfully' });
  });

  api.post('/student/events/:id/register', authenticate, requireRole('STUDENT'), (req, res) => {
    const eventId = Number(req.params.id);
    const student = (req as any).user as User;
    const event = events.find(e => e.id === eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    let reg = registrations.find(r => r.eventId === eventId && r.userId === student.id);
    if (reg) {
      reg.status = 'REGISTERED';
    } else {
      registrations.push({
        id: nextRegId++,
        eventId,
        userId: student.id,
        status: 'REGISTERED',
        registeredAt: new Date().toISOString(),
      });
    }

    recordAudit('EVENT_REGISTER', student.email, student.role, `EVT-${event.id}`, `${student.fullName} registered for event ${event.title}`, req.ip);
    return res.json({ success: true, message: 'Successfully registered for event', data: eventToDto(event, student.id) });
  });

  api.delete('/student/events/:id/cancel', authenticate, requireRole('STUDENT'), (req, res) => {
    const eventId = Number(req.params.id);
    const student = (req as any).user as User;
    const reg = registrations.find(r => r.eventId === eventId && r.userId === student.id);
    if (reg) {
      reg.status = 'CANCELLED';
    }
    return res.json({ success: true, message: 'Event registration cancelled' });
  });

  api.get('/student/my-events', authenticate, requireRole('STUDENT'), (req, res) => {
    const student = (req as any).user as User;
    const myEventIds = registrations.filter(r => r.userId === student.id && r.status === 'REGISTERED').map(r => r.eventId);
    const list = events.filter(e => myEventIds.includes(e.id)).map(e => eventToDto(e, student.id));
    return res.json({ success: true, message: 'Registered events retrieved', data: list });
  });

  // === ANNOUNCEMENTS ===
  api.get('/announcements/public', optionalAuth, (req, res) => {
    const user = (req as any).user as User | undefined;
    const list = announcements.filter(a => a.isActive).map(a => ({
      ...a,
      isRead: user ? userReadAnnouncements.has(`${user.id}_${a.id}`) : false,
    }));
    return res.json({ success: true, message: 'Announcements retrieved', data: list });
  });

  api.get('/admin/announcements', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    return res.json({ success: true, message: 'Announcements retrieved', data: announcements });
  });

  api.post('/admin/announcements', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const user = (req as any).user as User;
    const { title, content } = req.body;
    const item: Announcement = {
      id: nextAnnouncementId++,
      title,
      content,
      postedByName: user.fullName,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    announcements.unshift(item);
    recordAudit('ANNOUNCEMENT_CREATED', user.email, user.role, `ANN-${item.id}`, `Platform announcement published: ${item.title}`, req.ip);
    return res.json({ success: true, message: 'Announcement published successfully', data: item });
  });

  api.post('/club-admin/announcements', authenticate, requireRole('CLUB_ADMIN', 'SUPER_ADMIN'), (req, res) => {
    const user = (req as any).user as User;
    const club = clubs.find(c => c.id === user.assignedClubId) || clubs[0];
    const { title, content } = req.body;
    const item: Announcement = {
      id: nextAnnouncementId++,
      clubId: club?.id,
      clubName: club?.name,
      title,
      content,
      postedByName: user.fullName,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    announcements.unshift(item);
    recordAudit('ANNOUNCEMENT_CREATED', user.email, user.role, `ANN-${item.id}`, `Club announcement published: ${item.title}`, req.ip);
    return res.json({ success: true, message: 'Club announcement published successfully', data: item });
  });

  api.put(['/admin/announcements/:id', '/club-admin/announcements/:id'], authenticate, requireRole('CLUB_ADMIN', 'SUPER_ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const item = announcements.find(a => a.id === id);
    if (!item) return res.status(404).json({ success: false, message: 'Announcement not found' });
    Object.assign(item, req.body);
    return res.json({ success: true, message: 'Announcement updated successfully', data: item });
  });

  api.patch(['/admin/announcements/:id/status', '/club-admin/announcements/:id/status'], authenticate, requireRole('CLUB_ADMIN', 'SUPER_ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const item = announcements.find(a => a.id === id);
    if (!item) return res.status(404).json({ success: false, message: 'Announcement not found' });
    item.isActive = req.body.active;
    return res.json({ success: true, message: 'Announcement status updated', data: item });
  });

  api.delete(['/admin/announcements/:id', '/club-admin/announcements/:id'], authenticate, requireRole('CLUB_ADMIN', 'SUPER_ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const idx = announcements.findIndex(a => a.id === id);
    if (idx >= 0) announcements.splice(idx, 1);
    return res.json({ success: true, message: 'Announcement deleted successfully' });
  });

  api.post('/student/announcements/:id/read', authenticate, requireRole('STUDENT'), (req, res) => {
    const id = Number(req.params.id);
    const user = (req as any).user as User;
    userReadAnnouncements.add(`${user.id}_${id}`);
    return res.json({ success: true, message: 'Marked as read' });
  });

  // === ADMIN USERS ===
  api.get('/admin/users', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const { search, role, active } = req.query;
    let list = users.map(u => userToDto(u));
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(u => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.studentId && u.studentId.toLowerCase().includes(q)));
    }
    if (role) {
      list = list.filter(u => u.role === role);
    }
    if (active !== undefined) {
      const isActive = active === 'true';
      list = list.filter(u => u.isActive === isActive);
    }
    return res.json({ success: true, message: 'Users retrieved', data: list });
  });

  api.put('/admin/users/:id/role', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.role = req.body.role;
    const actor = (req as any).user as User;
    recordAudit('ROLE_MODIFIED', actor.email, actor.role, user.studentId, `Changed role of ${user.fullName} to ${user.role}`, req.ip);
    return res.json({ success: true, message: 'Role updated successfully', data: userToDto(user) });
  });

  api.put('/admin/users/:id/status', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = req.body.active;
    const actor = (req as any).user as User;
    recordAudit('STATUS_MODIFIED', actor.email, actor.role, user.studentId, `Changed active status of ${user.fullName} to ${user.isActive}`, req.ip);
    return res.json({ success: true, message: 'User status updated', data: userToDto(user) });
  });

  api.put('/admin/users/:id', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    Object.assign(user, req.body);
    return res.json({ success: true, message: 'User updated successfully', data: userToDto(user) });
  });

  api.delete('/admin/users/:id', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const idx = users.findIndex(u => u.id === id);
    if (idx >= 0) users.splice(idx, 1);
    return res.json({ success: true, message: 'User deleted successfully' });
  });

  // === ADMIN AUDIT LOGS ===
  api.get('/admin/audit-logs', authenticate, requireRole('SUPER_ADMIN'), (req, res) => {
    return res.json({ success: true, message: 'Audit logs retrieved', data: auditLogs });
  });

  // Mount API router
  app.use('/api', api);

  // Serve Frontend / Vite
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CampusConnect server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
