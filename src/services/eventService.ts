import { supabase, isSupabaseConfigured, getLocalDb, saveLocalDb } from '../lib/supabase';
import { EventItem } from '../types';
import { logAuditAction } from './auditService';

const eventStartTimestamp = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Enter a valid event date and time, for example: Dec 22, 2026 10:00 AM.');
  }
  return parsed.toISOString();
};

const formatEventStart = (value?: string | null): string => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const getClubNames = async (clubIds: Array<string | null | undefined>) => {
  const ids = [...new Set(clubIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map<string, string>();

  const { data, error } = await supabase.from('clubs').select('id, name').in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((club) => [club.id, club.name]));
};

const toEventItem = (row: any, clubName?: string, registrations: any[] = []): EventItem => ({
  id: row.id,
  clubId: row.club_id || undefined,
  clubName,
  title: row.title,
  description: row.description,
  eventDate: formatEventStart(row.starts_at),
  location: row.venue || '',
  eventLink: row.event_link || undefined,
  posterUrl: row.poster_path || undefined,
  capacity: row.capacity ?? 100,
  registeredCount: row.registered_count ?? registrations.filter((r) => r.status === 'REGISTERED').length,
  isPublished: Boolean(row.published),
  isPlatformEvent: Boolean(row.is_platform_event ?? !row.club_id),
  badgeLabel: row.badge_label || (row.club_id ? 'Club Event' : 'Open RSVP'),
});

export const getPublicEvents = async (userId?: string): Promise<EventItem[]> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = data || [];
    const [clubNames, registrationData] = await Promise.all([
      getClubNames(rows.map((row) => row.club_id)),
      userId && rows.length
        ? supabase
            .from('event_registrations')
            .select('event_id, status')
            .eq('user_id', userId)
            .eq('status', 'REGISTERED')
            .in('event_id', rows.map((row) => row.id))
        : Promise.resolve({ data: [], error: null }),
    ]);
    if ('error' in registrationData && registrationData.error) throw registrationData.error;
    const registeredEventIds = new Set((registrationData.data || []).map((row: any) => row.event_id));

    return rows.map((row) => {
      return {
        ...toEventItem(row, row.club_id ? clubNames.get(row.club_id) : undefined),
        isUserRegistered: registeredEventIds.has(row.id),
      };
    });
  }

  const db = getLocalDb();
  const published = (db.events || []).filter((e) => e.isPublished);

  return published.map((evt) => {
    const registrations = (db.event_registrations || []).filter(
      (r) => r.eventId === evt.id && r.status === 'REGISTERED'
    );
    const isUserRegistered = userId
      ? registrations.some((r) => r.userId === userId)
      : false;

    return {
      ...evt,
      registeredCount: registrations.length,
      isUserRegistered,
    };
  });
};

export const getAllEvents = async (): Promise<EventItem[]> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = data || [];
    const clubNames = await getClubNames(rows.map((row) => row.club_id));
    return rows.map((row) => toEventItem(row, row.club_id ? clubNames.get(row.club_id) : undefined));
  }

  const db = getLocalDb();
  return (db.events || []).map((evt) => {
    const regCount = (db.event_registrations || []).filter(
      (r) => r.eventId === evt.id && r.status === 'REGISTERED'
    ).length;
    return {
      ...evt,
      registeredCount: regCount,
    };
  });
};

export const getEventsForClub = async (clubId: string): Promise<EventItem[]> => {
  const all = await getAllEvents();
  return all.filter((e) => e.clubId === clubId);
};

export const getUserRegisteredEvents = async (userId: string): Promise<EventItem[]> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('event_registrations')
      .select('event_id')
      .eq('user_id', userId)
      .eq('status', 'REGISTERED');

    if (error) throw error;

    const eventIds = [...new Set((data || []).map((row) => row.event_id))];
    if (eventIds.length === 0) return [];
    const { data: rows, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .in('id', eventIds);
    if (eventsError) throw eventsError;
    const clubNames = await getClubNames(rows.map((evt: any) => evt.club_id));
    return (rows || []).map((evt: any) => ({
      ...toEventItem(evt, evt.club_id ? clubNames.get(evt.club_id) : undefined),
      isUserRegistered: true,
    }));
  }

  const db = getLocalDb();
  const registeredEventIds = (db.event_registrations || [])
    .filter((r) => r.userId === userId && r.status === 'REGISTERED')
    .map((r) => r.eventId);

  return (db.events || [])
    .filter((e) => registeredEventIds.includes(e.id))
    .map((e) => ({ ...e, isUserRegistered: true }));
};

export const createEvent = async (
  eventData: {
    clubId?: string | null;
    title: string;
    description?: string;
    eventDate: string;
    location: string;
    eventLink?: string;
    posterUrl?: string;
    capacity: number;
    badgeLabel?: string;
    isPlatformEvent?: boolean;
    isPublished?: boolean;
  },
  actor?: { id: string; email: string; role: string }
): Promise<EventItem> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          club_id: eventData.clubId || null,
          title: eventData.title,
          description: eventData.description,
          starts_at: eventStartTimestamp(eventData.eventDate),
          venue: eventData.location,
          event_link: eventData.eventLink,
          poster_path: eventData.posterUrl,
          capacity: eventData.capacity,
          badge_label: eventData.badgeLabel || 'Open RSVP',
          is_platform_event: eventData.isPlatformEvent || false,
          published: eventData.isPublished !== undefined ? eventData.isPublished : true,
          created_by: actor?.id,
        },
      ])
      .select('*')
      .single();

    if (error) throw error;

    if (actor) {
      await logAuditAction({
        actionType: 'EVENT_CREATION',
        actorEmail: actor.email,
        actorRole: actor.role,
        targetIdentifier: data.id,
        details: `Created event "${eventData.title}" on ${eventData.eventDate}`,
      });
    }

    const clubNames = await getClubNames([data.club_id]);
    return toEventItem(data, data.club_id ? clubNames.get(data.club_id) : undefined);
  }

  const db = getLocalDb();
  const club = eventData.clubId ? db.clubs.find((c) => c.id === eventData.clubId) : null;
  const newEvent: EventItem = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    clubId: eventData.clubId || undefined,
    clubName: club?.name,
    title: eventData.title,
    description: eventData.description,
    eventDate: eventData.eventDate,
    location: eventData.location,
    eventLink: eventData.eventLink,
    posterUrl: eventData.posterUrl,
    capacity: eventData.capacity,
    registeredCount: 0,
    isPublished: eventData.isPublished !== undefined ? eventData.isPublished : true,
    isPlatformEvent: eventData.isPlatformEvent || false,
    badgeLabel: eventData.badgeLabel || 'Open RSVP',
  };

  db.events.unshift(newEvent);
  saveLocalDb(db);

  if (actor) {
    await logAuditAction({
      actionType: 'EVENT_CREATION',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: newEvent.id,
      details: `Created event "${eventData.title}" on ${eventData.eventDate}`,
    });
  }

  return newEvent;
};

export const updateEvent = async (
  eventId: string,
  updates: Partial<EventItem>,
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const payload: any = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.eventDate !== undefined) payload.starts_at = eventStartTimestamp(updates.eventDate);
    if (updates.location !== undefined) payload.venue = updates.location;
    if (updates.eventLink !== undefined) payload.event_link = updates.eventLink;
    if (updates.posterUrl !== undefined) payload.poster_path = updates.posterUrl;
    if (updates.capacity !== undefined) payload.capacity = updates.capacity;
    if (updates.isPublished !== undefined) payload.published = updates.isPublished;
    if (updates.badgeLabel !== undefined) payload.badge_label = updates.badgeLabel;

    const { error } = await supabase.from('events').update(payload).eq('id', eventId);
    if (error) throw error;
  } else {
    const db = getLocalDb();
    const idx = db.events.findIndex((e) => e.id === eventId);
    if (idx !== -1) {
      db.events[idx] = { ...db.events[idx], ...updates };
      saveLocalDb(db);
    }
  }

  if (actor) {
    await logAuditAction({
      actionType: 'EVENT_UPDATE',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: eventId,
      details: `Updated event ID ${eventId}`,
    });
  }
};

export const deleteEvent = async (
  eventId: string,
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) throw error;
  } else {
    const db = getLocalDb();
    db.events = db.events.filter((e) => e.id !== eventId);
    db.event_registrations = db.event_registrations.filter((r) => r.eventId !== eventId);
    saveLocalDb(db);
  }

  if (actor) {
    await logAuditAction({
      actionType: 'EVENT_DELETION',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: eventId,
      details: `Deleted event ID ${eventId}`,
    });
  }
};

export const registerForEvent = async (
  eventId: string,
  userId: string,
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('event_registrations')
      .insert([{ event_id: eventId, user_id: userId, status: 'REGISTERED' }]);

    if (error) {
      if (error.code === '23505') throw new Error('You have already registered for this event.');
      throw error;
    }
  } else {
    const db = getLocalDb();
    const already = (db.event_registrations || []).some(
      (r) => r.eventId === eventId && r.userId === userId && r.status === 'REGISTERED'
    );
    if (already) throw new Error('You have already registered for this event.');

    db.event_registrations.push({
      id: `reg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      eventId,
      userId,
      status: 'REGISTERED',
      registeredAt: new Date().toISOString(),
    });
    saveLocalDb(db);
  }

  if (actor) {
    await logAuditAction({
      actionType: 'EVENT_REGISTRATION',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: eventId,
      details: `Registered user for event ID ${eventId}`,
    });
  }
};

export const cancelEventRegistration = async (
  eventId: string,
  userId: string,
  actor?: { email: string; role: string }
): Promise<void> => {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('event_registrations')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);

    if (error) throw error;
  } else {
    const db = getLocalDb();
    db.event_registrations = db.event_registrations.filter(
      (r) => !(r.eventId === eventId && r.userId === userId)
    );
    saveLocalDb(db);
  }

  if (actor) {
    await logAuditAction({
      actionType: 'EVENT_REGISTRATION_CANCEL',
      actorEmail: actor.email,
      actorRole: actor.role,
      targetIdentifier: eventId,
      details: `Cancelled registration for event ID ${eventId}`,
    });
  }
};
