"use client";

import { useCallback, useState } from "react";
import api from "@/lib/api";
import type { SearchRequest, SearchResponse } from "@/lib/types";

export function useSearch() {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (request: SearchRequest) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<SearchResponse>("/search", request);
      setResults(data);
      return data;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Search failed";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return { results, loading, error, search, clearResults };
}
