/**
 * Loading Skeleton Components
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

// Product card skeleton (for product grids)
export function ProductCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* Image skeleton */}
      <SkeletonBox className="w-full h-64" />

      <div className="p-4 space-y-3">
        {/* Title */}
        <SkeletonBox className="h-6 w-3/4" />

        {/* Price */}
        <SkeletonBox className="h-8 w-1/3" />

        {/* Rating */}
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <SkeletonBox key={i} className="w-5 h-5" />
          ))}
        </div>

        {/* Button */}
        <SkeletonBox className="h-10 w-full" />
      </div>
    </div>
  );
}

// Product grid skeleton
export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {[...Array(count)].map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Product detail page skeleton
export function ProductDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gallery skeleton */}
        <div className="space-y-4">
          <SkeletonBox className="w-full h-96 rounded-lg" />
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <SkeletonBox key={i} className="w-full h-20 rounded" />
            ))}
          </div>
        </div>

        {/* Details skeleton */}
        <div className="space-y-6">
          {/* Title */}
          <SkeletonBox className="h-8 w-3/4" />

          {/* Price */}
          <SkeletonBox className="h-10 w-1/3" />

          {/* Rating */}
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <SkeletonBox key={i} className="w-6 h-6" />
            ))}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <SkeletonBox className="h-4 w-full" />
            <SkeletonBox className="h-4 w-full" />
            <SkeletonBox className="h-4 w-2/3" />
          </div>

          {/* Variants */}
          <div className="space-y-3">
            <SkeletonBox className="h-6 w-24" />
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <SkeletonBox key={i} className="w-10 h-10 rounded-full" />
              ))}
            </div>
          </div>

          {/* Add to cart button */}
          <SkeletonBox className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Table skeleton (for admin lists)
export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {/* Table header */}
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {[...Array(cols)].map((_, i) => (
            <SkeletonBox key={i} className="h-4 w-20" />
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-3 flex-1">
          {/* Label */}
          <SkeletonBox className="h-4 w-24" />

          {/* Value */}
          <SkeletonBox className="h-8 w-32" />

          {/* Change */}
          <SkeletonBox className="h-3 w-20" />
        </div>

        {/* Icon */}
        <SkeletonBox className="w-12 h-12 rounded-full" />
      </div>
    </div>
  );
}

// Dashboard grid skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(6)].map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <SkeletonBox className="h-6 w-32 mb-4" />
        <SkeletonBox className="h-64 w-full" />
      </div>

      {/* Table */}
      <TableSkeleton rows={5} cols={4} />
    </div>
  );
}

// Form skeleton
export function FormSkeleton({ fields = 5 }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
      {[...Array(fields)].map((_, i) => (
        <div key={i} className="space-y-2">
          {/* Label */}
          <SkeletonBox className="h-4 w-24" />

          {/* Input */}
          <SkeletonBox className="h-10 w-full rounded" />
        </div>
      ))}

      {/* Submit button */}
      <SkeletonBox className="h-10 w-32 rounded" />
    </div>
  );
}

// Generic page skeleton
export function PageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Page title */}
      <SkeletonBox className="h-8 w-64" />

      {/* Content */}
      <div className="space-y-4">
        <SkeletonBox className="h-4 w-full" />
        <SkeletonBox className="h-4 w-full" />
        <SkeletonBox className="h-4 w-3/4" />
      </div>
    </div>
  );
}
