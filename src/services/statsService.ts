import { supabase, isSupabaseConfigured, getLocalDb } from '../lib/supabase';
import { PlatformStats } from '../types';

export const getPlatformStats = async (): Promise<PlatformStats> => {
  if (isSupabaseConfigured) {
    const [
      { count: totalUsers },
      { count: totalStudents },
      { count: totalClubs },
      { count: publishedEvents },
      { count: totalRegistrations },
      { count: pendingRequests },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('clubs').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('published', true),
      supabase.from('event_registrations').select('*', { count: 'exact', head: true }).eq('status', 'REGISTERED'),
      supabase.from('club_memberships').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    ]);

    return {
      totalUsers: totalUsers || 0,
      totalStudents: totalStudents || 0,
      totalClubs: totalClubs || 0,
      publishedEvents: publishedEvents || 0,
      totalRegistrations: totalRegistrations || 0,
      pendingRequests: pendingRequests || 0,
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
    const [
      { count: enrolledClubs },
      { count: pendingClubRequests },
      { count: registeredEvents },
    ] = await Promise.all([
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

    // Unread announcements: active announcements count minus reads count
    const { count: totalActiveAnnouncements } = await supabase
      .from('announcements')
      .select('*', { count: 'exact', head: true })
      .eq('published', true);

    const { count: readAnnouncements } = await supabase
      .from('user_announcement_reads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const unread = Math.max(0, (totalActiveAnnouncements || 0) - (readAnnouncements || 0));

    return {
      enrolledClubs: enrolledClubs || 0,
      pendingClubRequests: pendingClubRequests || 0,
      registeredEvents: registeredEvents || 0,
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
    const [
      { count: totalMembers },
      { count: pendingRequests },
      { count: totalEvents },
    ] = await Promise.all([
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
    ]);

    return {
      totalMembers: totalMembers || 0,
      pendingRequests: pendingRequests || 0,
      totalEvents: totalEvents || 0,
      upcomingEvents: totalEvents || 0,
    };
  }

  const db = getLocalDb();
  const totalMembers = (db.club_memberships || []).filter(
    (m) => m.clubId === clubId && m.status === 'APPROVED'
  ).length;
  const pendingRequests = (db.club_memberships || []).filter(
    (m) => m.clubId === clubId && m.status === 'PENDING'
  ).length;
  const totalEvents = (db.events || []).filter((e) => e.clubId === clubId).length;

  return {
    totalMembers,
    pendingRequests,
    totalEvents,
    upcomingEvents: totalEvents,
  };
};
