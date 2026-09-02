import { useState } from 'react';

const AVATAR_COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-primary-500', 'bg-primary-500', 'bg-primary-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500',
];

function hashName(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export default function UserAvatar({ user, size = 'sm' }) {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClasses = size === 'lg'
    ? 'w-16 h-16 text-2xl'
    : size === 'md'
      ? 'w-10 h-10 text-base'
      : 'w-7 h-7 text-xs';

  const letter = user?.name?.charAt(0)?.toUpperCase() || '?';
  const color = AVATAR_COLORS[hashName(user?.name || user?.email || '?') % AVATAR_COLORS.length];

  // If there's an avatar_url and it hasn't failed yet, show the image
  if (user?.avatar_url && !imgFailed) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name || 'User'}
        className={`${sizeClasses} rounded-full object-cover shrink-0`}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
      />
    );
  }

  // Fallback: first letter avatar with deterministic color
  return (
    <div className={`${sizeClasses} ${color} rounded-full flex items-center justify-center text-white font-bold shrink-0`}>
      <span>{letter}</span>
    </div>
  );
}
