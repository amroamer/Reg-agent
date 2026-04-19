import clsx from "clsx";
import { Check } from "lucide-react";

interface Step {
  key: string;
  label: string;
}

interface StepWizardProps {
  steps: Step[];
  current: number; // 0-indexed
}

export default function StepWizard({ steps, current }: StepWizardProps) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((step, i) => {
        const isDone = i < current;
        const isActive = i === current;
        return (
          <div key={step.key} className="flex items-center gap-2 flex-1">
            <div
              className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0",
                isDone && "bg-green-500 text-white",
                isActive && "bg-kpmg-blue text-white",
                !isDone && !isActive && "bg-gray-200 text-gray-500",
              )}
            >
              {isDone ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={clsx(
                "text-sm font-medium flex-shrink-0",
                isActive ? "text-kpmg-blue" : isDone ? "text-gray-800" : "text-gray-400",
              )}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={clsx(
                  "flex-1 h-0.5 mx-2",
                  isDone ? "bg-green-500" : "bg-gray-200",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
