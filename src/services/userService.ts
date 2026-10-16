import { supabase, isSupabaseConfigured, getLocalDb, saveLocalDb } from '../lib/supabase';
import { User, Role } from '../types';
import { logAuditAction } from './auditService';

export const getAllUsers = async (): Promise<User[]> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const assignedClubIds = [...new Set((data || [])
      .map((row) => row.assigned_club_id)
      .filter((id): id is string => Boolean(id)))];
    const clubNames = new Map<string, string>();
    if (assignedClubIds.length > 0) {
      const { data: clubs, error: clubsError } = await supabase
        .from('clubs')
        .select('id, name')
        .in('id', assignedClubIds);
      if (clubsError) throw clubsError;
      for (const club of clubs || []) clubNames.set(club.id, club.name);
    }

    return (data || []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      studentId: row.student_id,
      department: row.department,
      role: row.role,
      isActive: row.is_active,
      isVerified: true,
      assignedClubId: row.assigned_club_id,
      assignedClubName: row.assigned_club_id ? clubNames.get(row.assigned_club_id) : undefined,
    }));
  }

  const db = getLocalDb();
  return db.profiles || [];
};

export const updateUserRole = async (
  userId: string,
  role: Role,
  assignedClubId?: string | null,
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const payload: any = { role, assigned_club_id: role === 'CLUB_ADMIN' ? assignedClubId : null };
    const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
    if (error) throw error;

    if (role === 'CLUB_ADMIN' && assignedClubId) {
      await supabase.from('clubs').update({ assigned_admin_id: userId }).eq('id', assignedClubId);
    }
  } else {
    const db = getLocalDb();
    const idx = db.profiles.findIndex((p) => p.id === userId);
    if (idx !== -1) {
      db.profiles[idx].role = role;
      db.profiles[idx].assignedClubId = role === 'CLUB_ADMIN' ? (assignedClubId || undefined) : undefined;
      if (role === 'CLUB_ADMIN' && assignedClubId) {
        const club = db.clubs.find((c) => c.id === assignedClubId);
        if (club) {
          db.profiles[idx].assignedClubName = club.name;
          club.assignedAdminId = userId;
          club.assignedAdminName = db.profiles[idx].fullName;
        }
      }
      saveLocalDb(db);
    }
  }

  if (actor) {
    await logAuditAction({
      actionType: 'ROLE_UPDATE',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: userId,
      details: `Updated role of user ${userId} to ${role}${assignedClubId ? ` for club ${assignedClubId}` : ''}`,
    });
  }
};

export const toggleUserStatus = async (
  userId: string,
  isActive: boolean,
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', userId);

    if (error) throw error;
  } else {
    const db = getLocalDb();
    const idx = db.profiles.findIndex((p) => p.id === userId);
    if (idx !== -1) {
      db.profiles[idx].isActive = isActive;
      saveLocalDb(db);
    }
  }

  if (actor) {
    await logAuditAction({
      actionType: 'USER_STATUS_TOGGLE',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: userId,
      details: `${isActive ? 'Activated' : 'Deactivated'} account for user ${userId}`,
    });
  }
};

export const deleteUser = async (
  userId: string,
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
  } else {
    const db = getLocalDb();
    db.profiles = db.profiles.filter((p) => p.id !== userId);
    db.club_memberships = db.club_memberships.filter((m) => m.userId !== userId);
    db.event_registrations = db.event_registrations.filter((r) => r.userId !== userId);
    saveLocalDb(db);
  }

  if (actor) {
    await logAuditAction({
      actionType: 'USER_DELETION',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: userId,
      details: `Deleted user profile ID ${userId}`,
    });
  }
};
