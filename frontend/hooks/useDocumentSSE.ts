"use client";

import { useEffect, useRef, useState } from "react";
import type { StageState } from "@/components/documents/IngestionProgress";

interface SnapshotData {
  document_id: string;
  status: string;
  total_articles: number;
  total_chunks: number;
  page_count: number | null;
  error_message: string | null;
}

export interface DocumentIngestionState {
  status: string;
  currentStage: string | null;
  stages: Record<string, StageState>;
  totalArticles: number;
  totalChunks: number;
  pageCount: number | null;
  errorMessage: string | null;
  startedAt: Date | null;
}

const INITIAL_STATE: DocumentIngestionState = {
  status: "pending",
  currentStage: null,
  stages: {},
  totalArticles: 0,
  totalChunks: 0,
  pageCount: null,
  errorMessage: null,
  startedAt: null,
};

export function useDocumentSSE(documentId: string | null) {
  const [state, setState] = useState<DocumentIngestionState>(INITIAL_STATE);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!documentId) return;

    setState({ ...INITIAL_STATE, startedAt: new Date() });

    const es = new EventSource(
      `/api/documents/${documentId}/ingestion-events`,
    );
    esRef.current = es;

    es.addEventListener("snapshot", (e) => {
      try {
        const data: SnapshotData = JSON.parse(e.data);
        setState((prev) => ({
          ...prev,
          status: data.status,
          totalArticles: data.total_articles,
          totalChunks: data.total_chunks,
          pageCount: data.page_count,
          errorMessage: data.error_message,
        }));
      } catch {}
    });

    es.addEventListener("stage_changed", (e) => {
      try {
        const data = JSON.parse(e.data);
        setState((prev) => ({
          ...prev,
          currentStage: data.stage,
          status: "processing",
          stages: {
            ...prev.stages,
            [data.stage]: { status: "processing" },
          },
        }));
      } catch {}
    });

    es.addEventListener("stage_completed", (e) => {
      try {
        const data = JSON.parse(e.data);
        setState((prev) => ({
          ...prev,
          stages: {
            ...prev.stages,
            [data.stage]: {
              status: "completed",
              duration_s: data.duration_s,
            },
          },
        }));
      } catch {}
    });

    es.addEventListener("document_completed", (e) => {
      try {
        const data = JSON.parse(e.data);
        setState((prev) => ({
          ...prev,
          status: "indexed",
          currentStage: null,
          totalArticles: data.total_articles,
          totalChunks: data.total_chunks,
          pageCount: data.total_pages || prev.pageCount,
        }));
        es.close();
      } catch {}
    });

    es.addEventListener("document_failed", (e) => {
      try {
        const data = JSON.parse(e.data);
        setState((prev) => ({
          ...prev,
          status: "failed",
          errorMessage: data.error,
        }));
        es.close();
      } catch {}
    });

    return () => {
      es.close();
    };
  }, [documentId]);

  return state;
}
