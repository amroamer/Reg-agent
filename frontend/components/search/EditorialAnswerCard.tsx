"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { useState } from "react";
import type { LLMAnswer, RegulationResult } from "@/lib/types";

interface EditorialAnswerCardProps {
  answer: LLMAnswer;
  sourcesUsed?: Array<{ label: string }>;
  samaRegs?: RegulationResult[];
  cmaRegs?: RegulationResult[];
  bankPols?: RegulationResult[];
}

function CitationChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 text-[11px] font-mono text-ink-soft bg-mark-soft border border-mark rounded align-baseline">
      {label}
    </span>
  );
}

/**
 * Parse answer text and inline-render citation references.
 * Looks for patterns like [SAMA-BCR-2024-01 · Art. 12] or SAMA-BCR-2024-01, Art. 12.
 */
function renderWithCitations(text: string): React.ReactNode[] {
  // Pattern: DOC-NUMBER · Art. N or §X.Y, or similar
  const pattern = /(\[?([A-Z]+(?:[-/][A-Z0-9]+)+)[\s·,]+(?:Art\.|Article|§)\s*([\d.]+)\]?)/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    parts.push(
      <CitationChip
        key={`c-${keyCounter++}`}
        label={`${match[2]} · Art. ${match[3]}`}
      />,
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts.length > 0 ? parts : [text];
}

export default function EditorialAnswerCard({
  answer,
  samaRegs = [],
  cmaRegs = [],
  bankPols = [],
}: EditorialAnswerCardProps) {
  const [expanded, setExpanded] = useState(true);

  const sourceChips: string[] = [];
  samaRegs.slice(0, 2).forEach((r) => {
    if (r.document_title) sourceChips.push(`SAMA: ${r.document_title}`);
  });
  cmaRegs.slice(0, 2).forEach((r) => {
    if (r.document_title) sourceChips.push(`CMA: ${r.document_title}`);
  });
  bankPols.slice(0, 2).forEach((r) => {
    if (r.document_title) sourceChips.push(`Bank: ${r.document_title}`);
  });

  const confidenceColor =
    answer.confidence === "high"
      ? "text-green-700 bg-green-50 border-green-200"
      : answer.confidence === "low"
        ? "text-red-700 bg-red-50 border-red-200"
        : "text-amber-700 bg-amber-50 border-amber-200";

  return (
    <div className="bg-white rounded-xl border border-paper-line p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-ink-soft" />
          <h3 className="font-semibold text-ink text-sm">AI-assisted summary</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${confidenceColor}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {answer.confidence} confidence
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-ink-muted hover:text-ink"
          >
            {expanded ? "▴" : "▾"}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <div
            className="text-[15px] leading-relaxed text-ink mb-4"
            dir={answer.language === "ar" ? "rtl" : "ltr"}
          >
            {renderWithCitations(answer.text)}
          </div>

          {sourceChips.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-4 border-t border-paper-line">
              <span className="text-xs text-ink-muted">Drawn from:</span>
              {sourceChips.map((s, i) => (
                <span
                  key={i}
                  className="text-[11px] text-ink px-2 py-0.5 bg-paper-soft border border-paper-line rounded-full"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 text-[12px] text-ink-muted bg-mark-soft border border-mark/40 rounded-lg p-3">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>
              AI-assisted summary. Always verify against the original text — use
              the citation chips above to jump to the source passage.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
