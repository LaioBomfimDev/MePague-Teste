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
import type { Session, User } from "@supabase/supabase-js";
import { DEMO_USER_ID, getUserAccessState } from "@/lib/database";
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
const DEMO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO === "true";
const AUTH_TIMEOUT_MS = 5000;
const LOCAL_GOOGLE_OAUTH_PORT = "3033";
type UserAccessState = Awaited<ReturnType<typeof getUserAccessState>>;

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

function createUserAlreadyExistsError() {
  const error = new Error("Esse email ja tem cadastro. Entre pela aba Entrar.") as Error & { code: string };

  error.code = "user_already_exists";
  return error;
}

function getAuthNoticeTone(profileStatus?: string) {
  return profileStatus === "pending" ? "info" : "error";
}

function getGoogleOAuthRedirectTo() {
  if (typeof window === "undefined") return undefined;

  const redirectUrl = new URL("/login", window.location.origin);
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  if (isLocalhost && window.location.port !== LOCAL_GOOGLE_OAUTH_PORT) {
    throw new Error(
      `Para entrar com Google localmente, abra http://${window.location.hostname}:${LOCAL_GOOGLE_OAUTH_PORT}/login. A porta local atual nao esta autorizada no Supabase/Google.`,
    );
  }

  return redirectUrl.toString();
}

async function getSessionAccessState(session: Session): Promise<UserAccessState> {
  try {
    const response = await fetch("/api/auth/profile", {
      method: "POST",
      headers: {
        authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "Nao foi possivel validar o acesso.");
    }

    return (await response.json()) as UserAccessState;
  } catch {
    return getUserAccessState(session.user);
  }
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

    const applySession = async (session: Session | null) => {
      const currentValidation = ++validationId;

      if (!session) {
        setUser(null);
        finishLoading();
        return;
      }

      try {
        const access = await getSessionAccessState(session);

        if (!mounted || currentValidation !== validationId) return;

        if (access.allowed) {
          setAuthNotice(null);
          setUser(session.user);
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

      if (event === "SIGNED_IN") {
        try {
          window.localStorage.removeItem("me-pague:notifications-prompt-dismissed");
          window.localStorage.removeItem("me-pague:pwa-prompt-dismissed");
        } catch {}
      }

      void applySession(session ?? null);
    });

    void supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session ?? null))
      .catch(finishLoading);

    return () => {
      mounted = false;
      window.clearTimeout(authTimeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (email.trim().toLowerCase() === DEMO_USERNAME) {
      if (!DEMO_ENABLED) {
        throw new Error("Modo demo desativado neste ambiente.");
      }

      if (password !== DEMO_PASSWORD) {
        throw new Error("Senha do demo inválida.");
      }

      setStoredDemoSession(true);
      try {
        window.localStorage.removeItem("me-pague:notifications-prompt-dismissed");
        window.localStorage.removeItem("me-pague:pwa-prompt-dismissed");
      } catch {}
      setUser(createDemoUser());
      return;
    }

    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured");
    }

    setAuthNotice(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) throw error;
    if (data.session) {
      const access = await getSessionAccessState(data.session);

      if (!access.allowed) {
        await supabase.auth.signOut();
        setUser(null);
        throw new Error(access.message || "Conta sem acesso ao app.");
      }

      setUser(data.session.user);
      return;
    }

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

    const redirectTo = getGoogleOAuthRedirectTo();
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
      const access = await getSessionAccessState(data.session);

      if (!access.allowed) {
        await supabase.auth.signOut();
        setUser(null);
        throw new Error(access.message || "Conta sem acesso ao app.");
      }

      setUser(data.session.user);
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
