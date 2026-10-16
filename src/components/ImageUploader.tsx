import React, { useState, useRef } from 'react';
import { uploadImage, deleteImage, validateImageFile } from '../services/storageService';

interface ImageUploaderProps {
  bucket: 'club-logos' | 'event-posters' | 'avatars';
  label: string;
  currentImageUrl?: string;
  onImageUploaded: (url: string, path: string) => void;
  onImageRemoved?: () => void;
  helperText?: string;
  aspectRatio?: 'square' | 'banner';
  folderId?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  bucket,
  label,
  currentImageUrl,
  onImageUploaded,
  onImageRemoved,
  helperText = 'JPG, PNG or WebP (max 5 MB)',
  aspectRatio = 'square',
  folderId,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file format');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setLoading(true);
      setProgress(10);
      const result = await uploadImage(bucket, file, (percent) => setProgress(percent), folderId);
      setPreviewUrl(result.url);
      setUploadedPath(result.path);
      onImageUploaded(result.url, result.path);
    } catch (err: any) {
      setError(err.message || 'Image upload failed. Please try again.');
    } finally {
      setLoading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (uploadedPath) {
      try {
        await deleteImage(bucket, uploadedPath);
      } catch (err) {
        console.warn('Could not remove remote image:', err);
      }
    }
    setPreviewUrl(null);
    setUploadedPath(null);
    setError(null);
    if (onImageRemoved) onImageRemoved();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
        {label}
      </span>

      {previewUrl ? (
        <div className="relative border border-border-default rounded-xl overflow-hidden bg-surface-container-low flex flex-col items-center justify-center p-3">
          <div
            className={`w-full ${
              aspectRatio === 'square' ? 'max-w-[140px] h-32' : 'h-36 max-w-full'
            } rounded-lg overflow-hidden border border-border-default bg-surface flex items-center justify-center relative`}
          >
            <img
              src={previewUrl}
              alt="Uploaded Preview"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="h-8 px-3 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors border border-border-default flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
              <span>Replace</span>
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={loading}
              className="h-8 px-3 rounded-lg text-on-surface hover:text-primary text-xs font-semibold hover:bg-surface-container transition-colors flex items-center gap-1 underline"
            >
              <span className="material-symbols-outlined text-[15px]">delete</span>
              <span>Remove</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-border-default hover:border-black rounded-xl p-4 flex flex-col items-center justify-center text-center bg-surface-container-low hover:bg-surface-container transition-colors group"
        >
          <span className="material-symbols-outlined text-[28px] text-on-surface-variant group-hover:text-primary transition-colors">
            add_photo_alternate
          </span>
          <span className="text-xs font-semibold text-on-surface mt-1">
            {loading ? 'Uploading Image...' : 'Click to Upload Image'}
          </span>
          <span className="text-[10px] text-on-surface-variant mt-0.5">{helperText}</span>
        </div>
      )}

      {loading && (
        <div className="w-full flex flex-col gap-1 mt-1">
          <div className="flex justify-between text-[11px] text-on-surface-variant">
            <span>Uploading...</span>
            <span className="font-semibold">{progress}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-150"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-on-surface font-medium mt-0.5 border border-border-default bg-surface-container p-2 rounded-lg">
          {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
