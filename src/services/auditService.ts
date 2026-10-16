import { supabase, isSupabaseConfigured, getLocalDb, saveLocalDb } from '../lib/supabase';
import { AuditLogItem } from '../types';

export const logAuditAction = async (entry: {
  actionType: string;
  actorEmail: string;
  actorRole: string;
  targetIdentifier?: string;
  details: string;
}): Promise<void> => {
  try {
    if (isSupabaseConfigured) {
      await supabase.from('audit_logs').insert([
        {
          action_type: entry.actionType,
          actor_email: entry.actorEmail,
          actor_role: entry.actorRole,
          target_identifier: entry.targetIdentifier,
          details: entry.details,
          ip_address: 'browser-client',
        },
      ]);
    } else {
      const db = getLocalDb();
      const newLog: AuditLogItem = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        actionType: entry.actionType,
        actorEmail: entry.actorEmail,
        actorRole: entry.actorRole,
        targetIdentifier: entry.targetIdentifier,
        details: entry.details,
        ipAddress: '127.0.0.1',
        createdAt: new Date().toISOString(),
      };
      db.audit_logs.unshift(newLog);
      saveLocalDb(db);
    }
  } catch (err) {
    console.warn('Could not record audit log:', err);
  }
};

export const getAuditLogs = async (): Promise<AuditLogItem[]> => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      actionType: row.action_type,
      actorEmail: row.actor_email,
      actorRole: row.actor_role,
      targetIdentifier: row.target_identifier,
      details: row.details,
      ipAddress: row.ip_address,
      shaHash: row.sha_hash,
      createdAt: row.created_at,
    }));
  }

  const db = getLocalDb();
  return db.audit_logs || [];
};
