"use client"

import * as React from "react"
import { LockSimpleIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { PERMISSIONS, type Permission } from "@/lib/estoca/rules"
import { useRole } from "@/lib/estoca/store"
import { useOverlays } from "./overlays"

/**
 * Renders the action for roles that may use it. For the others the action
 * stays visible, trades its icon for a lock, and explains itself when clicked.
 */
export function PermissionButton({
  permission,
  onClick,
  icon,
  label,
  iconOnly = false,
  variant = "outline",
  size,
  className,
}: {
  permission: Permission
  onClick(): void
  icon?: React.ReactNode
  label: string
  iconOnly?: boolean
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
}) {
  const role = useRole()
  const { explainLocked } = useOverlays()
  const allowed = PERMISSIONS[role][permission]

  if (allowed) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={onClick}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
      >
        {icon}
        {iconOnly ? null : label}
      </Button>
    )
  }
  return (
    <Button
      variant="locked"
      size={size}
      className={className}
      aria-disabled="true"
      aria-label={`${label}: exclusivo do Administrador`}
      title={iconOnly ? `${label}: exclusivo do Administrador` : undefined}
      onClick={() => explainLocked(permission)}
    >
      {iconOnly ? (
        <span className="relative inline-flex">
          {icon}
          <span className="absolute -right-1.5 -bottom-1 inline-flex size-3 items-center justify-center rounded-[3px] bg-rail text-rail-foreground">
            <LockSimpleIcon className="size-2" weight="bold" />
          </span>
        </span>
      ) : (
        <>
          <LockSimpleIcon weight="bold" />
          {label}
        </>
      )}
    </Button>
  )
}

export function useCan(permission: Permission) {
  return PERMISSIONS[useRole()][permission]
}
