import React, { useEffect, useState } from 'react';
import { getStorageImageUrlInfo, StorageBucket } from '../services/storageService';
import { supabase } from '../lib/supabase';

interface StorageImageProps {
  bucket: StorageBucket;
  path?: string | null;
  alt: string;
  className?: string;
}

/** Displays a private Storage object and renews its URL before it expires. */
export const StorageImage: React.FC<StorageImageProps> = ({ bucket, path, alt, className }) => {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let expiresAt = 0;
    let timer: ReturnType<typeof setTimeout>;
    let authTimer: ReturnType<typeof setTimeout>;
    setUrl(undefined);
    setFailed(false);
    const issue = async () => {
      if (!path) { if (active) setUrl(undefined); return; }
      try {
        const image = await getStorageImageUrlInfo(bucket, path);
        if (!active) return;
        setUrl(image?.url);
        expiresAt = image?.expiresAt ?? Number.POSITIVE_INFINITY;
        if (Number.isFinite(expiresAt)) {
          timer = setTimeout(issue, Math.max(1_000, expiresAt - Date.now() - 30_000));
        }
      } catch (error) {
        if (active) { setUrl(undefined); setFailed(true); }
        console.warn('Could not load private image URL:', error);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() >= expiresAt - 30_000) void issue();
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setUrl(undefined);
      expiresAt = 0;
      clearTimeout(timer);
      clearTimeout(authTimer);
      authTimer = setTimeout(() => { if (active) void issue(); }, 0);
    });
    void issue();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(authTimer);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [bucket, path]);

  if (url) return <img src={url} alt={alt} className={className} onError={() => { setUrl(undefined); setFailed(true); }} />;
  if (path && failed) return <div role="img" aria-label={`${alt}: image unavailable`} className={`${className || ''} flex items-center justify-center bg-surface-container text-xs text-on-surface-variant`}>Image unavailable</div>;
  return null;
};
