import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-sm bg-[#dfe4e2]", className)}
      {...props}
    />
  )
}

export { Skeleton }
