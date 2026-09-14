import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImportWizardStepId = "map" | "speakers" | "confirm" | "people";

export interface ImportWizardStep {
  id: ImportWizardStepId;
  label: string;
  shortLabel: string;
}

export const IMPORT_WIZARD_STEPS: ImportWizardStep[] = [
  { id: "map", label: "Map & preview", shortLabel: "Map" },
  { id: "speakers", label: "Characters & Groups", shortLabel: "Speakers" },
  { id: "confirm", label: "Confirm & import", shortLabel: "Confirm" },
  { id: "people", label: "People", shortLabel: "People" },
];

interface ImportWizardStepperProps {
  currentStep: ImportWizardStepId;
  className?: string;
}

export default function ImportWizardStepper({
  currentStep,
  className,
}: ImportWizardStepperProps) {
  const currentIndex = IMPORT_WIZARD_STEPS.findIndex(
    (step) => step.id === currentStep,
  );
  const currentMeta = IMPORT_WIZARD_STEPS[currentIndex];

  return (
    <nav
      aria-label="Import wizard steps"
      className={cn(
        "rounded-lg border border-border bg-card px-3 py-3 sm:px-4",
        className,
      )}
    >
      {/* Single row of markers; labels only from md up so small screens stay tight. */}
      <ol className="flex items-center gap-0">
        {IMPORT_WIZARD_STEPS.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isCompleted = currentIndex > index;
          const isUpcoming = !isCurrent && !isCompleted;
          const showConnector = index < IMPORT_WIZARD_STEPS.length - 1;
          const connectorFilled = isCompleted || isCurrent;

          return (
            <li
              key={step.id}
              className={cn(
                "flex min-w-0 items-center",
                // Equal flex so connectors share space; markers stay fixed size.
                showConnector ? "flex-1" : "shrink-0",
              )}
            >
              <div
                className="flex shrink-0 flex-col items-center gap-1"
                {...(isCurrent ? { "aria-current": "step" as const } : {})}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                    isCurrent &&
                      "border-primary bg-primary text-primary-foreground",
                    isCompleted &&
                      "border-primary bg-primary/15 text-primary",
                    isUpcoming &&
                      "border-border bg-muted text-muted-foreground",
                  )}
                  title={step.label}
                  aria-label={step.label}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>
                {/* Compact short labels from md; full labels from lg. Hidden on mobile. */}
                <span
                  className={cn(
                    "hidden max-w-[5.5rem] truncate text-center text-[11px] leading-tight md:block lg:max-w-[7.5rem] lg:text-xs",
                    isCurrent && "font-semibold text-foreground",
                    isCompleted && "font-medium text-foreground",
                    isUpcoming && "text-muted-foreground",
                  )}
                  aria-hidden
                >
                  <span className="lg:hidden">{step.shortLabel}</span>
                  <span className="hidden lg:inline">{step.label}</span>
                </span>
              </div>
              {showConnector && (
                <div
                  aria-hidden
                  className={cn(
                    "mx-1.5 h-px min-w-[0.5rem] flex-1 sm:mx-2",
                    connectorFilled ? "bg-primary/40" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile caption: which step you're on when per-step labels are hidden. */}
      {currentMeta && (
        <p className="mt-2 text-center text-sm font-medium text-foreground md:hidden">
          Step {currentIndex + 1} of {IMPORT_WIZARD_STEPS.length}:{" "}
          {currentMeta.label}
        </p>
      )}
    </nav>
  );
}
