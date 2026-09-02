/** Tiny class-name joiner (clsx-style, no dependencies). */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
