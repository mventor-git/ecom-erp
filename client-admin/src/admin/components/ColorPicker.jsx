import { useState, useRef, useCallback } from 'react';
import { uploadImage } from '../../api/adminApi';

const PRESET_COLORS = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Lime', hex: '#84CC16' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Sky', hex: '#0EA5E9' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Rose', hex: '#F43F5E' },
  { name: 'Black', hex: '#111111' },
  { name: 'White', hex: '#F8F8F8' },
  { name: 'Gray', hex: '#6B7280' },
  { name: 'Brown', hex: '#92400E' },
];

/**
 * Mini inline image uploader for color variant photos.
 */
function ColorImageUploader({ imageUrl, onUpload, onRemove }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    const MAX_SIZE = 5 * 1024 * 1024;

    if (!ALLOWED.includes(file.type)) { alert('Invalid file type'); return; }
    if (file.size > MAX_SIZE) { alert('File too large (max 5MB)'); return; }

    setUploading(true);
    try {
      const res = await uploadImage(file);
      onUpload(res.data.url);
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-2">
      {imageUrl ? (
        <>
          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 shrink-0 bg-gray-50">
            <img src={imageUrl} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50">
            {uploading ? '...' : 'Replace'}
          </button>
          <button type="button" onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-700 font-medium">
            Remove
          </button>
        </>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium border border-dashed border-gray-300 rounded px-2 py-1 hover:border-primary-400 transition-colors disabled:opacity-50">
          {uploading ? (
            <>
              <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              </svg>
              Upload Photo
            </>
          )}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        onChange={handleInputChange} className="hidden" />
    </div>
  );
}

export default function ColorPicker({ colors = [], onChange }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState('');
  const [editHex, setEditHex] = useState('');
  const [editImage, setEditImage] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  const current = Array.isArray(colors) ? colors : [];

  const addColor = (preset) => {
    const newColor = {
      name: preset?.name || editName.trim() || 'New Color',
      hex: preset?.hex || editHex || '#cccccc',
      image_url: editImage || '',
    };
    const updated = [...current, newColor];
    onChange(updated);
    setEditName('');
    setEditHex('');
    setEditImage('');
    setShowPresets(false);
  };

  const startEdit = (index) => {
    const c = current[index];
    setEditingIndex(index);
    setEditName(c.name);
    setEditHex(c.hex);
    setEditImage(c.image_url || '');
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const updated = current.map((c, i) =>
      i === editingIndex
        ? { ...c, name: editName.trim() || c.name, hex: editHex || c.hex, image_url: editImage }
        : c
    );
    onChange(updated);
    setEditingIndex(null);
    setEditName('');
    setEditHex('');
    setEditImage('');
  };

  const removeColor = (index) => {
    if (!window.confirm(`Remove color "${current[index]?.name}"?`)) return;
    onChange(current.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditName('');
      setEditHex('');
      setEditImage('');
    }
  };

  const moveColor = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= current.length) return;
    const updated = [...current];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  // Upload handler for the color being edited
  const handleEditImageUpload = (url) => {
    setEditImage(url);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Product Colors
        <span className="text-xs text-gray-400 ml-2 font-normal">
          — Each color can have its own photo
        </span>
      </label>

      {current.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {current.map((color, i) => (
            <div key={i} className="group relative">
              {editingIndex === i ? (
                <div className="bg-gray-50 border-2 border-primary-400 rounded-xl p-3 min-w-[200px] space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editHex}
                      onChange={e => setEditHex(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Color name"
                      className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ColorImageUploader
                      imageUrl={editImage}
                      onUpload={handleEditImageUpload}
                      onRemove={() => setEditImage('')}
                    />
                    <input
                      type="text"
                      value={editImage}
                      onChange={e => setEditImage(e.target.value)}
                      placeholder="or paste image URL"
                      className="flex-1 min-w-[120px] text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={saveEdit}
                      className="flex-1 text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingIndex(null); setEditName(''); setEditHex(''); setEditImage(''); }}
                      className="flex-1 text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 hover:shadow-sm transition-shadow">
                  <span
                    className="w-6 h-6 rounded-full border border-gray-200 shrink-0"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-sm font-medium text-gray-700">{color.name}</span>
                  {color.image_url && (
                    <div className="w-6 h-6 rounded overflow-hidden border border-gray-200 shrink-0" title="Has custom image">
                      <img src={color.image_url} alt="" className="w-full h-full object-cover"
                        onError={e => { e.target.style.display = 'none'; }} />
                    </div>
                  )}
                  <div className="flex gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(i)} className="p-1 text-gray-400 hover:text-primary-600" title="Edit">✏️</button>
                    <button onClick={() => moveColor(i, -1)} className="p-1 text-gray-400 hover:text-gray-600" title="Move left" disabled={i === 0}>←</button>
                    <button onClick={() => moveColor(i, 1)} className="p-1 text-gray-400 hover:text-gray-600" title="Move right" disabled={i === current.length - 1}>→</button>
                    <button onClick={() => removeColor(i)} className="p-1 text-gray-400 hover:text-red-600" title="Remove">🗑️</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editingIndex === null && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-400 mr-1">Quick add:</span>
            {PRESET_COLORS.slice(0, 10).map(preset => (
              <button
                key={preset.hex}
                onClick={() => addColor(preset)}
                className="group relative"
                title={preset.name}
              >
                <span
                  className="block w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: preset.hex }}
                />
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none">
                  {preset.name}
                </span>
              </button>
            ))}
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="text-xs text-primary-600 hover:text-primary-700 ml-1"
            >
              {showPresets ? 'Less' : `+${PRESET_COLORS.length - 10} more`}
            </button>
          </div>

          {showPresets && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_COLORS.slice(10).map(preset => (
                <button
                  key={preset.hex}
                  onClick={() => addColor(preset)}
                  className="group relative"
                  title={preset.name}
                >
                  <span
                    className="block w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                    style={{ backgroundColor: preset.hex }}
                  />
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none">
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editHex || '#3B82F6'}
                onChange={e => setEditHex(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
              />
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Color name (e.g. 'Midnight Blue')"
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <button
                onClick={() => {
                  if (editName.trim()) {
                    addColor(null);
                  }
                }}
                disabled={!editName.trim()}
                className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                Add Color
              </button>
            </div>
            <div className="flex items-center gap-2">
              <ColorImageUploader
                imageUrl={editImage}
                onUpload={handleEditImageUpload}
                onRemove={() => setEditImage('')}
              />
              <input
                type="text"
                value={editImage}
                onChange={e => setEditImage(e.target.value)}
                placeholder="or paste image URL"
                className="flex-1 min-w-[120px] text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-400">
        Tip: Upload different product photos and link each to a color. Customers will see color swatches and the photo will switch.
      </p>
    </div>
  );
}
