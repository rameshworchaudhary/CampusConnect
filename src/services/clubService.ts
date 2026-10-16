import { supabase, isSupabaseConfigured, getLocalDb, saveLocalDb } from '../lib/supabase';
import { Club } from '../types';
import { logAuditAction } from './auditService';

const getAssignedAdminNames = async (profileIds: Array<string | null | undefined>) => {
  const ids = [...new Set(profileIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map<string, string>();

  const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((profile) => [profile.id, profile.full_name]));
};

const toApprovalStatus = (value?: string | null): Club['approvalStatus'] => {
  const status = (value || '').toLowerCase();
  if (status === 'approved') return 'APPROVED';
  if (status === 'rejected') return 'REJECTED';
  return 'PENDING';
};

const getClubMembershipRows = async (clubIds: string[]) => {
  if (clubIds.length === 0) return [];
  const { data, error } = await supabase
    .from('club_memberships')
    .select('id, club_id, student_id, status')
    .in('club_id', clubIds);
  if (error) throw error;
  return data || [];
};

const mapClubRow = (row: any, memberships: any[], adminNames: Map<string, string>, userId?: string): Club => {
  const clubMemberships = memberships.filter((membership) => membership.club_id === row.id);
  const ownMembership = clubMemberships.find((membership) => membership.student_id === userId);
  const status = toApprovalStatus(row.status);
  return {
    id: row.id,
    refId: row.id,
    name: row.name,
    category: row.category || 'General',
    description: row.description || '',
    logoUrl: row.logo_path || undefined,
    approvalStatus: status,
    isPublished: status === 'APPROVED',
    assignedAdminId: row.assigned_admin_id || undefined,
    assignedAdminName: row.assigned_admin_id ? adminNames.get(row.assigned_admin_id) : undefined,
    memberCount: clubMemberships.filter((m) => String(m.status).toLowerCase() === 'approved').length,
    pendingRequestCount: clubMemberships.filter((m) => String(m.status).toLowerCase() === 'pending').length,
    userMembershipStatus: ownMembership
      ? String(ownMembership.status).toUpperCase() as Club['userMembershipStatus']
      : 'NONE',
  };
};

export const getPublicClubs = async (userId?: string): Promise<Club[]> => {
  if (isSupabaseConfigured) {
    const { data: clubsData, error } = await supabase
      .from('clubs')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    // RLS already limits public callers to approved clubs. Normalize in the
    // client so enum labels stored as either APPROVED or approved both work.
    const rows = (clubsData || []).filter((club) => String(club.status).toLowerCase() === 'approved');
    const [memberships, adminNames] = await Promise.all([
      getClubMembershipRows(rows.map((club) => club.id)),
      getAssignedAdminNames(rows.map((club) => club.assigned_admin_id)),
    ]);
    return rows.map((row) => mapClubRow(row, memberships, adminNames, userId));
  }

  // Fallback mode using local state
  const db = getLocalDb();
  const approvedClubs = (db.clubs || []).filter(
    (c) => c.approvalStatus === 'APPROVED' && c.isPublished
  );

  return approvedClubs.map((club) => {
    const clubMemberships = (db.club_memberships || []).filter((m) => m.clubId === club.id);
    const approvedCount = clubMemberships.filter((m) => m.status === 'APPROVED').length;
    const pendingCount = clubMemberships.filter((m) => m.status === 'PENDING').length;

    let userMembershipStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'NONE';
    if (userId) {
      const userMem = clubMemberships.find((m) => m.userId === userId);
      if (userMem) {
        userMembershipStatus = userMem.status;
      }
    }

    return {
      ...club,
      memberCount: approvedCount,
      pendingRequestCount: pendingCount,
      userMembershipStatus,
    };
  });
};

export const getAllClubs = async (): Promise<Club[]> => {
  if (isSupabaseConfigured) {
    const { data: clubsData, error } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = clubsData || [];
    const [memberships, adminNames] = await Promise.all([
      getClubMembershipRows(rows.map((club) => club.id)),
      getAssignedAdminNames(rows.map((club) => club.assigned_admin_id)),
    ]);
    return rows.map((row) => mapClubRow(row, memberships, adminNames));
  }

  const db = getLocalDb();
  return (db.clubs || []).map((club) => {
    const clubMemberships = (db.club_memberships || []).filter((m) => m.clubId === club.id);
    return {
      ...club,
      memberCount: clubMemberships.filter((m) => m.status === 'APPROVED').length,
      pendingRequestCount: clubMemberships.filter((m) => m.status === 'PENDING').length,
    };
  });
};

export const getClubById = async (clubId: string, userId?: string): Promise<Club | null> => {
  const all = await getAllClubs();
  const found = all.find((c) => c.id === clubId);
  if (!found) return null;

  if (userId) {
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('club_memberships')
        .select('status')
        .eq('club_id', clubId)
        .eq('student_id', userId)
        .maybeSingle();
      if (data) {
        found.userMembershipStatus = String(data.status).toUpperCase() as Club['userMembershipStatus'];
      }
    } else {
      const db = getLocalDb();
      const mem = (db.club_memberships || []).find((m) => m.clubId === clubId && m.userId === userId);
      if (mem) {
        found.userMembershipStatus = mem.status;
      }
    }
  }

  return found;
};

export const registerClub = async (
  clubData: {
    name: string;
    category: string;
    description: string;
    meetingSchedule?: string;
    meetingLocation?: string;
    facultyAdvisor?: string;
    contactEmail?: string;
    contactPhone?: string;
    logoUrl?: string;
  },
  actor?: { email: string; role: string }
): Promise<Club> => {
  const refId = `CLUB-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  if (isSupabaseConfigured) {
    const { data: authData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('clubs')
      .insert([
        {
          name: clubData.name,
          category: clubData.category,
          description: clubData.description,
          logo_path: clubData.logoUrl,
          created_by: authData.user?.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    if (actor) {
      await logAuditAction({
        actionType: 'CLUB_REGISTRATION',
        actorEmail: actor.email,
        actorRole: actor.role,
        targetIdentifier: refId,
        details: `Submitted registration for club: ${clubData.name} (Pending Approval)`,
      });
    }

    return {
      id: data.id,
      refId: data.id,
      name: data.name,
      category: data.category,
      description: data.description || '',
      meetingSchedule: data.meeting_schedule,
      meetingLocation: data.meeting_location,
      facultyAdvisor: data.faculty_advisor,
      contactEmail: data.contact_email,
      contactPhone: data.contact_phone,
      logoUrl: data.logo_path,
      approvalStatus: toApprovalStatus(data.status),
      isPublished: String(data.status).toLowerCase() === 'approved',
      memberCount: 0,
      pendingRequestCount: 0,
    };
  }

  // Local DB simulation
  const db = getLocalDb();
  const newClub: Club = {
    id: `club-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    refId,
    name: clubData.name,
    category: clubData.category,
    description: clubData.description,
    meetingSchedule: clubData.meetingSchedule,
    meetingLocation: clubData.meetingLocation,
    facultyAdvisor: clubData.facultyAdvisor,
    contactEmail: clubData.contactEmail,
    contactPhone: clubData.contactPhone,
    logoUrl: clubData.logoUrl,
    approvalStatus: 'PENDING',
    isPublished: true,
    memberCount: 0,
    pendingRequestCount: 0,
  };
  db.clubs.unshift(newClub);
  saveLocalDb(db);

  if (actor) {
    await logAuditAction({
      actionType: 'CLUB_REGISTRATION',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: refId,
      details: `Submitted registration for club: ${clubData.name} (Pending Approval)`,
    });
  }

  return newClub;
};

export const updateClub = async (
  clubId: string,
  updates: Partial<Club>,
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.logoUrl !== undefined) payload.logo_path = updates.logoUrl;
    if (updates.approvalStatus !== undefined) payload.status = updates.approvalStatus.toLowerCase();
    if (updates.assignedAdminId !== undefined) payload.assigned_admin_id = updates.assignedAdminId;

    const { error } = await supabase.from('clubs').update(payload).eq('id', clubId);
    if (error) throw error;
  } else {
    const db = getLocalDb();
    const idx = db.clubs.findIndex((c) => c.id === clubId);
    if (idx !== -1) {
      db.clubs[idx] = { ...db.clubs[idx], ...updates };
      saveLocalDb(db);
    }
  }

  if (actor) {
    await logAuditAction({
      actionType: 'CLUB_UPDATE',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: clubId,
      details: `Updated club information for club ID ${clubId}`,
    });
  }
};

export const approveClub = async (
  clubId: string,
  actor?: { email: string; role: string }
): Promise<void> => {
  await updateClub(clubId, { approvalStatus: 'APPROVED', isPublished: true }, actor);
  if (actor) {
    await logAuditAction({
      actionType: 'CLUB_APPROVAL',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: clubId,
      details: `Approved club registration for club ID ${clubId}`,
    });
  }
};

export const rejectClub = async (
  clubId: string,
  actor?: { email: string; role: string }
): Promise<void> => {
  await updateClub(clubId, { approvalStatus: 'REJECTED' }, actor);
  if (actor) {
    await logAuditAction({
      actionType: 'CLUB_REJECTION',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: clubId,
      details: `Rejected club registration for club ID ${clubId}`,
    });
  }
};

export const deleteClub = async (
  clubId: string,
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('clubs').delete().eq('id', clubId);
    if (error) throw error;
  } else {
    const db = getLocalDb();
    db.clubs = db.clubs.filter((c) => c.id !== clubId);
    db.club_memberships = db.club_memberships.filter((m) => m.clubId !== clubId);
    db.events = db.events.filter((e) => e.clubId !== clubId);
    db.announcements = db.announcements.filter((a) => a.clubId !== clubId);
    saveLocalDb(db);
  }

  if (actor) {
    await logAuditAction({
      actionType: 'CLUB_DELETION',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: clubId,
      details: `Deleted club ID ${clubId}`,
    });
  }
};

export const assignClubAdmin = async (
  clubId: string,
  userId: string,
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    // 1. Update club
    const { error: clubErr } = await supabase
      .from('clubs')
      .update({ assigned_admin_id: userId })
      .eq('id', clubId);
    if (clubErr) throw clubErr;

    // 2. Update user profile
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ role: 'club_admin' })
      .eq('id', userId);
    if (profErr) throw profErr;
  } else {
    const db = getLocalDb();
    const clubIdx = db.clubs.findIndex((c) => c.id === clubId);
    const userIdx = db.profiles.findIndex((p) => p.id === userId);
    if (clubIdx !== -1) {
      db.clubs[clubIdx].assignedAdminId = userId;
      if (userIdx !== -1) {
        db.clubs[clubIdx].assignedAdminName = db.profiles[userIdx].fullName;
      }
    }
    if (userIdx !== -1) {
      db.profiles[userIdx].role = 'CLUB_ADMIN';
      db.profiles[userIdx].assignedClubId = clubId;
      if (clubIdx !== -1) {
        db.profiles[userIdx].assignedClubName = db.clubs[clubIdx].name;
      }
    }
    saveLocalDb(db);
  }

  if (actor) {
    await logAuditAction({
      actionType: 'ADMIN_ASSIGNMENT',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: `Club: ${clubId}, User: ${userId}`,
      details: `Assigned user ${userId} as Club Admin for club ${clubId}`,
    });
  }
};
