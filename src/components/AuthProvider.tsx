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
import { DEMO_USER_ID, ensureUserProfile } from "@/lib/database";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const DEMO_SESSION_KEY = "me-pague:demo-session";
const DEMO_USERNAME = "admlaio";
const DEMO_PASSWORD = "123456";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

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

    const authTimeout = window.setTimeout(() => {
      if (!mounted) return;

      setLoading(false);
    }, 3500);

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;

        window.clearTimeout(authTimeout);
        const sessionUser = data.session?.user ?? null;
        setUser(sessionUser);

        if (sessionUser) {
          await ensureUserProfile(sessionUser);
        }

        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;

        window.clearTimeout(authTimeout);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        await ensureUserProfile(session.user);
      }

      setLoading(false);
    });

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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw error;
    if (data.user) {
      await ensureUserProfile(data.user);
      setUser(data.user);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) throw error;
    if (data.session && data.user) {
      await ensureUserProfile(data.user);
      setUser(data.user);
    }
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
    () => ({ user, loading, login, register, logout }),
    [loading, login, logout, register, user],
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
