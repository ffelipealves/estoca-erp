"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  ApiError,
  bootstrapSession,
  checkHealth,
  clearStoredAuth,
  clearStoredSessionId,
  createCategory as requestCreateCategory,
  createProduct as requestCreateProduct,
  createStockMovement,
  deleteCategory as requestDeleteCategory,
  deleteProduct as requestDeleteProduct,
  getSessionInfo,
  getStoredAuth,
  getStoredSessionId,
  listCategories,
  listProducts,
  login as requestLogin,
  resetSession,
  storeAuth,
  storeSessionId,
  subscribeApi,
  updateCategory as requestUpdateCategory,
  updateProduct as requestUpdateProduct,
  type AuthUser,
  type SessionInfo,
} from "@/lib/api"
import { DEMO_PASSWORD, demoUserFor } from "@/lib/demo-users"
import { toCategory, toMovement, toPriceString, toProduct } from "./adapters"
import type {
  Category,
  CategoryDraft,
  Movement,
  MovementDraft,
  MovementType,
  Product,
  ProductDraft,
  Role,
} from "./types"

/** How long the free API tier gets to wake up and prepare the sandbox. */
const BOOT_TIMEOUT_MS = 90_000

/** Margin past the deadline before declaring the sandbox gone. */
const EXPIRY_GRACE_MS = 1_000

/** How long the row a movement just produced stays marked as the good read. */
const FLASH_MS = 2_500

export type BootStatus = "booting" | "error" | "ready" | "expired"
export type BootMode = "frio" | "restaurando"

/** One real request per step, in the order they happen. */
export const BOOT_STEPS = [
  "Acordando o servidor da demonstração",
  "Criando sua sandbox isolada",
  "Conferindo o prazo da sandbox",
] as const

export interface Sandbox {
  id: string
  createdAt: string
  lastActivityAt: string
  expiresAt: string
  /** Absolute limit: no activity extends the sandbox past it. */
  maxExpiresAt: string
  inactivityMs: number
}

export type CatalogStatus = "idle" | "loading" | "ready" | "error"

export interface EstocaState {
  sandbox: Sandbox
  user: AuthUser | null
  role: Role | null
  products: Product[]
  categories: Category[]
  catalogStatus: CatalogStatus
  catalogError: string | null
  /** Bumps on every registered movement: screens that list movements refetch on it. */
  movementsVersion: number
}

export type WriteResult<T = undefined> = { ok: true; value: T } | { ok: false; message: string; field?: string }

export interface EstocaActions {
  signIn(credentials: { email: string; password: string }): Promise<WriteResult>
  /** Quick switch: the role's demo account, same sandbox and data. */
  login(role: Role): Promise<WriteResult>
  logout(): void
  retryBoot(): void
  startNewSandbox(): void
  refreshCatalog(): void
  registerMovement(draft: MovementDraft): Promise<WriteResult<Movement>>
  /** Resolves with the new product's id. */
  createProduct(draft: ProductDraft): Promise<WriteResult<string>>
  updateProduct(id: string, draft: Omit<ProductDraft, "initialQuantity">): Promise<WriteResult>
  /** Deletes the product and, with it, its movement history. */
  deleteProduct(id: string): Promise<WriteResult>
  createCategory(draft: CategoryDraft): Promise<WriteResult>
  updateCategory(id: string, draft: CategoryDraft): Promise<WriteResult>
  /** The API refuses while products still use the category. */
  deleteCategory(id: string): Promise<WriteResult>
  /** Back to the seed catalog; login, sandbox id and the 24 h limit stay. */
  resetSandbox(): Promise<WriteResult<{ categories: number; products: number }>>
}

interface BootInfo {
  status: BootStatus
  mode: BootMode
  step: number
  error: string | null
}

interface CatalogData {
  status: CatalogStatus
  products: Product[]
  categories: Category[]
  error: string | null
}

const EMPTY_CATALOG: CatalogData = { status: "idle", products: [], categories: [], error: null }

function toSandbox(info: SessionInfo): Sandbox {
  return {
    id: info.session_id,
    createdAt: info.created_at,
    lastActivityAt: info.last_activity_at,
    expiresAt: info.expires_at,
    maxExpiresAt: info.max_expires_at,
    inactivityMs: info.inactivity_seconds * 1000,
  }
}

/** Every API response renews the sandbox; the client follows without asking. */
function touch(sandbox: Sandbox, serverNow: number): Sandbox {
  const idle = serverNow + sandbox.inactivityMs
  const cap = new Date(sandbox.maxExpiresAt).getTime()
  return {
    ...sandbox,
    lastActivityAt: new Date(serverNow).toISOString(),
    expiresAt: new Date(Math.min(idle, cap)).toISOString(),
  }
}

/** Human text for a failed request: the API's own message when there is one. */
export function describeError(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "A API demorou mais que o esperado para responder."
  }
  return fallback
}

/** The API answers 409 for a taken SKU and 404 for a category that is gone. */
function productWriteError(error: unknown, fallback: string): WriteResult<never> {
  if (error instanceof ApiError && error.status === 409) return { ok: false, field: "sku", message: error.message }
  if (error instanceof ApiError && error.status === 404) {
    return { ok: false, field: "categoryId", message: error.message }
  }
  return { ok: false, message: describeError(error, fallback) }
}

/** The API answers 409 when another category already has the name. */
function categoryWriteError(error: unknown, fallback: string): WriteResult<never> {
  if (error instanceof ApiError && error.status === 409) return { ok: false, field: "name", message: error.message }
  return { ok: false, message: describeError(error, fallback) }
}

const BootContext = React.createContext<BootInfo>({ status: "booting", mode: "frio", step: 0, error: null })
const DataContext = React.createContext<EstocaState | null>(null)
const ActionsContext = React.createContext<EstocaActions | null>(null)
type Flash = { movementId: string; productId: string }
const FlashContext = React.createContext<Flash | null>(null)

export function EstocaProvider({ children }: { children: React.ReactNode }) {
  const [boot, setBoot] = React.useState<BootInfo>({ status: "booting", mode: "frio", step: 0, error: null })
  const [sandbox, setSandbox] = React.useState<Sandbox | null>(null)
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [catalog, setCatalog] = React.useState<CatalogData>(EMPTY_CATALOG)
  const [movementsVersion, setMovementsVersion] = React.useState(0)
  const [flash, setFlash] = React.useState<Flash | null>(null)

  const bootStarted = React.useRef(false)
  /** Server clock minus client clock, so deadlines follow the API's time. */
  const clockOffset = React.useRef(0)
  const catalogRequest = React.useRef(0)
  const verifyingAuth = React.useRef(false)

  const loadCatalog = React.useCallback(async () => {
    const request = ++catalogRequest.current
    setCatalog((c) => ({ ...c, status: "loading", error: null }))
    try {
      const [products, categories] = await Promise.all([listProducts(), listCategories()])
      if (request !== catalogRequest.current) return
      setCatalog({
        status: "ready",
        products: products.map(toProduct),
        categories: categories.map(toCategory),
        error: null,
      })
    } catch (error) {
      if (request !== catalogRequest.current) return
      setCatalog((c) => ({
        ...c,
        status: "error",
        error: describeError(error, "Não foi possível carregar o catálogo."),
      }))
    }
  }, [])

  /** Wake the API, open (or reopen) the sandbox and read its deadline. */
  const runBoot = React.useCallback(
    async (relogin: Role | null = null) => {
      const restoring = getStoredSessionId() !== null
      setBoot({ status: "booting", mode: restoring ? "restaurando" : "frio", step: 0, error: null })
      const signal = AbortSignal.timeout(BOOT_TIMEOUT_MS)
      try {
        await checkHealth(signal)
        setBoot((b) => ({ ...b, step: 1 }))
        const { session_id: sessionId } = await bootstrapSession(signal)
        storeSessionId(sessionId)
        setBoot((b) => ({ ...b, step: 2 }))
        const info = await getSessionInfo(signal)
        clockOffset.current = new Date(info.last_activity_at).getTime() - Date.now()

        let restored = getStoredAuth()
        if (restored && restored.sessionId !== sessionId) {
          // The stored login belonged to a sandbox that no longer exists.
          clearStoredAuth()
          restored = null
        }
        if (!restored && relogin) {
          const response = await requestLogin(demoUserFor(relogin).email, DEMO_PASSWORD)
          restored = { accessToken: response.access_token, sessionId, user: response.user }
          storeAuth(restored)
        }

        setSandbox(toSandbox(info))
        setUser(restored?.user ?? null)
        setCatalog(EMPTY_CATALOG)
        setBoot((b) => ({ ...b, status: "ready", step: BOOT_STEPS.length }))
        if (restored) void loadCatalog()
      } catch (error) {
        setBoot((b) => ({
          ...b,
          status: "error",
          error: describeError(error, "Não foi possível preparar a demonstração agora."),
        }))
      }
    },
    [loadCatalog],
  )

  React.useEffect(() => {
    // Strict Mode runs effects twice; one bootstrap is enough.
    if (bootStarted.current) return
    bootStarted.current = true
    void runBoot()
  }, [runBoot])

  /** A 401 means either the sandbox is gone or only the login is: ask the API which. */
  const verifyAuth = React.useCallback(async () => {
    if (verifyingAuth.current) return
    verifyingAuth.current = true
    try {
      await getSessionInfo()
      clearStoredAuth()
      setUser(null)
      setCatalog(EMPTY_CATALOG)
      toast.info("Seu acesso expirou", { description: "Entre de novo para continuar na mesma sandbox." })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setBoot((b) => ({ ...b, status: "expired" }))
      }
    } finally {
      verifyingAuth.current = false
    }
  }, [])

  React.useEffect(
    () =>
      subscribeApi({
        onSuccess: () => setSandbox((s) => (s ? touch(s, Date.now() + clockOffset.current) : s)),
        onUnauthorized: (_error, path) => {
          // A wrong password is a form error, not a lost session.
          if (path === "/api/v1/auth/login") return
          void verifyAuth()
        },
      }),
    [verifyAuth],
  )

  const expiresAt = sandbox?.expiresAt
  React.useEffect(() => {
    if (!expiresAt) return
    const ms = new Date(expiresAt).getTime() - (Date.now() + clockOffset.current) + EXPIRY_GRACE_MS
    const timer = setTimeout(
      () => setBoot((b) => (b.status === "ready" ? { ...b, status: "expired" } : b)),
      Math.max(0, Math.min(ms, 2_147_000_000)),
    )
    return () => clearTimeout(timer)
  }, [expiresAt])

  const authenticate = React.useCallback(
    async (email: string, password: string, reloadCatalog: boolean): Promise<WriteResult> => {
      const sessionId = getStoredSessionId()
      if (!sessionId) return { ok: false, message: "A sandbox ainda não está pronta." }
      try {
        const response = await requestLogin(email.trim(), password)
        storeAuth({ accessToken: response.access_token, sessionId, user: response.user })
        setUser(response.user)
        if (reloadCatalog) void loadCatalog()
        return { ok: true, value: undefined }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return { ok: false, field: "credentials", message: error.message }
        }
        return { ok: false, message: describeError(error, "Não foi possível entrar agora.") }
      }
    },
    [loadCatalog],
  )

  const catalogStatus = catalog.status
  const actions = React.useMemo<EstocaActions>(
    () => ({
      signIn: ({ email, password }) => authenticate(email, password, true),
      // Same sandbox, same data: only the permissions change.
      login: (role) => authenticate(demoUserFor(role).email, DEMO_PASSWORD, catalogStatus !== "ready"),
      logout() {
        clearStoredAuth()
        setUser(null)
        setCatalog(EMPTY_CATALOG)
      },
      retryBoot() {
        void runBoot()
      },
      startNewSandbox() {
        const role = user?.role ?? null
        clearStoredAuth()
        clearStoredSessionId()
        setUser(null)
        setSandbox(null)
        void runBoot(role)
      },
      refreshCatalog() {
        void loadCatalog()
      },
      async registerMovement(draft) {
        try {
          const created = await createStockMovement({
            product_id: draft.productId,
            type: draft.type,
            quantity: draft.quantity,
            note: draft.note.trim() || undefined,
          })
          const movement = toMovement(created)
          // The API already applied it; the catalog follows with the resulting balance.
          setCatalog((c) => ({
            ...c,
            products: c.products.map((p) =>
              p.id === movement.productId ? { ...p, balance: movement.resultingBalance } : p,
            ),
          }))
          setMovementsVersion((v) => v + 1)
          setFlash({ movementId: movement.id, productId: movement.productId })
          setTimeout(() => setFlash((f) => (f?.movementId === movement.id ? null : f)), FLASH_MS)
          return { ok: true, value: movement }
        } catch (error) {
          return { ok: false, message: describeError(error, "Não foi possível registrar a movimentação.") }
        }
      },
      async createProduct(draft) {
        try {
          const created = toProduct(
            await requestCreateProduct({
              category_id: draft.categoryId,
              name: draft.name.trim(),
              sku: draft.sku.trim().toUpperCase(),
              price: toPriceString(draft.price),
              low_stock_threshold: draft.lowStockLimit,
              initial_quantity: draft.initialQuantity,
            }),
          )
          setCatalog((c) => ({ ...c, products: [...c.products, created] }))
          // The opening quantity is a movement in the history.
          if (draft.initialQuantity > 0) setMovementsVersion((v) => v + 1)
          return { ok: true, value: created.id }
        } catch (error) {
          return productWriteError(error, "Não foi possível cadastrar o produto.")
        }
      },
      async updateProduct(id, draft) {
        try {
          const updated = toProduct(
            await requestUpdateProduct(id, {
              category_id: draft.categoryId,
              name: draft.name.trim(),
              sku: draft.sku.trim().toUpperCase(),
              price: toPriceString(draft.price),
              low_stock_threshold: draft.lowStockLimit,
            }),
          )
          setCatalog((c) => ({ ...c, products: c.products.map((p) => (p.id === id ? updated : p)) }))
          return { ok: true, value: undefined }
        } catch (error) {
          return productWriteError(error, "Não foi possível salvar o produto.")
        }
      },
      async deleteProduct(id) {
        try {
          await requestDeleteProduct(id)
          setCatalog((c) => ({ ...c, products: c.products.filter((p) => p.id !== id) }))
          setMovementsVersion((v) => v + 1)
          return { ok: true, value: undefined }
        } catch (error) {
          return { ok: false, message: describeError(error, "Não foi possível excluir o produto.") }
        }
      },
      async createCategory(draft) {
        try {
          const created = toCategory(
            await requestCreateCategory(draft.name.trim(), draft.description.trim() || undefined),
          )
          setCatalog((c) => ({ ...c, categories: [...c.categories, created] }))
          return { ok: true, value: undefined }
        } catch (error) {
          return categoryWriteError(error, "Não foi possível criar a categoria.")
        }
      },
      async updateCategory(id, draft) {
        try {
          // PUT replaces the whole category: the description always goes along.
          const updated = toCategory(
            await requestUpdateCategory(id, draft.name.trim(), draft.description.trim() || undefined),
          )
          setCatalog((c) => ({ ...c, categories: c.categories.map((cat) => (cat.id === id ? updated : cat)) }))
          return { ok: true, value: undefined }
        } catch (error) {
          return categoryWriteError(error, "Não foi possível salvar a categoria.")
        }
      },
      async deleteCategory(id) {
        try {
          await requestDeleteCategory(id)
          setCatalog((c) => ({ ...c, categories: c.categories.filter((cat) => cat.id !== id) }))
          return { ok: true, value: undefined }
        } catch (error) {
          return { ok: false, message: describeError(error, "Não foi possível excluir a categoria.") }
        }
      },
      async resetSandbox() {
        try {
          const result = await resetSession()
          void loadCatalog()
          setMovementsVersion((v) => v + 1)
          return { ok: true, value: { categories: result.categories_seeded, products: result.products_seeded } }
        } catch (error) {
          return { ok: false, message: describeError(error, "Não foi possível resetar a sandbox.") }
        }
      },
    }),
    [authenticate, catalogStatus, loadCatalog, runBoot, user],
  )

  const state = React.useMemo<EstocaState | null>(
    () =>
      sandbox
        ? {
            sandbox,
            user,
            role: user?.role ?? null,
            products: catalog.products,
            categories: catalog.categories,
            catalogStatus: catalog.status,
            catalogError: catalog.error,
            movementsVersion,
          }
        : null,
    [sandbox, user, catalog, movementsVersion],
  )

  return (
    <BootContext.Provider value={boot}>
      <ActionsContext.Provider value={actions}>
        <DataContext.Provider value={state}>
          <FlashContext.Provider value={flash}>{children}</FlashContext.Provider>
        </DataContext.Provider>
      </ActionsContext.Provider>
    </BootContext.Provider>
  )
}

export function useBoot() {
  return React.useContext(BootContext)
}

/** Only call below the boot gate: the sandbox is guaranteed to exist there. */
export function useEstoca() {
  const state = React.useContext(DataContext)
  if (!state) throw new Error("useEstoca precisa da sandbox carregada")
  return state
}

export function useMaybeEstoca() {
  return React.useContext(DataContext)
}

export function useActions() {
  const actions = React.useContext(ActionsContext)
  if (!actions) throw new Error("EstocaProvider ausente")
  return actions
}

/** The movement that just landed, for its one good-read flash. */
export function useFlashId() {
  return React.useContext(FlashContext)?.movementId ?? null
}

/** The product that movement touched, so its catalog row can flash too. */
export function useFlashProductId() {
  return React.useContext(FlashContext)?.productId ?? null
}

export function useRole(): Role {
  return useEstoca().role ?? "operador"
}

/** Opens the movement dialog already pointed at a product and/or operation. */
export type MovementPreset = { productId?: string; type?: MovementType }
