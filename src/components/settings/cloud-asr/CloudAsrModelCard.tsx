import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Zap, Sparkles } from "lucide-react";

export type CloudAsrModelCardInfo = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  /** 0–1 relative scores for the bars (visual only) */
  accuracyScore: number;
  affordabilityScore: number;
  recommended?: boolean;
  icon: "flash" | "plus";
};

interface CloudAsrModelCardProps {
  model: CloudAsrModelCardInfo;
  active: boolean;
  disabled?: boolean;
  onSelect: (modelId: string) => void;
}

const ScoreBar: React.FC<{ label: string; score: number }> = ({
  label,
  score,
}) => (
  <div className="flex items-center gap-3 min-w-0">
    <span className="shrink-0 whitespace-nowrap text-xs text-text/55">
      {label}
    </span>
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(score * 100)}
      className="h-1.5 flex-1 rounded-full bg-mid-gray/20 overflow-hidden"
    >
      <div
        className="h-full rounded-full bg-logo-primary"
        style={{ width: `${score * 100}%` }}
      />
    </div>
  </div>
);

export const CloudAsrModelCard: React.FC<CloudAsrModelCardProps> = ({
  model,
  active,
  disabled = false,
  onSelect,
}) => {
  const { t } = useTranslation();
  const clickable = !active && !disabled;
  const Icon = model.icon === "flash" ? Zap : Sparkles;

  const handleActivate = () => {
    if (!clickable) return;
    onSelect(model.id);
  };

  return (
    <div
      role="button"
      aria-label={t(model.nameKey)}
      aria-pressed={active}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
      className={[
        "group flex flex-col gap-3 rounded-xl border p-4 text-left w-full min-w-0 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-logo-primary/60",
        active
          ? "border-logo-primary bg-logo-primary/[0.07] ring-1 ring-logo-primary"
          : "border-mid-gray/25",
        clickable
          ? "cursor-pointer hover:border-logo-primary/60 hover:bg-mid-gray/[0.04]"
          : active
            ? ""
            : "opacity-50 cursor-not-allowed",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
            active
              ? "bg-logo-primary/20 text-background-ui"
              : "bg-mid-gray/10 text-text/50"
          }`}
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-text leading-5">
              {t(model.nameKey)}
            </h3>
            {model.recommended && (
              <span className="rounded-full bg-logo-primary/20 px-2 text-[11px] font-medium leading-5 text-text/80">
                {t("onboarding.recommended")}
              </span>
            )}
          </div>
          <p
            className="font-mono text-[11px] leading-4 text-text/40 truncate"
            title={model.id}
          >
            {model.id}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            active
              ? "border-background-ui bg-background-ui text-white"
              : "border-mid-gray/40 group-hover:border-logo-primary"
          }`}
        >
          {active && <Check className="size-3" strokeWidth={3} />}
        </span>
      </div>

      <p className="text-sm text-text/65 leading-relaxed sm:ps-12">
        {t(model.descriptionKey)}
      </p>

      <div className="sm:ms-12 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        <ScoreBar
          label={t("settings.cloudAsr.scores.accuracy")}
          score={model.accuracyScore}
        />
        <ScoreBar
          label={t("settings.cloudAsr.scores.affordability")}
          score={model.affordabilityScore}
        />
      </div>
    </div>
  );
};
