"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export interface GymAffiliation {
  gym_id: string;
  gym_name: string;
  gym_slug: string;
  role: "owner" | "admin" | "trainer" | "member";
  is_active: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
  gyms: GymAffiliation[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error?: string; confirmationRequired?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBackendProfile = useCallback(async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const res = await fetch(`${apiUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data: UserProfile = await res.json();
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch {
      // Backend may be offline or unprovisioned yet
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.access_token) {
      await fetchBackendProfile(session.access_token);
    }
  }, [session, fetchBackendProfile]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.access_token) {
          await fetchBackendProfile(initialSession.access_token);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load session");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.access_token) {
        await fetchBackendProfile(newSession.access_token);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchBackendProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return { error: signInError.message };
      }

      if (data.session?.access_token) {
        await fetchBackendProfile(data.session.access_token);
      }

      return {};
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication error occurred";
      return { error: msg };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      setError(null);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) {
        return { error: signUpError.message };
      }

      const confirmationRequired = !data.session;
      if (data.session?.access_token) {
        await fetchBackendProfile(data.session.access_token);
      }

      return { confirmationRequired };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration error occurred";
      return { error: msg };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        localStorage.removeItem("fitcore_active_gym_id");
      }
      setUser(null);
      setSession(null);
      setProfile(null);
    } catch (err) {
      console.error("Sign out error", err);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setError(null);
      const redirectUrl = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        return { error: resetError.message };
      }
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Password reset failed" };
    }
  };

  const updatePassword = async (password: string) => {
    try {
      setError(null);
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        return { error: updateError.message };
      }
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Password update failed" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        error,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
