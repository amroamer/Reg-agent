"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { Shield, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login, register } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      router.push("/");
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail || "Authentication failed");
      } else {
        setError("Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-kpmg-blue text-white mb-4">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-kpmg-blue">RegInspector</h1>
        <p className="text-sm text-gray-500 font-arabic mt-1">مُفتِّش الأنظمة</p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">
          {isRegister ? t("registerTitle") : t("loginTitle")}
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-kpmg-blue"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-kpmg-blue"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-kpmg-blue"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-kpmg-blue text-white rounded-lg font-medium hover:bg-kpmg-blue-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRegister ? t("register") : t("login")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          {isRegister ? t("hasAccount") : t("noAccount")}{" "}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="text-kpmg-blue font-medium hover:underline"
          >
            {isRegister ? t("login") : t("register")}
          </button>
        </p>
      </div>
    </div>
  );
}
