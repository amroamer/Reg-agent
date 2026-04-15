"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { clearTokens, isAuthenticated, setTokens } from "@/lib/auth";
import type { User } from "@/lib/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    if (!isAuthenticated()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<User>("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
      clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    setTokens(data.access_token, data.refresh_token);
    await fetchUser();
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    preferred_language: string = "en",
  ) => {
    const { data } = await api.post("/auth/register", {
      email,
      password,
      name,
      preferred_language,
    });
    setTokens(data.access_token, data.refresh_token);
    await fetchUser();
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    window.location.href = "/login";
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    login,
    register,
    logout,
  };
}
