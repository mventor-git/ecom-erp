import { useState } from 'react';

/**
 * SizePicker — Admin editor for product size variants
 *
 * Each size is just a name (no images for now).
 * Admin can add, edit, remove, and reorder sizes.
 *
 * Props:
 *   sizes: Array of { name } objects
 *   onChange: (sizes) => void
 */
export default function SizePicker({ sizes = [], onChange }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');

  const current = Array.isArray(sizes) ? sizes : [];

  const addSize = () => {
    const name = newName.trim();
    if (!name) return;
    const updated = [...current, { name }];
    onChange(updated);
    setNewName('');
  };

  const startEdit = (index) => {
    setEditingIndex(index);
    setEditName(current[index].name);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const name = editName.trim();
    if (!name) return;
    const updated = current.map((s, i) =>
      i === editingIndex ? { ...s, name } : s
    );
    onChange(updated);
    setEditingIndex(null);
    setEditName('');
  };

  const removeSize = (index) => {
    if (!window.confirm(`Remove size "${current[index]?.name}"?`)) return;
    onChange(current.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditName('');
    }
  };

  const moveSize = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= current.length) return;
    const updated = [...current];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  const handleNewKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addSize(); }
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') { setEditingIndex(null); setEditName(''); }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Product Sizes
        <span className="text-xs text-gray-400 ml-2 font-normal">
          — Size variants (e.g. Small, Medium, Large or 55cm, 65cm, 75cm)
        </span>
      </label>

      {current.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {current.map((size, i) => (
            <div key={i} className="group relative">
              {editingIndex === i ? (
                <div className="bg-gray-50 border-2 border-primary-400 rounded-xl p-3 min-w-[160px] space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    placeholder="Size name"
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={saveEdit}
                      disabled={!editName.trim()}
                      className="flex-1 text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingIndex(null); setEditName(''); }}
                      className="flex-1 text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 hover:shadow-sm transition-shadow">
                  <span className="text-sm font-medium text-gray-700 min-w-[40px]">{size.name}</span>
                  <div className="flex gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(i)} className="p-1 text-gray-400 hover:text-primary-600" title="Edit">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => moveSize(i, -1)} className="p-1 text-gray-400 hover:text-gray-600" title="Move left" disabled={i === 0}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button onClick={() => moveSize(i, 1)} className="p-1 text-gray-400 hover:text-gray-600" title="Move right" disabled={i === current.length - 1}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button onClick={() => removeSize(i)} className="p-1 text-gray-400 hover:text-red-600" title="Remove">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editingIndex === null && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={handleNewKeyDown}
            placeholder="e.g. Large, 85cm, 42-43"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button
            onClick={addSize}
            disabled={!newName.trim()}
            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            Add Size
          </button>
        </div>
      )}

      <p className="text-[10px] text-gray-400">
        Tip: Add size variants for products that come in multiple sizes. Customers will see size selector buttons.
      </p>
    </div>
  );
}
