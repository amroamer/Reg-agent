"use client";

import { useLanguage } from "@/hooks/useLanguage";
import type { LLMAnswer } from "@/lib/types";
import { Bot, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { useState } from "react";

interface AnswerCardProps {
  answer: LLMAnswer;
}

export default function AnswerCard({ answer }: AnswerCardProps) {
  const { t } = useLanguage();
  const [showCitations, setShowCitations] = useState(false);

  return (
    <div className="bg-kpmg-blue/5 border border-kpmg-blue/20 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Bot className="w-5 h-5 text-kpmg-blue" />
        <h3 className="font-semibold text-kpmg-blue">{t("aiSummary")}</h3>
        <span
          className={`ms-auto px-2 py-0.5 rounded-full text-xs font-medium ${
            answer.confidence === "high"
              ? "bg-green-100 text-green-700"
              : answer.confidence === "medium"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {answer.confidence}
        </span>
      </div>

      {/* Answer Text */}
      <div
        className="prose prose-sm max-w-none text-gray-800 mb-4"
        dir={answer.language === "ar" ? "rtl" : "ltr"}
      >
        <p className={answer.language === "ar" ? "font-arabic" : ""}>
          {answer.text}
        </p>
      </div>

      {/* Citations Toggle */}
      {answer.citations && answer.citations.length > 0 && (
        <button
          onClick={() => setShowCitations(!showCitations)}
          className="flex items-center gap-1 text-sm text-kpmg-blue hover:underline"
        >
          {showCitations ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          {answer.citations.length} citations
        </button>
      )}

      {showCitations && (
        <div className="mt-3 space-y-2">
          {answer.citations.map((citation, i) => (
            <div
              key={i}
              className="text-xs text-gray-600 bg-white rounded-lg p-2 border border-gray-100"
            >
              {JSON.stringify(citation)}
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-4 flex items-start gap-2 text-xs text-gray-500 bg-white/50 rounded-lg p-3">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-yellow-500" />
        <span>{t("aiDisclaimer")}</span>
      </div>
    </div>
  );
}
