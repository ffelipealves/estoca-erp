"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSession } from "@/context/SessionProvider";
import {
  clearStoredAuth,
  getStoredAuth,
  login as requestLogin,
  storeAuth,
  type AuthSession,
  type AuthUser,
} from "@/lib/api";

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthContextValue {
  isRestoring: boolean;
  isSubmitting: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const { sessionId } = useSession();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedAuth = getStoredAuth();

      if (storedAuth?.sessionId === sessionId) {
        setUser(storedAuth.user);
      } else {
        clearStoredAuth();
        setUser(null);
      }

      setIsRestoring(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [sessionId]);

  const login = useCallback(
    async ({ email, password }: LoginCredentials) => {
      if (!sessionId) {
        throw new Error("A sessão da demonstração ainda não está pronta.");
      }

      setIsSubmitting(true);

      try {
        const response = await requestLogin(email, password);
        const auth: AuthSession = {
          accessToken: response.access_token,
          sessionId,
          user: response.user,
        };

        storeAuth(auth);
        setUser(response.user);
      } finally {
        setIsSubmitting(false);
      }
    },
    [sessionId],
  );

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ isRestoring, isSubmitting, login, logout, user }),
    [isRestoring, isSubmitting, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
