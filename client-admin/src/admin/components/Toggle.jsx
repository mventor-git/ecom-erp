/**
 * Toggle — reliable state-driven on/off switch.
 * No peer/after CSS tricks: the knob position is computed from React state,
 * so it can never drift outside the track.
 */
export default function Toggle({ checked, onChange, disabled = false, size = 'md', label = '' }) {
  const track = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6';
  const knob = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const onPos = size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[22px]';
  const offPos = 'translate-x-0.5';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label || 'Toggle'}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative ${track} rounded-full transition-colors duration-200 shrink-0 ${
        checked ? 'bg-primary-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0 ${knob} bg-white rounded-full shadow transition-transform duration-200 ${
          checked ? onPos : offPos
        }`}
      />
    </button>
  );
}
