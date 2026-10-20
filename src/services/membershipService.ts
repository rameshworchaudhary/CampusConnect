import { supabase, isSupabaseConfigured, getLocalDb, saveLocalDb } from '../lib/supabase';
import { Membership } from '../types';
import { logAuditAction } from './auditService';

const statusToUi = (value: string): Membership['status'] => value.toUpperCase() as Membership['status'];

const hydrateMemberships = async (rows: any[]): Promise<Membership[]> => {
  const clubIds = [...new Set(rows.map((row) => row.club_id).filter(Boolean))];
  const studentIds = [...new Set(rows.map((row) => row.student_id).filter(Boolean))];
  const [clubsResult, profilesResult] = await Promise.all([
    clubIds.length
      ? supabase.from('clubs').select('id, name').in('id', clubIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase.from('profiles').select('id, full_name, email').in('id', studentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (clubsResult.error) throw clubsResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const clubs = new Map((clubsResult.data || []).map((row) => [row.id, row.name]));
  const profiles = new Map((profilesResult.data || []).map((row) => [row.id, row]));
  return rows.map((row) => {
    const profile = profiles.get(row.student_id);
    return {
      id: row.id,
      clubId: row.club_id,
      clubName: clubs.get(row.club_id) || 'Club',
      userId: row.student_id,
      userName: profile?.full_name || 'Student',
      userEmail: profile?.email || '',
      studentId: '',
      department: '',
      status: statusToUi(row.status),
      appliedAt: row.created_at,
      reviewedAt: row.reviewed_at || undefined,
    };
  });
};

export const requestMembership = async (
  clubId: string,
  userId: string,
  actor?: { email: string; role: string }
): Promise<Membership> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('club_memberships')
      .insert([{ club_id: clubId, student_id: userId, status: 'pending' }])
      .select('*')
      .single();
    if (error) throw error;

    const [membership] = await hydrateMemberships([data]);
    if (actor) {
      await logAuditAction({
        actionType: 'MEMBERSHIP_REQUEST', actorEmail: actor.email, actorRole: actor.role,
        targetIdentifier: `Club: ${clubId}`, details: `Requested membership for club ${membership.clubName}`,
      });
    }
    return membership;
  }

  const db = getLocalDb();
  const existing = (db.club_memberships || []).find((m) => m.clubId === clubId && m.userId === userId);
  if (existing && existing.status !== 'REJECTED') throw new Error('You already have a membership request for this club.');
  const club = db.clubs.find((item) => item.id === clubId);
  const user = db.profiles.find((item) => item.id === userId);
  const membership: Membership = {
    id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    clubId, clubName: club?.name || 'Club', userId,
    userName: user?.fullName || 'Student', userEmail: user?.email || '',
    studentId: user?.studentId || '', department: user?.department || '',
    status: 'PENDING', appliedAt: new Date().toISOString(),
  };
  db.club_memberships.unshift(membership);
  saveLocalDb(db);
  if (actor) await logAuditAction({
    actionType: 'MEMBERSHIP_REQUEST', actorEmail: actor.email, actorRole: actor.role,
    targetIdentifier: `Club: ${clubId}`, details: `Requested membership for club ${club?.name || clubId}`,
  });
  return membership;
};

export const cancelMembershipRequest = async (
  clubId: string, userId: string, actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('club_memberships').delete()
      .eq('club_id', clubId).eq('student_id', userId).eq('status', 'pending').select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('No pending membership request was withdrawn. Refresh the club status and try again.');
  } else {
    const db = getLocalDb();
    if (!db.club_memberships.some((m) => m.clubId === clubId && m.userId === userId && m.status === 'PENDING')) {
      throw new Error('No pending membership request was withdrawn. Refresh the club status and try again.');
    }
    db.club_memberships = db.club_memberships.filter(
      (m) => !(m.clubId === clubId && m.userId === userId && m.status === 'PENDING')
    );
    saveLocalDb(db);
  }
  if (actor) await logAuditAction({
    actionType: 'MEMBERSHIP_CANCEL', actorEmail: actor.email, actorRole: actor.role,
    targetIdentifier: `Club: ${clubId}`, details: `Withdrew pending membership request for club ID ${clubId}`,
  });
};

export const getMembershipsForUser = async (userId: string): Promise<Membership[]> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('club_memberships').select('*')
      .eq('student_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return hydrateMemberships(data || []);
  }
  return (getLocalDb().club_memberships || []).filter((m) => m.userId === userId);
};

export const getMembershipRequestsForClub = async (
  clubId: string,
  statusFilter?: 'PENDING' | 'APPROVED' | 'REJECTED'
): Promise<Membership[]> => {
  if (isSupabaseConfigured) {
    let query = supabase.from('club_memberships').select('*').eq('club_id', clubId);
    if (statusFilter) query = query.eq('status', statusFilter.toLowerCase());
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return hydrateMemberships(data || []);
  }
  let rows = (getLocalDb().club_memberships || []).filter((m) => m.clubId === clubId);
  if (statusFilter) rows = rows.filter((m) => m.status === statusFilter);
  return rows;
};

export const reviewMembership = async (
  membershipId: string,
  status: 'APPROVED' | 'REJECTED',
  reviewerId: string,
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('club_memberships')
      .update({ status: status.toLowerCase() }).eq('id', membershipId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Membership status was not changed. The request may be missing or you may not manage its club.');
  } else {
    const db = getLocalDb();
    const index = db.club_memberships.findIndex((m) => m.id === membershipId);
    if (index === -1) throw new Error('Membership request was not found. Refresh the list and try again.');
    db.club_memberships[index].status = status;
    db.club_memberships[index].reviewedAt = new Date().toISOString();
    saveLocalDb(db);
  }
  if (actor) await logAuditAction({
    actionType: 'MEMBERSHIP_REVIEW', actorEmail: actor.email, actorRole: actor.role,
    targetIdentifier: membershipId,
    details: `${status === 'APPROVED' ? 'Approved' : 'Rejected'} membership request ID ${membershipId}`,
  });
  void reviewerId;
};
