import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-[15px] shadow-[inset_0_1px_0_rgb(27_31_34/0.05)] transition-colors outline-none placeholder:text-[#6b7479] focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-secondary disabled:opacity-60 aria-invalid:border-destructive aria-invalid:focus-visible:outline-destructive read-only:bg-secondary",
        className
      )}
      {...props}
    />
  )
}

export { Input }
