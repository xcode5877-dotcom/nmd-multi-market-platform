/** Courier online / offline / busy status chip (read-only). */
export function DriverOnlineBadge({
  isOnline,
  isAvailable,
  isActive = true,
}: {
  isOnline?: boolean;
  isAvailable?: boolean;
  isActive?: boolean;
}) {
  if (isActive === false) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        معطّل
      </span>
    );
  }
  if (!isOnline) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        غير متصل
      </span>
    );
  }
  if (isAvailable === false) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        مشغول
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
      متصل · متاح
    </span>
  );
}
