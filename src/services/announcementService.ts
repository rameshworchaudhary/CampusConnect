import { supabase, isSupabaseConfigured, getLocalDb, saveLocalDb } from '../lib/supabase';
import { AnnouncementItem } from '../types';
import { logAuditAction } from './auditService';
import { getStorageObjectPath, STORAGE_BUCKETS, deleteImage, deleteReplacedImage } from './storageService';

const isMissingImagePathColumn = (error: any): boolean =>
  (error?.code === '42703' || error?.code === 'PGRST204') && /image_path/i.test(error?.message || '');

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

const mapAnnouncement = (row: any, names: Map<string, string>, readIds = new Set<string>()): AnnouncementItem => {
  const imagePath = getStorageObjectPath(STORAGE_BUCKETS.announcementImages, row.image_path);
  return {
  id: row.id,
  clubId: row.club_id || undefined,
  clubName: row.club_id ? names.get(row.club_id) : undefined,
  title: row.title,
  content: row.body || '',
  postedByName: row.created_by || 'CampusConnect',
  isActive: Boolean(row.published),
  isRead: readIds.has(row.id),
  createdAt: row.created_at,
  imagePath,
  imageUrl: imagePath,
};
};

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
    return Promise.all(rows.map((row) => mapAnnouncement(row, names, readIds)));
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
    return Promise.all(rows.map((row) => mapAnnouncement(row, names)));
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
    imagePath?: string | null;
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
          ...(data.imagePath ? { image_path: data.imagePath } : {}),
        },
      ])
      .select('*')
      .single();

    if (error) {
      await deleteImage(STORAGE_BUCKETS.announcementImages, data.imagePath).catch((cleanupError) => console.warn('Could not clean up unreferenced announcement image:', cleanupError));
      throw error;
    }

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
    imagePath: data.imagePath || undefined,
    imageUrl: data.imagePath,
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
  data: { title: string; content: string; imagePath?: string | null },
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    let previousImagePath: string | null = null;
    let imageColumnAvailable = true;
    if (data.imagePath !== undefined) {
      const { data: existing, error: fetchError } = await supabase.from('announcements').select('image_path').eq('id', announcementId).maybeSingle();
      if (fetchError && !isMissingImagePathColumn(fetchError)) throw fetchError;
      if (fetchError) {
        imageColumnAvailable = false;
        if (data.imagePath) throw new Error('Announcement images are unavailable until the image_path schema change is deployed. No announcement update was made.');
      } else {
        previousImagePath = existing?.image_path || null;
      }
    }
    const { data: updated, error } = await supabase
      .from('announcements')
      .update({ title: data.title, body: data.content, ...(data.imagePath !== undefined && imageColumnAvailable ? { image_path: data.imagePath } : {}) })
      .eq('id', announcementId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!updated) throw new Error('Announcement update affected no rows; its existing image was kept.');
    if (data.imagePath !== undefined && imageColumnAvailable) await deleteReplacedImage(STORAGE_BUCKETS.announcementImages, previousImagePath, data.imagePath);
  } else {
    const db = getLocalDb();
    const idx = db.announcements.findIndex((a) => a.id === announcementId);
    if (idx === -1) throw new Error('Announcement was not found. Refresh the list and try again.');
    db.announcements[idx].title = data.title;
    db.announcements[idx].content = data.content;
    if (data.imagePath !== undefined) {
      db.announcements[idx].imagePath = data.imagePath || undefined;
      db.announcements[idx].imageUrl = data.imagePath || undefined;
    }
    saveLocalDb(db);
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
    const { data, error } = await supabase
      .from('announcements')
      .update({ published: isActive })
      .eq('id', announcementId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Announcement status was not changed. Confirm that the announcement exists and you can manage it.');
  } else {
    const db = getLocalDb();
    const idx = db.announcements.findIndex((a) => a.id === announcementId);
    if (idx === -1) throw new Error('Announcement was not found. Refresh the list and try again.');
    db.announcements[idx].isActive = isActive;
    saveLocalDb(db);
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
    const { data: existing, error: fetchError } = await supabase.from('announcements').select('image_path').eq('id', announcementId).maybeSingle();
    if (fetchError && !isMissingImagePathColumn(fetchError)) throw fetchError;
    const { data: deleted, error } = await supabase.from('announcements').delete().eq('id', announcementId).select('id').maybeSingle();
    if (error) throw error;
    if (!deleted) throw new Error('Announcement deletion affected no rows; its image was kept.');
    if (existing?.image_path) await deleteReplacedImage(STORAGE_BUCKETS.announcementImages, existing.image_path, null);
  } else {
    const db = getLocalDb();
    if (!db.announcements.some((announcement) => announcement.id === announcementId)) {
      throw new Error('Announcement was not found. Refresh the list and try again.');
    }
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
