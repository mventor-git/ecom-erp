import { useState, useRef, useCallback } from 'react';
import { uploadImage } from '../api/adminApi';

function parseVariantAttrs(img) {
  if (!img.variant_attributes) return {};
  if (typeof img.variant_attributes === 'object') return img.variant_attributes;
  try { return JSON.parse(img.variant_attributes); } catch { return {}; }
}

function VariantBadge({ attrs, colors, sizes }) {
  const tags = [];
  if (attrs.color) tags.push({ label: attrs.color, type: 'color' });
  if (attrs.size) tags.push({ label: attrs.size, type: 'size' });

  if (tags.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-1 flex flex-wrap gap-0.5 max-w-[90%]">
      {tags.map((tag, i) => (
        <span
          key={i}
          className={`text-[9px] px-1 py-0.5 rounded font-medium ${
            tag.type === 'color' ? 'bg-indigo-500/80 text-white' : 'bg-emerald-500/80 text-white'
          }`}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}

function VariantSelector({ colors, sizes, selected, onChange }) {
  const parsedColors = Array.isArray(colors) ? colors : [];
  const parsedSizes = Array.isArray(sizes) ? sizes : [];
  const hasVariants = parsedColors.length > 0 || parsedSizes.length > 0;

  if (!hasVariants) return null;

  const selColors = Array.isArray(selected?.color) ? selected.color : [];
  const selSizes = Array.isArray(selected?.size) ? selected.size : [];

  const toggleColor = (colorName) => {
    const next = selColors.includes(colorName)
      ? selColors.filter(c => c !== colorName)
      : [...selColors, colorName];
    onChange({ color: next, size: selSizes });
  };

  const toggleSize = (sizeName) => {
    const next = selSizes.includes(sizeName)
      ? selSizes.filter(s => s !== sizeName)
      : [...selSizes, sizeName];
    onChange({ color: selColors, size: next });
  };

  return (
    <div className="space-y-2">
      {parsedColors.length > 0 && (
        <div>
          <span className="text-xs font-medium text-gray-600 block mb-1">Colors:</span>
          <div className="flex flex-wrap gap-1">
            {parsedColors.map((c, i) => {
              const name = typeof c === 'string' ? c : c.name;
              const hex = typeof c === 'object' ? c.hex : null;
              const isActive = selColors.includes(name);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleColor(name)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-all ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {hex && (
                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block flex-shrink-0" style={{ backgroundColor: hex }} />
                  )}
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {parsedSizes.length > 0 && (
        <div>
          <span className="text-xs font-medium text-gray-600 block mb-1">Sizes:</span>
          <div className="flex flex-wrap gap-1">
            {parsedSizes.map((s, i) => {
              const name = typeof s === 'string' ? s : s.name;
              const isActive = selSizes.includes(name);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleSize(name)}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-all ${
                    isActive
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductGallery({ images = [], onAdd, onReorder, onDelete, onUpdate, colors = [], sizes = [] }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [editingImageId, setEditingImageId] = useState(null);
  const [editVariant, setEditVariant] = useState({ color: [], size: [] });
  const inputRef = useRef(null);

  const current = Array.isArray(images) ? images : [];
  const hasVariants = (Array.isArray(colors) && colors.length > 0) || (Array.isArray(sizes) && sizes.length > 0);

  const handleFile = useCallback(async (file) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    const MAX_SIZE = 5 * 1024 * 1024;

    setError('');

    if (!ALLOWED.includes(file.type)) {
      setError('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('File too large. Maximum size is 5MB.');
      return;
    }

    setUploading(true);
    try {
      const res = await uploadImage(file);
      await onAdd(res.data.url);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [onAdd]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

  const handleClickUpload = () => inputRef.current?.click();

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragEnter = (index) => {
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDropReorder = () => {
    if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...current];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(dragOverIndex, 0, moved);

    onReorder(reordered.map(img => img.id));
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDelete = async (imageId) => {
    if (!window.confirm('Delete this image?')) return;
    try {
      await onDelete(imageId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete image');
    }
  };

  const openVariantEditor = (img) => {
    const attrs = parseVariantAttrs(img);
    setEditVariant({
      color: attrs.color ? (Array.isArray(attrs.color) ? attrs.color : [attrs.color]) : [],
      size: attrs.size ? (Array.isArray(attrs.size) ? attrs.size : [attrs.size]) : [],
    });
    setEditingImageId(img.id);
  };

  const saveVariantEdit = async () => {
    if (!onUpdate || !editingImageId) return;
    const attrs = {};
    if (editVariant.color.length > 0) attrs.color = editVariant.color;
    if (editVariant.size.length > 0) attrs.size = editVariant.size;
    try {
      await onUpdate(editingImageId, attrs);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update image variants');
    }
    setEditingImageId(null);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Product Gallery
        <span className="text-xs text-gray-400 ml-2 font-normal">
          — Multiple photos, drag to reorder{hasVariants ? ', click image to assign variants' : ''}
        </span>
      </label>

      {current.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {current.map((img, i) => {
            const attrs = parseVariantAttrs(img);
            const hasAssigned = (attrs.color && attrs.color.length > 0) || (attrs.size && attrs.size.length > 0);
            return (
              <div
                key={img.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragEnter={() => handleDragEnter(i)}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDropReorder}
                onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                className={`
                  relative aspect-square rounded-lg overflow-hidden border-2 bg-gray-50 cursor-grab active:cursor-grabbing
                  ${draggedIndex === i ? 'opacity-50 border-primary-400' : ''}
                  ${dragOverIndex === i ? 'border-primary-500 scale-105' : 'border-gray-200'}
                  transition-all duration-200 group
                `}
              >
                <img
                  src={img.image_url}
                  alt={`Gallery ${i + 1}`}
                  className="w-full h-full object-cover pointer-events-none"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-300 text-xs">Broken</div>';
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleDelete(img.id)}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete image"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {hasVariants && (
                  <button
                    type="button"
                    onClick={() => openVariantEditor(img)}
                    className={`absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
                      hasAssigned ? 'bg-indigo-500 hover:bg-indigo-600 text-white' : 'bg-black/50 hover:bg-black/70 text-white'
                    }`}
                    title="Assign variants"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </button>
                )}
                <VariantBadge attrs={attrs} />
                <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {i + 1}
                </span>
                <div className="absolute inset-x-0 top-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <svg className="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingImageId && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-indigo-800">Assign Variants</h4>
            <div className="flex gap-2">
              <button type="button" onClick={saveVariantEdit} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700">
                Save
              </button>
              <button type="button" onClick={() => setEditingImageId(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
                Cancel
              </button>
            </div>
          </div>
          <VariantSelector
            colors={colors}
            sizes={sizes}
            selected={editVariant}
            onChange={setEditVariant}
          />
          <p className="text-xs text-gray-500">
            Leave empty to show this image for all variants.
          </p>
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClickUpload}
        className={`
          border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200
          ${uploading
            ? 'border-primary-400 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }
        `}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Uploading...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 4v12m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
              />
            </svg>
            <span className="text-sm text-gray-500">
              <span className="text-primary-600 font-medium">Click to upload</span> or drag image here
            </span>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        onChange={handleInputChange} className="hidden" />

      {error && <p className="text-sm text-red-500">{error}</p>}

      {current.length === 0 && !error && (
        <p className="text-xs text-gray-400">No gallery images yet. Upload photos to show on the product page.</p>
      )}
    </div>
  );
}
