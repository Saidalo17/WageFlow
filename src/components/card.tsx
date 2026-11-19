import { cn } from "@/lib/utils";

/** Large rounded surface used for dashboard blocks (see design.md: radius 24px, soft shadow). */
export function Card({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
