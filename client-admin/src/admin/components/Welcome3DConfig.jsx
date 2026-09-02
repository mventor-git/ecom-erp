import { useState, useEffect, useRef } from 'react';
import { getPublicSettings, updateSetting, uploadModel } from '../../api/adminApi';
import { useLanguage } from '../../i18n';

/**
 * 3D Showcase — admin controls for the welcome-page 3D model.
 * Upload a .glb (e.g. exported from Meshy), pick the motion preset and
 * which embedded clip plays, tune scale/speed. Saves straight to settings.
 */
export default function Welcome3DConfig() {
  const { t } = useLanguage();
  const fileRef = useRef(null);
  const [cfg, setCfg] = useState({ enabled: false, url: '', motion: 'float', clip: '', scale: 1, speed: 1 });
  const [clips, setClips] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPublicSettings()
      .then(rows => {
        const map = Object.fromEntries((rows || []).map(r => [r.key, r.value]));
        setCfg({
          enabled: map.welcome_3d_enabled === true || map.welcome_3d_enabled === 'true' || map.welcome_3d_enabled === 1 || map.welcome_3d_enabled === '1',
          url: map.welcome_3d_model_url || '',
          motion: map.welcome_3d_motion || 'float',
          clip: map.welcome_3d_clip || '',
          scale: Number(map.welcome_3d_scale) || 1,
          speed: Number(map.welcome_3d_speed) || 1,
        });
      })
      .catch(() => {});
  }, []);

  const save = async (key, value) => {
    setBusy(true);
    try {
      await updateSetting(key, value);
      setStatus(t('Saved'));
      setTimeout(() => setStatus(''), 1600);
    } catch (err) {
      setStatus(err.response?.data?.error || 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(t('Loading...'));
    try {
      const res = await uploadModel(file);
      setCfg(c => ({ ...c, url: res.data.url }));
      await save('welcome_3d_model_url', res.data.url);
    } catch (err) {
      setStatus(err.response?.data?.error || 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-gray-900">{t('3D Showcase')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('Floating 3D model on the welcome page — upload a .glb (Meshy, Sketchfab, …)')}
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={e => { const v = e.target.checked; setCfg(c => ({ ...c, enabled: v })); save('welcome_3d_enabled', v); }}
            className="rounded border-gray-300 text-primary-600"
          />
          <span className="text-sm font-medium text-gray-700">{t('Enabled')}</span>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        {/* Model file */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('Model (.glb / .gltf)')}</label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={cfg.url}
              placeholder="—"
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-xs bg-gray-50"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="shrink-0 text-xs px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {t('Upload')}
            </button>
            <input ref={fileRef} type="file" accept=".glb,.gltf,model/gltf-binary" onChange={handleFile} hidden />
          </div>
        </div>

        {/* Motion preset */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('Motion')}</label>
          <select
            value={cfg.motion}
            onChange={e => { setCfg(c => ({ ...c, motion: e.target.value })); save('welcome_3d_motion', e.target.value); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="float">Float</option>
            <option value="spin">Spin</option>
            <option value="none">None</option>
          </select>
        </div>

        {/* Clip */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('Animation clip')}</label>
          <input
            value={cfg.clip}
            onChange={e => setCfg(c => ({ ...c, clip: e.target.value }))}
            onBlur={() => save('welcome_3d_clip', cfg.clip)}
            placeholder={t('(first found)')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Scale */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('Scale')}: {cfg.scale.toFixed(2)}
          </label>
          <input type="range" min="0.2" max="3" step="0.05" value={cfg.scale}
            onChange={e => setCfg(c => ({ ...c, scale: Number(e.target.value) }))}
            onMouseUp={() => save('welcome_3d_scale', cfg.scale)}
            onTouchEnd={() => save('welcome_3d_scale', cfg.scale)}
            className="w-full accent-primary-600" />
        </div>

        {/* Speed */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {t('Speed')}: {cfg.speed.toFixed(2)}
          </label>
          <input type="range" min="0.2" max="3" step="0.05" value={cfg.speed}
            onChange={e => setCfg(c => ({ ...c, speed: Number(e.target.value) }))}
            onMouseUp={() => save('welcome_3d_speed', cfg.speed)}
            onTouchEnd={() => save('welcome_3d_speed', cfg.speed)}
            className="w-full accent-primary-600" />
        </div>
      </div>

      {status && <p className="mt-3 text-xs font-medium text-primary-700">{status}</p>}
    </div>
  );
}
