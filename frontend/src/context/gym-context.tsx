"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiClient, isApiClientError } from "@/lib/api/client";
import type { GymDetailRead, GymRead } from "@/lib/api/types";

const ACTIVE_GYM_STORAGE_KEY = "fitcore_active_gym_id";

export interface GymContextType {
  accessibleGyms: GymRead[];
  activeGym: GymDetailRead | null;
  activeGymId: string | null;
  currentRole: string | null;
  isLoading: boolean;
  isSwitching: boolean;
  error: string | null;
  switchGym: (gymId: string) => Promise<boolean>;
  refreshGyms: (preferredGymId?: string) => Promise<void>;
  clearActiveGym: () => void;
}

const GymContext = createContext<GymContextType | undefined>(undefined);

export function GymProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [accessibleGyms, setAccessibleGyms] = useState<GymRead[]>([]);
  const [activeGym, setActiveGym] = useState<GymDetailRead | null>(null);
  const [activeGymId, setActiveGymId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const determineRole = useCallback(
    (gymId: string, gymDetail?: GymDetailRead | null): string | null => {
      // 1. Check gym detail roles
      if (gymDetail?.current_user_roles && gymDetail.current_user_roles.length > 0) {
        return gymDetail.current_user_roles[0];
      }
      // 2. Check profile affiliations
      if (profile?.gyms) {
        const aff = profile.gyms.find((g) => g.gym_id === gymId);
        if (aff) return aff.role;
      }
      if (profile?.is_super_admin) {
        return "owner";
      }
      return null;
    },
    [profile]
  );

  const fetchGymDetail = useCallback(
    async (gymId: string): Promise<GymDetailRead | null> => {
      try {
        const detail = await apiClient.gyms.get(gymId);
        return detail;
      } catch (err) {
        console.warn(`Failed to fetch gym detail for ${gymId}:`, err);
        return null;
      }
    },
    []
  );

  const refreshGyms = useCallback(
    async (preferredGymId?: string) => {
      if (!user) {
        setAccessibleGyms([]);
        setActiveGym(null);
        setActiveGymId(null);
        setCurrentRole(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const gyms = await apiClient.gyms.list();
        setAccessibleGyms(gyms);

        if (gyms.length === 0) {
          setActiveGym(null);
          setActiveGymId(null);
          setCurrentRole(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem(ACTIVE_GYM_STORAGE_KEY);
          }
          return;
        }

        // Determine target gym ID:
        // 1. Explicit preferredGymId parameter
        // 2. Stored localStorage ID if valid
        // 3. First accessible gym in list
        let targetId = preferredGymId;

        if (!targetId && typeof window !== "undefined") {
          const stored = localStorage.getItem(ACTIVE_GYM_STORAGE_KEY);
          if (stored && gyms.some((g) => g.id === stored)) {
            targetId = stored;
          }
        }

        if (!targetId || !gyms.some((g) => g.id === targetId)) {
          targetId = gyms[0].id;
        }

        setActiveGymId(targetId);
        if (typeof window !== "undefined") {
          localStorage.setItem(ACTIVE_GYM_STORAGE_KEY, targetId);
        }

        // Fetch detailed record
        const detail = await fetchGymDetail(targetId);
        if (detail) {
          setActiveGym(detail);
          setCurrentRole(determineRole(targetId, detail));
        } else {
          // Fallback to basic GymRead item
          const fallback = gyms.find((g) => g.id === targetId);
          if (fallback) {
            setActiveGym({
              ...fallback,
              current_user_roles: [],
              branches: [],
            });
            setCurrentRole(determineRole(targetId, null));
          }
        }
      } catch (err) {
        const msg = isApiClientError(err)
          ? err.detail
          : err instanceof Error
          ? err.message
          : "Failed to load gyms";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [user, fetchGymDetail, determineRole]
  );

  const switchGym = useCallback(
    async (newGymId: string): Promise<boolean> => {
      if (newGymId === activeGymId) {
        return true;
      }

      const gymExists = accessibleGyms.some((g) => g.id === newGymId);
      if (!gymExists) {
        console.warn(`Gym ID ${newGymId} is not in accessible gyms`);
        return false;
      }

      setIsSwitching(true);
      setError(null);

      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(ACTIVE_GYM_STORAGE_KEY, newGymId);
        }
        setActiveGymId(newGymId);

        const detail = await fetchGymDetail(newGymId);
        if (detail) {
          setActiveGym(detail);
          setCurrentRole(determineRole(newGymId, detail));
        } else {
          const fallback = accessibleGyms.find((g) => g.id === newGymId);
          if (fallback) {
            setActiveGym({
              ...fallback,
              current_user_roles: [],
              branches: [],
            });
            setCurrentRole(determineRole(newGymId, null));
          }
        }
        return true;
      } catch (err) {
        const msg = isApiClientError(err)
          ? err.detail
          : err instanceof Error
          ? err.message
          : "Failed to switch gym";
        setError(msg);
        return false;
      } finally {
        setIsSwitching(false);
      }
    },
    [activeGymId, accessibleGyms, fetchGymDetail, determineRole]
  );

  const clearActiveGym = useCallback(() => {
    setActiveGym(null);
    setActiveGymId(null);
    setCurrentRole(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(ACTIVE_GYM_STORAGE_KEY);
    }
  }, []);

  // Sync on initial load and auth state changes
  useEffect(() => {
    let isMounted = true;
    queueMicrotask(() => {
      if (isMounted) {
        refreshGyms();
      }
    });
    return () => {
      isMounted = false;
    };
  }, [refreshGyms]);

  return (
    <GymContext.Provider
      value={{
        accessibleGyms,
        activeGym,
        activeGymId,
        currentRole,
        isLoading,
        isSwitching,
        error,
        switchGym,
        refreshGyms,
        clearActiveGym,
      }}
    >
      {children}
    </GymContext.Provider>
  );
}

export function useGym() {
  const context = useContext(GymContext);
  if (!context) {
    throw new Error("useGym must be used within a GymProvider");
  }
  return context;
}
