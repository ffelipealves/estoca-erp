"use client"

import * as React from "react"
import { toast } from "sonner"
import { LockSimpleIcon } from "@phosphor-icons/react"
import type { MovementPreset } from "@/lib/estoca/store"
import { useActions } from "@/lib/estoca/store"
import type { Permission } from "@/lib/estoca/rules"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MovementDialog } from "./movement-dialog"

interface OverlayApi {
  openMovement(preset?: MovementPreset): void
  explainLocked(permission: Permission): void
}

const OverlayContext = React.createContext<OverlayApi | null>(null)

export function useOverlays() {
  const api = React.useContext(OverlayContext)
  if (!api) throw new Error("OverlaysProvider ausente")
  return api
}

const LOCK_COPY: Partial<Record<Permission, { title: string; body: string }>> = {
  "gerir-produtos": {
    title: "Só o Administrador altera produtos",
    body: "Criar, editar e excluir produtos muda o catálogo de todos os operadores, por isso fica com o Administrador. Como Operador, você consulta o catálogo e registra entradas, saídas e ajustes.",
  },
  "gerir-categorias": {
    title: "Só o Administrador altera categorias",
    body: "Categorias organizam o catálogo inteiro. Criar, editar e excluir fica com o Administrador; você continua vendo tudo e registrando movimentações.",
  },
  administrar: {
    title: "Administração é exclusiva do Administrador",
    body: "Ali ficam o ID da sandbox, as credenciais e o reset que apaga as alterações. Como Operador, você não vê essa área.",
  },
}

export function OverlaysProvider({ children }: { children: React.ReactNode }) {
  const [movement, setMovement] = React.useState<{ open: boolean; preset: MovementPreset; key: number }>({
    open: false,
    preset: {},
    key: 0,
  })
  const [locked, setLocked] = React.useState<Permission | null>(null)
  const { login } = useActions()

  const api = React.useMemo<OverlayApi>(
    () => ({
      // A fresh key per open: closing always discards the draft.
      openMovement: (preset = {}) => setMovement((m) => ({ open: true, preset, key: m.key + 1 })),
      explainLocked: (permission) => setLocked(permission),
    }),
    [],
  )

  const copy = locked ? LOCK_COPY[locked] : null

  return (
    <OverlayContext.Provider value={api}>
      {children}
      <MovementDialog
        key={movement.key}
        open={movement.open}
        preset={movement.preset}
        onOpenChange={(open) => setMovement((m) => ({ ...m, open }))}
      />
      <Dialog open={!!locked} onOpenChange={(open) => !open && setLocked(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <span className="mb-1 inline-flex size-9 items-center justify-center rounded-md bg-rail text-rail-foreground">
              <LockSimpleIcon className="size-4.5" weight="bold" />
            </span>
            <DialogTitle>{copy?.title}</DialogTitle>
            <DialogDescription className="sr-only">Permissão necessária</DialogDescription>
          </DialogHeader>
          <DialogBody className="text-[15px] leading-relaxed">
            <p>{copy?.body}</p>
            <p className="mt-3 text-muted-foreground">
              Quer testar essa parte? Troque para o perfil Administrador. Seus dados continuam os mesmos.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocked(null)}>
              Entendi
            </Button>
            <Button
              onClick={async () => {
                setLocked(null)
                const result = await login("admin")
                if (result.ok) toast.success("Agora você está como Administrador")
                else toast.error("Não foi possível trocar de perfil", { description: result.message })
              }}
            >
              Trocar para Administrador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OverlayContext.Provider>
  )
}
