import { supabase, isSupabaseConfigured, getLocalDb, saveLocalDb } from '../lib/supabase';
import { User, Role } from '../types';
import { logAuditAction } from './auditService';
import { normalizeProfileRole } from './authService';

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

    return (data || []).map((row) => {
      if (typeof row.is_active !== 'boolean') {
        throw new Error('Account status schema is missing. Apply the CampusConnect compatibility migration and reload.');
      }
      return {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        studentId: row.student_id,
        department: row.department,
        role: normalizeProfileRole(row.role),
        isActive: row.is_active,
        isVerified: true,
        assignedClubId: row.assigned_club_id,
        assignedClubName: row.assigned_club_id ? clubNames.get(row.assigned_club_id) : undefined,
      };
    });
  }

  const db = getLocalDb();
  return db.profiles || [];
};

export const updateUserRole = async (
  userId: string,
  role: Role,
  assignedClubId?: string | null,
  actor: { email: string; role: string }
): Promise<void> => {
  if (actor.role !== 'SUPER_ADMIN') {
    throw new Error('Only a Super Admin can change user roles or assign Club Admins.');
  }
  if (role === 'CLUB_ADMIN' && !assignedClubId) {
    throw new Error('Select a club before assigning the Club Admin role.');
  }

  if (isSupabaseConfigured) {
    const { error } = await supabase.rpc('set_profile_role_and_club', {
      p_target_user_id: userId,
      p_target_role: role,
      p_target_club_id: role === 'CLUB_ADMIN' ? assignedClubId : null,
    });
    if (error) throw error;
  } else {
    const db = getLocalDb();
    const idx = db.profiles.findIndex((p) => p.id === userId);
    if (idx === -1) throw new Error('User profile was not found. Refresh the list and try again.');
    db.profiles[idx].role = role;
    db.profiles[idx].assignedClubId = role === 'CLUB_ADMIN' ? (assignedClubId || undefined) : undefined;
    if (role === 'CLUB_ADMIN' && assignedClubId) {
      const club = db.clubs.find((c) => c.id === assignedClubId);
      if (!club) throw new Error('The selected club was not found. Refresh the list and try again.');
      db.profiles[idx].assignedClubName = club.name;
      club.assignedAdminId = userId;
      club.assignedAdminName = db.profiles[idx].fullName;
    } else {
      delete db.profiles[idx].assignedClubName;
    }
    for (const club of db.clubs) {
      if (club.assignedAdminId === userId && club.id !== assignedClubId) {
        delete club.assignedAdminId;
        delete club.assignedAdminName;
      }
    }
    saveLocalDb(db);
  }

  if (!isSupabaseConfigured) {
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
  actor: { email: string; role: string }
): Promise<void> => {
  if (actor.role !== 'SUPER_ADMIN') {
    throw new Error('Only a Super Admin can change account status.');
  }

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', userId)
      .select('id, is_active')
      .maybeSingle();

    if (error) throw error;
    if (!data || data.is_active !== isActive) throw new Error('Account status was not changed. Confirm that the target exists and your active Super Admin permissions are current.');
  } else {
    const db = getLocalDb();
    const idx = db.profiles.findIndex((p) => p.id === userId);
    if (idx === -1) throw new Error('Account was not found. Refresh the user list and try again.');
    db.profiles[idx].isActive = isActive;
    saveLocalDb(db);
  }

  if (!isSupabaseConfigured) {
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
    void userId;
    void actor;
    throw new Error('Account deletion is unavailable until a protected server-side Auth Admin function is configured. No account was deleted.');
  } else {
    const db = getLocalDb();
    if (!db.profiles.some((profile) => profile.id === userId)) throw new Error('User profile was not found. Refresh the list and try again.');
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
