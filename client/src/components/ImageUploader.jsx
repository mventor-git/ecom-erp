import { useState, useRef, useCallback } from 'react';
import { uploadImage } from '../api/products';
import { useLanguage } from '../i18n';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export default function ImageUploader({ value, onChange }) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState(value || null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    setError('');

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(t('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG'));
      return;
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      setError(t('File too large. Maximum size is 5MB.'));
      return;
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    // Upload to server
    setUploading(true);
    try {
      const res = await uploadImage(file);
      onChange(res.data.url);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || t('Upload failed'));
      // Revert preview
      setPreview(value || null);
    } finally {
      setUploading(false);
    }
  }, [onChange, value]);

  // Drag handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleClick = () => inputRef.current?.click();

  const handleInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const handleRemove = useCallback(() => {
    setPreview(null);
    onChange('');
    setError('');
  }, [onChange]);

  // If there's an existing image from URL (not local preview), show it
  const currentPreview = preview || (value ? value : null);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{t('Product Image')}</label>

      {currentPreview ? (
        // Preview mode
        <div className="relative">
          <div className="aspect-video max-h-48 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
            <img
              src={currentPreview}
              alt={t('Product preview')}
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f3f4f6" width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="14">Broken image</text></svg>';
              }}
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleClick}
              disabled={uploading}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
            >
              {uploading ? t('Uploading...') : t('Replace')}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
            >
              {t('Remove')}
            </button>
          </div>
        </div>
      ) : (
        // Drop zone mode
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            dragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">{t('Uploading...')}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm text-gray-600">
                <span className="text-primary-600 font-medium">{t('Click to upload')}</span> {t('or drag and drop')}
              </p>
              <p className="text-xs text-gray-400">{t('JPEG, PNG, GIF, WebP, SVG — up to 5MB')}</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Show current URL value for reference */}
      {value && !preview && (
        <p className="text-xs text-gray-400 truncate">{t('URL')}: {value}</p>
      )}
    </div>
  );
}
