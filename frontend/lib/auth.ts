export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function isAuthenticated(): boolean {
  const token = getAccessToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function getUserFromToken(): { sub: string; type: string } | null {
  const token = getAccessToken();
  if (!token) return null;

  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}
