import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/**
 * Buttons are keys: a flat face with a 2px lip at the bottom that
 * collapses on press. Only `trigger` (yellow) commits the main action.
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md border text-sm font-semibold whitespace-nowrap transition-[background-color,box-shadow,transform,color] duration-150 ease-out outline-none select-none active:not-aria-disabled:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-disabled:not-data-[variant=locked]:opacity-55 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        trigger:
          "border-[#b79c51] bg-trigger text-trigger-ink shadow-[inset_0_-2px_0_rgb(0_0_0/0.16)] hover:bg-trigger-hover active:shadow-[inset_0_-1px_0_rgb(0_0_0/0.16)]",
        default:
          "border-primary bg-primary text-primary-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/0.35)] hover:bg-[#30363b] active:shadow-[inset_0_-1px_0_rgb(0_0_0/0.35)]",
        outline:
          "border-input bg-card text-foreground shadow-[inset_0_-2px_0_rgb(27_31_34/0.07)] hover:bg-secondary aria-expanded:bg-secondary",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-[#d8dfdc]",
        ghost: "border-transparent text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        destructive:
          "border-[#773226] bg-destructive text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.22)] hover:bg-[#893b2d]",
        link: "h-auto border-transparent px-0 text-foreground underline decoration-foreground/35 underline-offset-4 hover:decoration-foreground",
        /** Visible but not allowed for this role. Still clickable: it explains why. */
        locked:
          "border-dashed border-input bg-transparent font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 gap-1.5 px-2.5 text-[13px]",
        lg: "h-11 px-5 text-[15px]",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
