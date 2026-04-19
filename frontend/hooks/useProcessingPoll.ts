"use client";

import { useEffect, useRef } from "react";
import api from "@/lib/api";

interface ProcessingStatus {
  id: string;
  status: string;
  current_stage: string | null;
  stage_progress: Record<string, { status: string; duration_s?: number }>;
  total_articles: number | null;
  total_chunks: number | null;
  error_message: string | null;
}

/**
 * Poll /api/documents/processing-status every `intervalMs` while active.
 * Calls `onUpdate` with the array of active docs.
 * Automatically stops polling when there are no active (pending/processing) docs.
 */
export function useProcessingPoll(
  active: boolean,
  onUpdate: (statuses: ProcessingStatus[]) => void,
  intervalMs = 3000,
) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;

    const tick = async () => {
      try {
        const { data } = await api.get<ProcessingStatus[]>(
          "/documents/processing-status",
        );
        onUpdate(data);
      } catch {
        // silent
      }
    };

    tick();
    timerRef.current = setInterval(tick, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active, onUpdate, intervalMs]);
}
