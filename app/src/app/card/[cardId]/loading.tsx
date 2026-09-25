// Shown instantly on navigation while the lookup resolves — same shape as the real page.
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy aria-label="Loading card">
      <div className="h-11 rounded-xl bg-surface-2" />
      <div className="flex gap-5">
        <div className="h-[156px] w-[112px] rounded-md bg-surface-2" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-8 w-2/3 rounded bg-surface-2" />
          <div className="h-4 w-1/2 rounded bg-surface-2" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[76px] rounded-xl bg-surface-2" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-32 rounded-2xl bg-surface-2" />
        <div className="h-32 rounded-2xl bg-surface-2" />
      </div>
    </div>
  );
}
