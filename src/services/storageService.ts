import { supabase, isSupabaseConfigured } from '../lib/supabase';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadResult {
  url: string;
  path: string;
}

export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file format. Only JPG, PNG, and WebP images are supported.',
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 5 MB.`,
    };
  }

  return { valid: true };
};

export const uploadImage = async (
  bucket: 'club-logos' | 'event-posters' | 'avatars',
  file: File,
  onProgress?: (percent: number) => void,
  folderId?: string
): Promise<UploadResult> => {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  let ownerFolder = folderId;
  if (!ownerFolder && isSupabaseConfigured) {
    const { data } = await supabase.auth.getUser();
    ownerFolder = data.user?.id;
  }
  if (isSupabaseConfigured && !ownerFolder) throw new Error('Sign in before uploading images.');
  const filePath = `${ownerFolder || 'local'}/${fileName}`;

  if (onProgress) onProgress(30);

  if (isSupabaseConfigured) {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    if (onProgress) onProgress(80);

    const { data: publicUrlData } = bucket === 'avatars'
      ? await supabase.storage.from(bucket).createSignedUrl(filePath, 3600)
      : { data: supabase.storage.from(bucket).getPublicUrl(filePath).data };
    if (!publicUrlData) throw new Error('Image uploaded, but its preview URL could not be created.');

    if (onProgress) onProgress(100);

    return {
      url: 'signedUrl' in publicUrlData ? publicUrlData.signedUrl : publicUrlData.publicUrl,
      path: filePath,
    };
  }

  // Fallback mode when Supabase is not yet configured with remote keys:
  // Convert file to base64 Data URL so user can preview and test uploads locally
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };
    reader.onload = () => {
      if (onProgress) onProgress(100);
      resolve({
        url: reader.result as string,
        path: filePath,
      });
    };
    reader.onerror = () => reject(new Error('Failed to read image file locally.'));
    reader.readAsDataURL(file);
  });
};

export const deleteImage = async (
  bucket: 'club-logos' | 'event-posters' | 'avatars',
  path: string
): Promise<void> => {
  if (isSupabaseConfigured && !path.startsWith('data:')) {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.warn('Storage delete warning:', error.message);
    }
  }
};
