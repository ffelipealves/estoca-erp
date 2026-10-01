"use client"

import * as React from "react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { XIcon } from "@phosphor-icons/react"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-[#1b1f22]/45 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  )
}

/**
 * Write forms live here. On phones the dialog takes the usable width and its
 * body scrolls on its own, so header and actions stay in reach.
 * `busy` locks every exit while a request is in flight.
 */
function DialogContent({
  className,
  children,
  busy = false,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { busy?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        aria-busy={busy || undefined}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault()
          onEscapeKeyDown?.(e)
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault()
          onPointerDownOutside?.(e)
        }}
        onInteractOutside={(e) => {
          if (busy) e.preventDefault()
          onInteractOutside?.(e)
        }}
        className={cn(
          "fixed inset-x-2 bottom-2 z-50 flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-xl border border-[#c3cbc8] bg-popover text-popover-foreground shadow-[0_24px_64px_-24px_rgb(27_31_34/0.5)] outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-4 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-4 sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[calc(100dvh-4rem)] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-[0.98] sm:data-closed:slide-out-to-bottom-0 sm:data-closed:zoom-out-[0.98]",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close data-slot="dialog-close" asChild disabled={busy}>
          <Button variant="ghost" className="absolute top-3 right-3" size="icon-sm" disabled={busy}>
            <XIcon weight="bold" />
            <span className="sr-only">Fechar</span>
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 flex-col gap-1.5 border-b px-5 pt-5 pb-4 pr-14", className)}
      {...props}
    />
  )
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t bg-well px-5 py-4 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-tight font-bold tracking-[-0.01em]", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-pretty text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
