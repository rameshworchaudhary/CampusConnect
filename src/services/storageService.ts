import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const STORAGE_BUCKETS = {
  avatars: 'avatars',
  eventPosters: 'event-posters',
  clubLogos: 'club-logos',
  announcementImages: 'announcement-images',
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
// Keep bearer URLs short lived. StorageImage renews them shortly before expiry.
export const SIGNED_URL_TTL_SECONDS = 5 * 60;
const SIGNED_URL_RENEWAL_MARGIN_MS = 30_000;
export interface StorageImageUrlInfo { url: string; expiresAt?: number }
const signedUrlCache = new Map<string, StorageImageUrlInfo>();
const pendingSignedUrls = new Map<string, Promise<StorageImageUrlInfo>>();
let authGeneration = 0;

// Never reuse an in-memory bearer URL across auth state changes.
supabase.auth.onAuthStateChange(() => {
  authGeneration += 1;
  signedUrlCache.clear();
  pendingSignedUrls.clear();
});

export interface UploadResult {
  url: string;
  path: string;
}

export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) return { valid: false, error: 'Invalid file format. Only JPG, PNG, and WebP images are supported.' };
  if (file.size > MAX_FILE_SIZE_BYTES) return { valid: false, error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 5 MB.` };
  return { valid: true };
};

const safeFileExtension = (file: File): string => {
  const extensionByMime: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  return extensionByMime[file.type] || 'jpg';
};

const isUuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const validateObjectPath = (path: string): string | undefined => {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized.length > 1024 || /[\u0000-\u001f\u007f]/.test(normalized)) return undefined;
  if (normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..')) return undefined;
  return normalized;
};

export const getStorageObjectPath = (bucket: StorageBucket, reference?: string | null): string | undefined => {
  if (!reference) return undefined;
  if (!/^https?:\/\//i.test(reference)) return reference;
  try {
    const url = new URL(reference);
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?([^/]+)\/(.+)$/i);
    if (!match || match[1] !== bucket) return reference;
    const decoded = decodeURIComponent(match[2]);
    return validateObjectPath(decoded);
  } catch {
    return undefined;
  }
};

export const getStorageImageUrlInfo = async (bucket: StorageBucket, path?: string | null): Promise<StorageImageUrlInfo | undefined> => {
  if (!path) return undefined;
  if (path.startsWith('data:') || path.startsWith('blob:')) return { url: path };
  const objectPath = getStorageObjectPath(bucket, path);
  if (!objectPath) return undefined;
  // Entity images in these private buckets must be represented by an object
  // path or a Supabase URL for this same bucket. Never render an unknown URL
  // directly as if it were a valid private Storage image.
  if (/^https?:\/\//i.test(objectPath)) {
    throw new Error(`Invalid ${bucket} image reference. Store its private Storage object path instead.`);
  }
  if (!isSupabaseConfigured) return undefined;
  const validPath = validateObjectPath(objectPath);
  if (!validPath) throw new Error(`Invalid ${bucket} image path.`);
  const cacheKey = `${bucket}:${validPath}`;
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt - Date.now() > SIGNED_URL_RENEWAL_MARGIN_MS) return cached;
  const pending = pendingSignedUrls.get(cacheKey);
  if (pending) return pending;

  const requestGeneration = authGeneration;
  const request = (async () => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(validPath, SIGNED_URL_TTL_SECONDS);
    if (error) throw new Error(`Could not access ${bucket} image: ${error.message}`);
    const url = data?.signedUrl;
    if (!url) throw new Error(`Supabase did not return a signed URL for ${bucket}.`);
    if (requestGeneration !== authGeneration) throw new Error('Authentication changed while loading the image. Retry the image request.');
    const result = { url, expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 };
    signedUrlCache.set(cacheKey, result);
    return result;
  })();
  pendingSignedUrls.set(cacheKey, request);
  try {
    return await request;
  } finally {
    pendingSignedUrls.delete(cacheKey);
  }
};

export const getStorageImageUrl = async (bucket: StorageBucket, path?: string | null): Promise<string | undefined> =>
  (await getStorageImageUrlInfo(bucket, path))?.url;

export const uploadImage = async (
  bucket: StorageBucket,
  file: File,
  onProgress?: (percent: number) => void,
  folderId?: string,
): Promise<UploadResult> => {
  const validation = validateImageFile(file);
  if (!validation.valid) throw new Error(validation.error);
  let ownerFolder = folderId;
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error('Sign in before uploading images.');
    // Avatars are always user-owned. The database RLS policy is authoritative
    // for all entity folders, even when a caller supplies folderId.
    ownerFolder = bucket === STORAGE_BUCKETS.avatars ? data.user.id : (folderId || data.user.id);
  }
  const folder = ownerFolder || 'local';
  if (isSupabaseConfigured && !isUuid(folder)) throw new Error('Image folder must be a valid user or club UUID.');
  const filePath = `${folder}/${crypto.randomUUID()}.${safeFileExtension(file)}`;
  if (!isSupabaseConfigured) onProgress?.(10);

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
      cacheControl: '3600', upsert: false, contentType: file.type,
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    if (!data?.path) throw new Error('Upload response did not include the stored object path.');
    try {
      const url = await getStorageImageUrl(bucket, data.path);
      return { path: data.path, url: url || '' };
    } catch (error) {
      await deleteImage(bucket, data.path).catch((cleanupError) => console.warn('Could not clean up an image after its signed preview failed:', cleanupError));
      throw error;
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)); };
    reader.onload = () => {
      onProgress?.(100);
      const dataUrl = reader.result as string;
      resolve({ url: dataUrl, path: dataUrl });
    };
    reader.onerror = () => reject(new Error('Failed to read image file locally.'));
    reader.readAsDataURL(file);
  });
};

export const deleteImage = async (bucket: StorageBucket, path?: string | null): Promise<void> => {
  if (!path || path.startsWith('data:') || path.startsWith('blob:') || !isSupabaseConfigured) return;
  const objectPath = getStorageObjectPath(bucket, path);
  if (!objectPath || /^https?:\/\//i.test(objectPath)) return;
  const validPath = validateObjectPath(objectPath);
  if (!validPath) throw new Error(`Invalid ${bucket} image path; object was not deleted.`);
  const { error } = await supabase.storage.from(bucket).remove([validPath]);
  if (error) throw new Error(`Could not delete ${bucket} image: ${error.message}`);
};

/** Replace the database reference first, then call this to remove its old object. */
export const deleteReplacedImage = async (
  bucket: StorageBucket,
  previousPath?: string | null,
  savedPath?: string | null,
): Promise<void> => {
  if (previousPath && previousPath !== savedPath) {
    try {
      await deleteImage(bucket, previousPath);
    } catch (error) {
      // The database reference has already been saved. Report cleanup without
      // making the completed update look like it failed and inviting a retry.
      console.warn(`Saved the ${bucket} reference but could not remove the replaced object:`, error);
    }
  }
};
