import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em] sm:text-[32px]" style={{ fontStretch: "86%" }}>
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-[70ch] text-[15px] text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** A work panel. Header carries a real heading; nothing decorative above it. */
export function Panel({
  title,
  meta,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title: string
  meta?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  id?: string
}) {
  const headingId = id ? `${id}-titulo` : undefined
  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex min-w-0 flex-col rounded-lg border bg-card shadow-[0_1px_0_rgb(27_31_34/0.04)]", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-bold tracking-[-0.005em]">
            {title}
          </h2>
          {meta ? <p className="mt-0.5 text-[13px] text-muted-foreground">{meta}</p> : null}
        </div>
        {action}
      </div>
      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  )
}
