const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

const SESSION_STORAGE_KEY = "estoca.session_id";
const AUTH_STORAGE_KEY = "estoca.auth";

interface ApiErrorPayload {
  code?: string;
  detail?: string;
}

export interface SessionBootstrapResponse {
  session_id: string;
  expires_at: string;
}

export type UserRole = "admin" | "operador";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  user: AuthUser;
}

export interface AuthSession {
  accessToken: string;
  sessionId: string;
  user: AuthUser;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  sku: string;
  price: string;
  quantity: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface ProductCreateInput {
  category_id: string;
  name: string;
  sku: string;
  price: string;
  initial_quantity: number;
  low_stock_threshold: number;
}

export type ProductUpdateInput = Omit<ProductCreateInput, "initial_quantity">;

export type StockMovementType = "entrada" | "saida" | "ajuste";

export interface StockMovement {
  id: string;
  product_id: string;
  performed_by_user_id: string | null;
  type: StockMovementType;
  quantity: number;
  resulting_quantity: number;
  note: string | null;
  created_at: string;
}

export interface StockMovementPage {
  items: StockMovement[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
}

export interface StockMovementCreateInput {
  product_id: string;
  type: StockMovementType;
  quantity: number;
  note?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getStoredSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
}

export function storeSessionId(sessionId: string): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
}

export function getStoredAuth(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const auth = JSON.parse(stored) as Partial<AuthSession>;
    const user = auth.user;

    if (
      typeof auth.accessToken !== "string" ||
      typeof auth.sessionId !== "string" ||
      !user ||
      typeof user.id !== "string" ||
      typeof user.email !== "string" ||
      typeof user.full_name !== "string" ||
      (user.role !== "admin" && user.role !== "operador")
    ) {
      throw new Error("Invalid stored auth");
    }

    return auth as AuthSession;
  } catch {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function storeAuth(auth: AuthSession): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  }
}

export function clearStoredAuth(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

async function readErrorPayload(response: Response): Promise<ApiErrorPayload> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return {};
  }
}

export async function apiRequest<T>(
  path: `/${string}`,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const sessionId = getStoredSessionId();
  const auth = getStoredAuth();

  if (sessionId && !headers.has("X-Session-Id")) {
    headers.set("X-Session-Id", sessionId);
  }

  if (auth?.sessionId === sessionId && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${auth.accessToken}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new ApiError(
      payload.detail ?? `A API respondeu com status ${response.status}.`,
      response.status,
      payload.code,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("A API retornou uma resposta inválida.", response.status);
  }
}

export function bootstrapSession(
  signal?: AbortSignal,
): Promise<SessionBootstrapResponse> {
  return apiRequest<SessionBootstrapResponse>("/api/v1/sessions/bootstrap", {
    method: "POST",
    signal,
  });
}

export function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/login", {
    body: JSON.stringify({ email, password }),
    method: "POST",
  });
}

export function listCategories(signal?: AbortSignal): Promise<Category[]> {
  return apiRequest<Category[]>("/api/v1/categories", { signal });
}

export function createCategory(name: string): Promise<Category> {
  return apiRequest<Category>("/api/v1/categories", {
    body: JSON.stringify({ name }),
    method: "POST",
  });
}

export function updateCategory(categoryId: string, name: string): Promise<Category> {
  return apiRequest<Category>(`/api/v1/categories/${categoryId}`, {
    body: JSON.stringify({ name }),
    method: "PUT",
  });
}

export function deleteCategory(categoryId: string): Promise<void> {
  return apiRequest<void>(`/api/v1/categories/${categoryId}`, {
    method: "DELETE",
  });
}

export function listProducts(signal?: AbortSignal): Promise<Product[]> {
  return apiRequest<Product[]>("/api/v1/products", { signal });
}

export function createProduct(payload: ProductCreateInput): Promise<Product> {
  return apiRequest<Product>("/api/v1/products", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function updateProduct(
  productId: string,
  payload: ProductUpdateInput,
): Promise<Product> {
  return apiRequest<Product>(`/api/v1/products/${productId}`, {
    body: JSON.stringify(payload),
    method: "PUT",
  });
}

export function deleteProduct(productId: string): Promise<void> {
  return apiRequest<void>(`/api/v1/products/${productId}`, {
    method: "DELETE",
  });
}

export function listStockMovements(
  page: number,
  pageSize: number,
  productId?: string,
  signal?: AbortSignal,
): Promise<StockMovementPage> {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (productId) query.set("product_id", productId);

  return apiRequest<StockMovementPage>(
    `/api/v1/stock-movements?${query.toString()}`,
    { signal },
  );
}

export function createStockMovement(
  payload: StockMovementCreateInput,
): Promise<StockMovement> {
  return apiRequest<StockMovement>("/api/v1/stock-movements", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}
