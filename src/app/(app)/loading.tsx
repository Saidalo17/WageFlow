export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-9 w-48 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-3xl bg-muted" />
        ))}
      </div>
      <div className="h-11 animate-pulse rounded-xl bg-muted" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}