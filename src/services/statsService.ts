import { supabase, isSupabaseConfigured, getLocalDb } from '../lib/supabase';
import { PlatformStats } from '../types';

const readCount = (result: { count: number | null; error: { message: string } | null }, label: string): number => {
  if (result.error) throw new Error(`Could not load ${label}: ${result.error.message}`);
  return result.count ?? 0;
};

const throwQueryError = (error: { message: string } | null, label: string): void => {
  if (error) throw new Error(`Could not load ${label}: ${error.message}`);
};

export const getPlatformStats = async (): Promise<PlatformStats> => {
  if (isSupabaseConfigured) {
    const results = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('clubs').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('published', true),
      supabase.from('event_registrations').select('*', { count: 'exact', head: true }).eq('status', 'REGISTERED'),
      supabase.from('club_memberships').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    ]);

    const labels = ['users', 'students', 'clubs', 'published events', 'event registrations', 'pending club requests'];
    results.forEach((result, index) => throwQueryError(result.error, labels[index]));
    const [totalUsers, totalStudents, totalClubs, publishedEvents, totalRegistrations, pendingRequests] =
      results.map((result, index) => readCount(result, labels[index]));

    return {
      totalUsers,
      totalStudents,
      totalClubs,
      publishedEvents,
      totalRegistrations,
      pendingRequests,
    };
  }

  const db = getLocalDb();
  const totalUsers = (db.profiles || []).length;
  const totalStudents = (db.profiles || []).filter((u) => u.role === 'STUDENT').length;
  const totalClubs = (db.clubs || []).filter((c) => c.approvalStatus === 'APPROVED').length;
  const publishedEvents = (db.events || []).filter((e) => e.isPublished).length;
  const totalRegistrations = (db.event_registrations || []).filter((r) => r.status === 'REGISTERED').length;
  const pendingRequests = (db.club_memberships || []).filter((m) => m.status === 'PENDING').length;

  return {
    totalUsers,
    totalStudents,
    totalClubs,
    publishedEvents,
    totalRegistrations,
    pendingRequests,
  };
};

export const getStudentStats = async (userId: string) => {
  if (isSupabaseConfigured) {
    const [enrolledResult, pendingResult, registrationsResult] = await Promise.all([
      supabase
        .from('club_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', userId)
        .eq('status', 'approved'),
      supabase
        .from('club_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', userId)
        .eq('status', 'pending'),
      supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'REGISTERED'),
    ]);
    const enrolledClubs = readCount(enrolledResult, 'approved memberships');
    const pendingClubRequests = readCount(pendingResult, 'pending memberships');
    const registeredEvents = readCount(registrationsResult, 'event registrations');

    const { data: activeAnnouncements, error: announcementsError } = await supabase
      .from('announcements')
      .select('id')
      .eq('published', true);
    throwQueryError(announcementsError, 'published announcements');

    const activeAnnouncementIds = (activeAnnouncements || []).map((announcement) => announcement.id);
    let readAnnouncements = 0;
    if (activeAnnouncementIds.length > 0) {
      const readResult = await supabase
        .from('user_announcement_reads')
        .select('announcement_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('announcement_id', activeAnnouncementIds);
      readAnnouncements = readCount(readResult, 'announcement reads');
    }

    const unread = Math.max(0, activeAnnouncementIds.length - readAnnouncements);

    return {
      enrolledClubs,
      pendingClubRequests,
      registeredEvents,
      unreadAnnouncements: unread,
    };
  }

  const db = getLocalDb();
  const enrolledClubs = (db.club_memberships || []).filter(
    (m) => m.userId === userId && m.status === 'APPROVED'
  ).length;
  const pendingClubRequests = (db.club_memberships || []).filter(
    (m) => m.userId === userId && m.status === 'PENDING'
  ).length;
  const registeredEvents = (db.event_registrations || []).filter(
    (r) => r.userId === userId && r.status === 'REGISTERED'
  ).length;

  const totalActiveAnnouncements = (db.announcements || []).filter((a) => a.isActive).length;
  const readAnnouncements = (db.user_announcement_reads || []).filter(
    (r) => r.userId === userId
  ).length;
  const unreadAnnouncements = Math.max(0, totalActiveAnnouncements - readAnnouncements);

  return {
    enrolledClubs,
    pendingClubRequests,
    registeredEvents,
    unreadAnnouncements,
  };
};

export const getClubAdminStats = async (clubId: string) => {
  if (isSupabaseConfigured) {
    const [membersResult, pendingResult, eventsResult, upcomingEventsResult] = await Promise.all([
      supabase
        .from('club_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('status', 'approved'),
      supabase
        .from('club_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('status', 'pending'),
      supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId),
      supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .gt('starts_at', new Date().toISOString()),
    ]);
    const totalMembers = readCount(membersResult, 'approved members');
    const pendingRequests = readCount(pendingResult, 'pending membership requests');
    const totalEvents = readCount(eventsResult, 'club events');
    const upcomingEvents = readCount(upcomingEventsResult, 'upcoming club events');

    return {
      totalMembers: totalMembers || 0,
      pendingRequests: pendingRequests || 0,
      totalEvents: totalEvents || 0,
      upcomingEvents,
    };
  }

  const db = getLocalDb();
  const totalMembers = (db.club_memberships || []).filter(
    (m) => m.clubId === clubId && m.status === 'APPROVED'
  ).length;
  const pendingRequests = (db.club_memberships || []).filter(
    (m) => m.clubId === clubId && m.status === 'PENDING'
  ).length;
  const clubEvents = (db.events || []).filter((e) => e.clubId === clubId);
  const totalEvents = clubEvents.length;
  const upcomingEvents = clubEvents.filter((event) => {
    const timestamp = Date.parse(event.eventDate);
    return Number.isFinite(timestamp) && timestamp > Date.now();
  }).length;

  return {
    totalMembers,
    pendingRequests,
    totalEvents,
    upcomingEvents,
  };
};
