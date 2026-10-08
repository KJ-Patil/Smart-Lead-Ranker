"use client";

import { Check, Target, Upload, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { label: "Define Target", icon: Target },
  { label: "Add Leads", icon: Upload },
  { label: "Review & Export", icon: BarChart3 },
];

interface StepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  completedSteps?: number[];
}

export function Stepper({ currentStep, onStepClick, completedSteps = [] }: StepperProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const completed = completedSteps.includes(i) || i < currentStep;
        const active = i === currentStep;
        const clickable = !!onStepClick && (completed || active);

        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(i)}
                className={cn(
                  "clay-stepper-dot flex h-10 w-10 items-center justify-center rounded-full border-2",
                  completed && "bg-primary border-primary text-primary-foreground",
                  active && "border-primary text-primary bg-primary/10",
                  !completed && !active && "border-border text-muted-foreground",
                  clickable && "cursor-pointer hover:opacity-80",
                  !clickable && "cursor-default"
                )}
              >
                {completed && !active ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </button>
              <span className={cn(
                "mt-1.5 text-xs font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-16 mx-2 mt-[-16px]",
                  completed ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
