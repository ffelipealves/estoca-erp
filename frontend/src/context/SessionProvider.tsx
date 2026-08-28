"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ApiError,
  bootstrapSession,
  storeSessionId,
  type SessionBootstrapResponse,
} from "@/lib/api";

const BOOTSTRAP_TIMEOUT_MS = 90_000;

export type SessionStatus = "bootstrapping" | "ready" | "error";

interface SessionContextValue {
  errorMessage: string | null;
  expiresAt: string | null;
  retry: () => void;
  sessionId: string | null;
  status: SessionStatus;
}

const SessionContext = createContext<SessionContextValue | null>(null);

let bootstrapInFlight: Promise<SessionBootstrapResponse> | null = null;

function requestBootstrap(): Promise<SessionBootstrapResponse> {
  if (!bootstrapInFlight) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      BOOTSTRAP_TIMEOUT_MS,
    );

    bootstrapInFlight = bootstrapSession(controller.signal)
      .then((session) => {
        storeSessionId(session.session_id);
        return session;
      })
      .catch((error: unknown) => {
        bootstrapInFlight = null;
        throw error;
      })
      .finally(() => window.clearTimeout(timeoutId));
  }

  return bootstrapInFlight;
}

function describeBootstrapError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return "A API demorou mais que o esperado para responder.";
  }

  return "Não foi possível preparar a demonstração agora.";
}

export function SessionProvider({ children }: React.PropsWithChildren) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<SessionStatus>("bootstrapping");
  const [session, setSession] = useState<SessionBootstrapResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void requestBootstrap()
      .then((result) => {
        if (!active) return;
        setSession(result);
        setErrorMessage(null);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(describeBootstrapError(error));
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    bootstrapInFlight = null;
    setErrorMessage(null);
    setStatus("bootstrapping");
    setAttempt((current) => current + 1);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      errorMessage,
      expiresAt: session?.expires_at ?? null,
      retry,
      sessionId: session?.session_id ?? null,
      status,
    }),
    [errorMessage, retry, session, status],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }

  return context;
}
