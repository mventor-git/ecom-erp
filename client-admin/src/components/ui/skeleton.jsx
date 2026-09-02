import { cn } from './utils';

export function Skeleton({ className, ...props }) {
  return <div className={cn('animate-pulse rounded-md bg-gray-200', className)} {...props} />;
}
