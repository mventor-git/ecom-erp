/**
 * StoreIconPicker — visual chooser for the storefront stroke-icon set.
 * The customer site renders trust badges / features from
 * `client/src/components/Icon.jsx` (zero-emoji policy); this picker mirrors
 * those exact paths so admins pick what shoppers will actually see.
 */
import { useEffect, useRef, useState } from 'react';

const PATHS = {
  box: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5m0 0l9-5M12 13v8',
  truck: 'M2 7h11v9H2zM13 10h5l3 3v3h-8zM6.5 19a1.75 1.75 0 100-3.5 1.75 1.75 0 000 3.5zm11 0a1.75 1.75 0 100-3.5 1.75 1.75 0 000 3.5z',
  shield: 'M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3zm-2.5 9l2 2 3.5-4',
  chat: 'M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z',
  bolt: 'M13 2L4.5 13H11l-1 9L18.5 11H12l1-9z',
  cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z',
  stetho: 'M6 3v6a5 5 0 0010 0V6M6 3h2m8 0h-2M11 19h2a4 4 0 004-4v-2m-6 6a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zm3 5h6m-6 4h6m-6 4h4',
  heart: 'M12 20s-7-4.6-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.4-9 9-9 9z',
  star: 'M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6L12 16.8 6.6 19.6l1.1-6L3.2 9.4l6.1-.8L12 3z',
  target: 'M12 12m-9 0a9 9 0 1018 0 9 9 0 10-18 0M12 12m-5 0a5 5 0 1010 0 5 5 0 10-10 0M12 12h.01',
  trophy: 'M8 4h8v6a4 4 0 01-8 0V4zm0 2H5a3 3 0 003 4m8-4h3a3 3 0 01-3 4m-4 4v3m-4 3h8',
  wallet: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm14 5h2m-5 0h.01',
  card: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 4h18M7 15h4',
  phone: 'M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm4 15h2',
  bike: 'M5.5 18a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm13 0a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5.5 14.5L9 7h5m-6 0h5l3.5 7.5M14 7l3 7.5',
  return: 'M9 14l-4-4 4-4M5 10h9a5 5 0 010 10h-3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zm11-13l4 4',
  celebrate: 'M6 20l6-14 6 14M8 14h8M12 6V3M5 8L3 6m16 2l2-2',
  arrowdown: 'M12 4v14m0 0l-6-6m6 6l6-6',
};

function Glyph({ name, className = 'w-5 h-5' }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         className={`${className} shrink-0`} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function StoreIconPicker({ value = '', onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={value || 'Pick an icon'}
        className={`w-[42px] h-[38px] flex items-center justify-center rounded-lg border transition-colors ${
          value ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-300 bg-white text-gray-400'
        } hover:border-primary-400`}
      >
        {value && PATHS[value] ? (
          <Glyph name={value} className="w-5 h-5" />
        ) : (
          <span className="text-xs">{open ? '✕' : '+'}</span>
        )}
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-1 start-0 p-2 w-64 max-w-[80vw] bg-white border border-gray-200 rounded-xl shadow-xl grid grid-cols-6 gap-1">
          {Object.keys(PATHS).map(name => (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => { onChange?.(name === value ? '' : name); setOpen(false); }}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                name === value ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Glyph name={name} className="w-[18px] h-[18px]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
