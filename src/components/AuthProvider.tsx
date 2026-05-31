"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { DEMO_USER_ID, ensureUserProfile, getUserAccessState } from "@/lib/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthContextValue = {
  authNotice: { message: string; tone: "error" | "info" | "success" } | null;
  clearAuthNotice: () => void;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<{ signedIn: boolean }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const DEMO_SESSION_KEY = "me-pague:demo-session";
const DEMO_USERNAME = "admlaio";
const DEMO_PASSWORD = "123456";
const SUPERADMIN_USERNAME = "superadm";
const SUPERADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "superadm@mepague.app";
const AUTH_TIMEOUT_MS = 5000;

function createDemoUser(): User {
  return {
    id: DEMO_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "admLaio",
    app_metadata: {},
    user_metadata: { name: "admLaio" },
    created_at: new Date(0).toISOString(),
  } as User;
}

function getStoredDemoSession() {
  try {
    return window.localStorage?.getItem(DEMO_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

function setStoredDemoSession(enabled: boolean) {
  try {
    if (enabled) {
      window.localStorage?.setItem(DEMO_SESSION_KEY, "true");
      return;
    }

    window.localStorage?.removeItem(DEMO_SESSION_KEY);
  } catch {
    // Some embedded browsers disable localStorage; the in-memory user state still works.
  }
}

function resolveAuthEmail(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === SUPERADMIN_USERNAME) {
    return SUPERADMIN_EMAIL;
  }

  return value.trim();
}

function createUserAlreadyExistsError() {
  const error = new Error("Esse email ja tem cadastro. Entre pela aba Entrar.") as Error & { code: string };

  error.code = "user_already_exists";
  return error;
}

function getAuthNoticeTone(profileStatus?: string) {
  return profileStatus === "pending" ? "info" : "error";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authNotice, setAuthNotice] = useState<AuthContextValue["authNotice"]>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let validationId = 0;

    if (getStoredDemoSession()) {
      setUser(createDemoUser());
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    if (!isSupabaseConfigured) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    const finishLoading = () => {
      if (mounted) {
        setLoading(false);
      }
    };

    const authTimeout = window.setTimeout(finishLoading, AUTH_TIMEOUT_MS);

    const applySessionUser = async (sessionUser: User | null) => {
      const currentValidation = ++validationId;

      if (!sessionUser) {
        setUser(null);
        finishLoading();
        return;
      }

      try {
        const access = await getUserAccessState(sessionUser);

        if (!mounted || currentValidation !== validationId) return;

        if (access.allowed) {
          setAuthNotice(null);
          setUser(sessionUser);
        } else {
          await supabase.auth.signOut();
          setAuthNotice({
            message: access.message || "Conta sem acesso ao app.",
            tone: getAuthNoticeTone(access.profile?.status),
          });
          setUser(null);
        }
      } catch {
        if (mounted && currentValidation === validationId) {
          setUser(null);
        }
      } finally {
        if (currentValidation === validationId) {
          finishLoading();
        }
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;

      void applySessionUser(session?.user ?? null);
    });

    void supabase.auth
      .getSession()
      .then(({ data }) => applySessionUser(data.session?.user ?? null))
      .catch(finishLoading);

    return () => {
      mounted = false;
      window.clearTimeout(authTimeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (email.trim().toLowerCase() === DEMO_USERNAME) {
      if (password !== DEMO_PASSWORD) {
        throw new Error("Invalid demo password");
      }

      setStoredDemoSession(true);
      setUser(createDemoUser());
      return;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured");
    }

    setAuthNotice(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email: resolveAuthEmail(email), password });

    if (error) throw error;
    if (data.user) {
      const access = await getUserAccessState(data.user);

      if (!access.allowed) {
        await supabase.auth.signOut();
        setUser(null);
        throw new Error(access.message || "Conta sem acesso ao app.");
      }

      setUser(data.user);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured");
    }

    setAuthNotice(null);

    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) throw error;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured");
    }

    setAuthNotice(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) throw error;

    if (data.user?.identities?.length === 0) {
      throw createUserAlreadyExistsError();
    }

    if (data.user && data.session) {
      await ensureUserProfile(data.user);
      setUser(data.user);
      return { signedIn: true };
    }

    setUser(null);
    return { signedIn: false };
  }, []);

  const clearAuthNotice = useCallback(() => {
    setAuthNotice(null);
  }, []);

  const logout = useCallback(async () => {
    if (user?.id === DEMO_USER_ID) {
      setStoredDemoSession(false);
      setUser(null);
      return;
    }

    if (!isSupabaseConfigured) {
      setUser(null);
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) throw error;
    setUser(null);
  }, [user]);

  const value = useMemo(
    () => ({ authNotice, clearAuthNotice, user, loading, login, loginWithGoogle, register, logout }),
    [authNotice, clearAuthNotice, loading, login, loginWithGoogle, logout, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
