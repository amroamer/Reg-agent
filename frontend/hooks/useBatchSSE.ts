"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BatchDetail, QueueItem } from "@/lib/types";

interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}

export function useBatchSSE(batchId: string | null) {
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const updateQueueItem = useCallback(
    (documentId: string, update: Partial<QueueItem>) => {
      setBatch((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          queue_items: prev.queue_items.map((qi) =>
            qi.document_id === documentId ? { ...qi, ...update } : qi,
          ),
        };
      });
    },
    [],
  );

  useEffect(() => {
    if (!batchId) return;

    const url = `/api/batches/${batchId}/events`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setIsConnected(true);
    es.onerror = () => setIsConnected(false);

    es.addEventListener("snapshot", (e) => {
      try {
        const data = JSON.parse(e.data);
        setBatch((prev) => (prev ? { ...prev, ...data } : prev));
      } catch {}
    });

    es.addEventListener("document_started", (e) => {
      try {
        const data = JSON.parse(e.data);
        updateQueueItem(data.document_id, {
          status: "processing",
          current_stage: "extraction",
        });
      } catch {}
    });

    es.addEventListener("stage_changed", (e) => {
      try {
        const data = JSON.parse(e.data);
        updateQueueItem(data.document_id, {
          current_stage: data.stage,
        });
      } catch {}
    });

    es.addEventListener("document_completed", (e) => {
      try {
        const data = JSON.parse(e.data);
        updateQueueItem(data.document_id, {
          status: "completed",
          current_stage: null,
        });
        setBatch((prev) =>
          prev
            ? {
                ...prev,
                completed_documents: prev.completed_documents + 1,
              }
            : prev,
        );
      } catch {}
    });

    es.addEventListener("document_failed", (e) => {
      try {
        const data = JSON.parse(e.data);
        updateQueueItem(data.document_id, {
          status: "failed",
          error_message: data.error as string,
          current_stage: data.stage as string,
        });
        setBatch((prev) =>
          prev
            ? { ...prev, failed_documents: prev.failed_documents + 1 }
            : prev,
        );
      } catch {}
    });

    es.addEventListener("batch_completed", (e) => {
      try {
        const data = JSON.parse(e.data);
        setBatch((prev) =>
          prev ? { ...prev, status: data.status as string } : prev,
        );
        es.close();
      } catch {}
    });

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [batchId, updateQueueItem]);

  return { batch, setBatch, isConnected };
}
