import { supabase, isSupabaseConfigured, getLocalDb, saveLocalDb } from '../lib/supabase';
import { AnnouncementItem } from '../types';
import { logAuditAction } from './auditService';

const clubNameMap = async (clubIds: Array<string | null | undefined>) => {
  const ids = [...new Set(clubIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Map<string, string>();
  const { data, error } = await supabase.from('clubs').select('id, name').in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((club) => [club.id, club.name]));
};

const getReadAnnouncementIds = async (userId?: string) => {
  if (!userId) return new Set<string>();
  const { data, error } = await supabase.from('user_announcement_reads')
    .select('announcement_id').eq('user_id', userId);
  if (error) throw error;
  return new Set((data || []).map((row) => row.announcement_id));
};

const mapAnnouncement = (row: any, names: Map<string, string>, readIds = new Set<string>()): AnnouncementItem => ({
  id: row.id,
  clubId: row.club_id || undefined,
  clubName: row.club_id ? names.get(row.club_id) : undefined,
  title: row.title,
  content: row.body || '',
  postedByName: row.created_by || 'CampusConnect',
  isActive: Boolean(row.published),
  isRead: readIds.has(row.id),
  createdAt: row.created_at,
});

export const getPublicAnnouncements = async (userId?: string): Promise<AnnouncementItem[]> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = data || [];
    const [names, readIds] = await Promise.all([
      clubNameMap(rows.map((row) => row.club_id)),
      getReadAnnouncementIds(userId),
    ]);
    return rows.map((row) => mapAnnouncement(row, names, readIds));
  }

  const db = getLocalDb();
  const activeAnnouncements = (db.announcements || []).filter((a) => a.isActive);

  return activeAnnouncements.map((ann) => {
    const isRead = userId
      ? (db.user_announcement_reads || []).some(
          (r) => r.announcementId === ann.id && r.userId === userId
        )
      : false;
    return { ...ann, isRead };
  });
};

export const getAllAnnouncements = async (): Promise<AnnouncementItem[]> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = data || [];
    const names = await clubNameMap(rows.map((row) => row.club_id));
    return rows.map((row) => mapAnnouncement(row, names));
  }

  const db = getLocalDb();
  return db.announcements || [];
};

export const getAnnouncementsForClub = async (clubId: string): Promise<AnnouncementItem[]> => {
  const all = await getAllAnnouncements();
  return all.filter((a) => a.clubId === clubId);
};

export const createAnnouncement = async (
  data: {
    clubId?: string | null;
    title: string;
    content: string;
    postedByName: string;
  },
  actor?: { id: string; email: string; role: string }
): Promise<AnnouncementItem> => {
  if (isSupabaseConfigured) {
    const { data: created, error } = await supabase
      .from('announcements')
      .insert([
        {
          club_id: data.clubId || null,
          title: data.title,
          body: data.content,
          created_by: actor?.id,
          published: true,
        },
      ])
      .select('*')
      .single();

    if (error) throw error;

    if (actor) {
      await logAuditAction({
        actionType: 'ANNOUNCEMENT_CREATION',
        actorEmail: actor.email,
        actorRole: actor.role,
        targetIdentifier: created.id,
        details: `Published announcement: "${data.title}"`,
      });
    }

    const names = await clubNameMap([created.club_id]);
    return mapAnnouncement(created, names);
  }

  const db = getLocalDb();
  const club = data.clubId ? db.clubs.find((c) => c.id === data.clubId) : null;
  const newAnn: AnnouncementItem = {
    id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    clubId: data.clubId || undefined,
    clubName: club?.name,
    title: data.title,
    content: data.content,
    postedByName: data.postedByName,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  db.announcements.unshift(newAnn);
  saveLocalDb(db);

  if (actor) {
    await logAuditAction({
      actionType: 'ANNOUNCEMENT_CREATION',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: newAnn.id,
      details: `Published announcement: "${data.title}"`,
    });
  }

  return newAnn;
};

export const updateAnnouncement = async (
  announcementId: string,
  data: { title: string; content: string },
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('announcements')
      .update({ title: data.title, body: data.content })
      .eq('id', announcementId);

    if (error) throw error;
  } else {
    const db = getLocalDb();
    const idx = db.announcements.findIndex((a) => a.id === announcementId);
    if (idx !== -1) {
      db.announcements[idx].title = data.title;
      db.announcements[idx].content = data.content;
      saveLocalDb(db);
    }
  }

  if (actor) {
    await logAuditAction({
      actionType: 'ANNOUNCEMENT_UPDATE',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: announcementId,
      details: `Updated announcement: "${data.title}"`,
    });
  }
};

export const toggleAnnouncementStatus = async (
  announcementId: string,
  isActive: boolean,
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('announcements')
      .update({ published: isActive })
      .eq('id', announcementId);

    if (error) throw error;
  } else {
    const db = getLocalDb();
    const idx = db.announcements.findIndex((a) => a.id === announcementId);
    if (idx !== -1) {
      db.announcements[idx].isActive = isActive;
      saveLocalDb(db);
    }
  }

  if (actor) {
    await logAuditAction({
      actionType: 'ANNOUNCEMENT_STATUS_TOGGLE',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: announcementId,
      details: `Set announcement ${announcementId} active state to ${isActive}`,
    });
  }
};

export const deleteAnnouncement = async (
  announcementId: string,
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('announcements').delete().eq('id', announcementId);
    if (error) throw error;
  } else {
    const db = getLocalDb();
    db.announcements = db.announcements.filter((a) => a.id !== announcementId);
    db.user_announcement_reads = db.user_announcement_reads.filter((r) => r.announcementId !== announcementId);
    saveLocalDb(db);
  }

  if (actor) {
    await logAuditAction({
      actionType: 'ANNOUNCEMENT_DELETION',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: announcementId,
      details: `Deleted announcement ID ${announcementId}`,
    });
  }
};

export const markAnnouncementAsRead = async (
  announcementId: string,
  userId: string
): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('user_announcement_reads')
      .insert([{ announcement_id: announcementId, user_id: userId }]);

    if (error && error.code !== '23505') throw error;
  } else {
    const db = getLocalDb();
    const exists = db.user_announcement_reads.some(
      (r) => r.announcementId === announcementId && r.userId === userId
    );
    if (!exists) {
      db.user_announcement_reads.push({
        id: `read-${Date.now()}`,
        announcementId,
        userId,
        readAt: new Date().toISOString(),
      });
      saveLocalDb(db);
    }
  }
};
