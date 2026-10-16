import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Role, User } from '../types';
import { logAuditAction } from './auditService';

const normalizeProfileRole = (value: string): Role => {
  switch (value.toLowerCase()) {
    case 'student':
      return 'STUDENT';
    case 'club_admin':
      return 'CLUB_ADMIN';
    case 'admin':
    case 'super_admin':
      return 'SUPER_ADMIN';
    default:
      throw new Error(`Unsupported profile role: ${value}`);
  }
};

const getAssignedClub = async (profileId: string, clubId?: string | null) => {
  // Support both schema layouts: profile.assigned_club_id or
  // clubs.assigned_admin_id. No PostgREST embedded relationship is required.
  const query = supabase.from('clubs').select('id, name');
  const { data, error } = clubId
    ? await query.eq('id', clubId).maybeSingle()
    : await query.eq('assigned_admin_id', profileId).maybeSingle();

  if (error || !data) return undefined;
  return { id: data.id, name: data.name };
};

export const signUp = async (params: {
  fullName: string;
  email: string;
  password: string;
  studentId?: string;
  department?: string;
}): Promise<{ user: User | null; message: string }> => {
  if (!isSupabaseConfigured) throw new Error('Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to use authentication.');
  {
    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        emailRedirectTo: `${window.location.origin}/verify-email`,
        data: {
          full_name: params.fullName,
          student_id: params.studentId,
          department: params.department,
        },
      },
    });

    if (error) throw error;

    // Fetch the generated profile row (trigger may have created it)
    if (data.user) {
      await logAuditAction({
        actionType: 'USER_REGISTRATION',
        actorEmail: params.email,
        actorRole: 'STUDENT',
        targetIdentifier: data.user.id,
        details: `Student account created for ${params.fullName}`,
      });
    }

    return {
      user: data.user
        ? {
            id: data.user.id,
            fullName: params.fullName,
            email: params.email,
            studentId: params.studentId,
            department: params.department,
            role: 'STUDENT',
            isActive: true,
            isVerified: Boolean(data.session),
          }
        : null,
      message: data.session
        ? 'Account created and signed in successfully!'
        : 'Registration successful! If confirmation is enabled, check your email for verification link.',
    };
  }

};

export const signIn = async (params: {
  email: string;
  password: string;
}): Promise<{ user: User; token: string }> => {
  if (!isSupabaseConfigured) throw new Error('Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to use authentication.');
  {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    });

    if (error) throw error;
    if (!data.user || !data.session) throw new Error('Authentication succeeded but session could not be established.');

    // Repair legacy accounts missing their trigger-created profile when the
    // additive ensure_own_profile migration has been applied.
    const { data: repairedProfile, error: repairErr } = await supabase.rpc('ensure_own_profile');

    // Older installs may not have the repair RPC yet. If an existing profile
    // is readable, allow sign-in while reporting a missing profile precisely.
    let profile = repairedProfile;
    let profErr = null;
    if (!profile) {
      const profileResult = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      profile = profileResult.data;
      profErr = profileResult.error;
    }

    if (profErr || !profile) {
      await supabase.auth.signOut();
      const detail = profErr?.message || (repairErr
        ? `The profile repair step failed: ${repairErr.message}`
        : `No profile row exists for authenticated user ${data.user.id}.`);
      throw new Error(
        `Your profile could not be loaded. Run supabase/manual_own_profile_repair.sql in the Supabase SQL Editor, then retry. ${detail}`
      );
    }

    if (profile.is_active === false) {
      await supabase.auth.signOut();
      throw new Error('Your account has been deactivated. Please contact campus administration.');
    }

    const avatarUrl = profile.avatar_url && !profile.avatar_url.startsWith('http')
      ? (await supabase.storage.from('avatars').createSignedUrl(profile.avatar_url, 3600)).data?.signedUrl
      : profile.avatar_url;
    const assignedClub = await getAssignedClub(profile.id, profile.assigned_club_id);
    const role = normalizeProfileRole(profile.role);
    const userObj: User = {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      studentId: profile.student_id,
      department: profile.department,
      role,
      isActive: profile.is_active ?? true,
      isVerified: true,
      assignedClubId: profile.assigned_club_id || assignedClub?.id,
      assignedClubName: assignedClub?.name,
      avatarUrl,
      avatarPath: profile.avatar_url?.startsWith('http') ? undefined : profile.avatar_url,
    };

    await logAuditAction({
      actionType: 'USER_SIGN_IN',
      actorEmail: profile.email,
      actorRole: role,
      targetIdentifier: profile.id,
      details: `User signed in: ${profile.email}`,
    });

    return { user: userObj, token: data.session.access_token };
  }

};

export const signOut = async (): Promise<void> => {
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured) return null;
  {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return null;

    await supabase.rpc('ensure_own_profile');

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!profile) return null;

    const avatarUrl = profile.avatar_url && !profile.avatar_url.startsWith('http')
      ? (await supabase.storage.from('avatars').createSignedUrl(profile.avatar_url, 3600)).data?.signedUrl
      : profile.avatar_url;
    const assignedClub = await getAssignedClub(profile.id, profile.assigned_club_id);
    const role = normalizeProfileRole(profile.role);
    return {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      studentId: profile.student_id,
      department: profile.department,
      role,
      isActive: profile.is_active ?? true,
      isVerified: true,
      assignedClubId: profile.assigned_club_id || assignedClub?.id,
      assignedClubName: assignedClub?.name,
      avatarUrl,
      avatarPath: profile.avatar_url?.startsWith('http') ? undefined : profile.avatar_url,
    };
  }

  return null;
};

export const updateProfile = async (
  userId: string,
  params: { fullName: string; studentId?: string; department?: string; avatarPath?: string },
  actor?: { email: string; role: string }
): Promise<void> => {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  {
    const payload: any = {
      full_name: params.fullName,
    };
    if (params.studentId !== undefined) payload.student_id = params.studentId;
    if (params.department !== undefined) payload.department = params.department;
    if (params.avatarPath !== undefined) payload.avatar_url = params.avatarPath;

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId);

    if (error) throw error;
  }

  if (actor) {
    await logAuditAction({
      actionType: 'PROFILE_UPDATE',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: userId,
      details: `Updated personal profile information`,
    });
  }
};

export const changePassword = async (newPassword: string): Promise<void> => {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  }
};

export const resetPasswordForEmail = async (email: string): Promise<void> => {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  {
    const redirectUrl = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) throw error;
  }
};
