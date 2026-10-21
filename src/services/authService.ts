import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Role, User } from '../types';
import { logAuditAction } from './auditService';
import { getStorageImageUrl, getStorageObjectPath, STORAGE_BUCKETS, deleteReplacedImage } from './storageService';
import { getAuthRedirectUrl } from '../lib/authUrls';

export const normalizeProfileRole = (value: string): Role => {
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
        emailRedirectTo: getAuthRedirectUrl('/verify-email'),
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
        ? 'Account created. CampusConnect will verify your account status before allowing access.'
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

    if (repairErr && /deactivated/i.test(repairErr.message)) {
      await supabase.auth.signOut();
      throw new Error('Your account has been deactivated. Please contact campus administration.');
    }

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

    if (typeof profile.is_active !== 'boolean') {
      await supabase.auth.signOut();
      throw new Error('Account status schema is not ready. Apply the CampusConnect compatibility migration, then retry.');
    }
    if (!profile.is_active) {
      await supabase.auth.signOut();
      throw new Error('Your account has been deactivated. Please contact campus administration.');
    }

    const avatarUrl = await getStorageImageUrl(STORAGE_BUCKETS.avatars, profile.avatar_url);
    const assignedClub = await getAssignedClub(profile.id, profile.assigned_club_id);
    const role = normalizeProfileRole(profile.role);
    const userObj: User = {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      studentId: profile.student_id,
      department: profile.department,
      role,
      isActive: profile.is_active,
      isVerified: true,
      assignedClubId: profile.assigned_club_id || assignedClub?.id,
      assignedClubName: assignedClub?.name,
      avatarUrl,
      avatarPath: getStorageObjectPath(STORAGE_BUCKETS.avatars, profile.avatar_url),
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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      await supabase.auth.signOut();
      return null;
    }

    if (typeof profile.is_active !== 'boolean' || !profile.is_active) {
      await supabase.auth.signOut();
      return null;
    }

    const avatarUrl = await getStorageImageUrl(STORAGE_BUCKETS.avatars, profile.avatar_url);
    const assignedClub = await getAssignedClub(profile.id, profile.assigned_club_id);
    const role = normalizeProfileRole(profile.role);
    return {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      studentId: profile.student_id,
      department: profile.department,
      role,
      isActive: profile.is_active,
      isVerified: true,
      assignedClubId: profile.assigned_club_id || assignedClub?.id,
      assignedClubName: assignedClub?.name,
      avatarUrl,
      avatarPath: getStorageObjectPath(STORAGE_BUCKETS.avatars, profile.avatar_url),
    };
  }

  return null;
};

export const updateProfile = async (
  userId: string,
  params: { fullName: string; studentId?: string; department?: string; avatarPath?: string | null },
  actor?: { email: string; role: string }
): Promise<{ fullName: string; studentId: string | null; department: string | null; avatarPath: string | null }> => {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  let savedProfile: { fullName: string; studentId: string | null; department: string | null; avatarPath: string | null };
  const { data: before, error: beforeError } = await supabase.from('profiles').select('avatar_url').eq('id', userId).maybeSingle();
  if (beforeError) throw beforeError;
  {
    const payload: any = {
      full_name: params.fullName,
    };
    if (params.studentId !== undefined) payload.student_id = params.studentId;
    if (params.department !== undefined) payload.department = params.department;
    if (params.avatarPath !== undefined) payload.avatar_url = params.avatarPath;

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select('id, full_name, student_id, department, avatar_url')
      .maybeSingle();

    if (error) {
      console.error(`[Profile update] Failed: ${error.message}`, {
        code: error.code,
        details: error.details,
        hint: error.hint,
        payloadColumns: Object.keys(payload),
      });
      throw error;
    }
    if (!data) {
      throw new Error('Profile update affected no rows. Check that you are signed in and the profile UPDATE policy allows editing your own row.');
    }
    savedProfile = {
      fullName: data.full_name,
      studentId: data.student_id,
      department: data.department,
      avatarPath: data.avatar_url,
    };
  }

  await deleteReplacedImage(STORAGE_BUCKETS.avatars, before?.avatar_url, savedProfile.avatarPath);

  if (actor) {
    await logAuditAction({
      actionType: 'PROFILE_UPDATE',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: userId,
      details: `Updated personal profile information`,
    });
  }
  return savedProfile;
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
    const redirectUrl = getAuthRedirectUrl('/reset-password');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) throw error;
  }
};

/** Verify only the signup confirmation callback configured by signUp(). */
export const verifySignupEmailCallback = async (callbackUrl: string): Promise<void> => {
  if (!isSupabaseConfigured) {
    throw new Error('Email verification is unavailable because Supabase is not configured.');
  }

  let callback: URL;
  try {
    callback = new URL(callbackUrl);
  } catch {
    throw new Error('This verification link is malformed. Return to registration and request a new link.');
  }

  const hashParams = new URLSearchParams(callback.hash.replace(/^#/, ''));
  const tokenHash = callback.searchParams.get('token_hash');
  const callbackTypes = [callback.searchParams.get('type'), hashParams.get('type')].filter((value): value is string => Boolean(value));
  const callbackError = callback.searchParams.get('error_code') || hashParams.get('error_code');
  if (callbackError) {
    if (/expired|invalid|otp/i.test(callbackError)) {
      throw new Error('This verification link is invalid or expired. Return to registration and request a new link.');
    }
    throw new Error('Supabase could not complete this verification link. Return to registration and request a new link.');
  }

  // With Supabase PKCE links, the client may exchange `code` and clean the URL
  // before this page verifies it. In that case, confirm the resulting session
  // with Auth and require an email-confirmed user before showing success.
  if (callback.searchParams.has('code')) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new Error('Supabase could not complete this verification link. Return to registration and request a new link.');
    }
    if (!data.user.email_confirmed_at && !data.user.confirmed_at) {
      throw new Error('Supabase has not confirmed this email address. Request a new verification link and try again.');
    }
    return;
  }

  if (callbackTypes.length === 0 || callbackTypes.some((type) => type !== 'signup')) {
    throw new Error('This is not a valid signup verification link. Return to registration and request a new link.');
  }

  let accessToken: string | null = null;
  if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'signup' });
    if (error) {
      if (error.status === 400 || error.status === 401) {
        throw new Error('This verification link is invalid or expired. Return to registration and request a new link.');
      }
      throw new Error('We could not reach Supabase to verify this link. Check your connection and retry.');
    }
    accessToken = data.session?.access_token ?? null;
    if (!accessToken) {
      throw new Error('Supabase accepted the link but did not establish a verification session. Please request a new link.');
    }
  } else {
    accessToken = hashParams.get('access_token');
  }

  if (!accessToken) {
    throw new Error('This verification link is missing its signup credentials. Return to registration and request a new link.');
  }

  // Validate this exact callback token with Auth rather than trusting the URL
  // or an unrelated session that may already exist in the browser.
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    if (error?.status === 400 || error?.status === 401) {
      throw new Error('This verification link is invalid or expired. Return to registration and request a new link.');
    }
    throw new Error('We could not confirm this account with Supabase. Check your connection and retry.');
  }

  if (!data.user.email_confirmed_at && !data.user.confirmed_at) {
    throw new Error('Supabase has not confirmed this email address. Request a new verification link and try again.');
  }
};
