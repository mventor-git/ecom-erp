/**
 * Loading Skeleton Components for Admin Panel
 *
 * Reusable skeleton screens for better perceived performance
 * while data is loading.
 */

// Base skeleton element
export function SkeletonBox({ className = '', animate = true }) {
  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 rounded ${
        animate ? 'animate-pulse' : ''
      } ${className}`}
    />
  );
}

// Admin table skeleton
export function TableSkeleton({ rows = 10, cols = 5 }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {/* Table header */}
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 border-b border-gray-200 dark:border-gray-600">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {[...Array(cols)].map((_, i) => (
            <SkeletonBox key={i} className="h-4 w-24" />
          ))}
        </div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {[...Array(rows)].map((_, rowIndex) => (
          <div key={rowIndex} className="px-6 py-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {[...Array(cols)].map((_, colIndex) => (
                <SkeletonBox key={colIndex} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Dashboard KPI card skeleton
export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="space-y-3 flex-1">
          {/* Label */}
          <SkeletonBox className="h-4 w-32" />

          {/* Value */}
          <SkeletonBox className="h-10 w-40" />

          {/* Change */}
          <SkeletonBox className="h-3 w-24" />
        </div>

        {/* Icon */}
        <SkeletonBox className="w-16 h-16 rounded-lg" />
      </div>
    </div>
  );
}

// Dashboard overview skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-8 w-48" />
        <SkeletonBox className="h-10 w-32 rounded-lg" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <SkeletonBox className="h-6 w-40 mb-4" />
          <SkeletonBox className="h-64 w-full" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <SkeletonBox className="h-6 w-40 mb-4" />
          <SkeletonBox className="h-64 w-full" />
        </div>
      </div>

      {/* Recent orders table */}
      <div>
        <SkeletonBox className="h-6 w-32 mb-4" />
        <TableSkeleton rows={5} cols={5} />
      </div>
    </div>
  );
}

// Product list skeleton
export function ProductListSkeleton({ count = 12 }) {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-10 w-64 rounded-lg" />
        <div className="flex gap-2">
          <SkeletonBox className="h-10 w-32 rounded-lg" />
          <SkeletonBox className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <SkeletonBox className="w-full h-48 mb-4 rounded" />
            <SkeletonBox className="h-5 w-3/4 mb-2" />
            <SkeletonBox className="h-6 w-1/3 mb-3" />
            <SkeletonBox className="h-9 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Form skeleton
export function FormSkeleton({ fields = 8 }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 space-y-6">
      {/* Title */}
      <SkeletonBox className="h-7 w-48" />

      {/* Fields */}
      {[...Array(fields)].map((_, i) => (
        <div key={i} className="space-y-2">
          {/* Label */}
          <SkeletonBox className="h-4 w-32" />

          {/* Input */}
          <SkeletonBox className="h-10 w-full rounded-lg" />
        </div>
      ))}

      {/* Buttons */}
      <div className="flex gap-3 pt-4">
        <SkeletonBox className="h-10 w-32 rounded-lg" />
        <SkeletonBox className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  );
}

// Generic page skeleton
export function PageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-8 w-64" />
        <SkeletonBox className="h-10 w-32 rounded-lg" />
      </div>

      {/* Content card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 space-y-4">
        <SkeletonBox className="h-4 w-full" />
        <SkeletonBox className="h-4 w-full" />
        <SkeletonBox className="h-4 w-3/4" />
      </div>
    </div>
  );
}
