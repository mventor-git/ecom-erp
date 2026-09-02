import { cn } from './utils';

/**
 * shadcn/ui-style Card primitives — the formal container for every panel.
 * Soft border, subtle shadow, rounded-xl, clean header/content separation.
 */
export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1 p-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn('text-sm font-semibold leading-none tracking-tight text-gray-900', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('text-xs text-gray-500', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('flex items-center p-5 pt-0', className)} {...props} />;
}
