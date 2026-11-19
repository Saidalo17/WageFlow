import { cn } from "@/lib/utils";

/** Large rounded surface used for dashboard blocks (see design.md: radius 24px, soft shadow). */
export function Card({
  title,
  action,
  className,
  index = 0,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  /** Position in the page; later cards appear a little after earlier ones. */
  index?: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("reveal rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6", className)}
      style={{ "--i": index } as React.CSSProperties}
    >
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
