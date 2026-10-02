import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Zap, Sparkles } from "lucide-react";
import Badge from "@/components/ui/Badge";

export type CloudAsrModelCardInfo = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  /** 0–1 relative scores for the bars (visual only) */
  speedScore?: number;
  accuracyScore?: number;
  recommended?: boolean;
  icon: "flash" | "plus";
};

interface CloudAsrModelCardProps {
  model: CloudAsrModelCardInfo;
  active: boolean;
  disabled?: boolean;
  onSelect: (modelId: string) => void;
}

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
        "flex flex-col rounded-xl px-4 py-3 gap-2 text-left transition-all duration-200 border-2 w-full min-w-0",
        active
          ? "border-logo-primary/50 bg-logo-primary/10"
          : "border-mid-gray/20",
        clickable
          ? "cursor-pointer hover:border-logo-primary/50 hover:bg-logo-primary/5 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] group"
          : active
            ? ""
            : "opacity-50 cursor-not-allowed",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex justify-between items-start gap-3 w-full">
        <div className="flex flex-col items-start flex-1 min-w-0 gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon
              className={`w-4 h-4 shrink-0 ${active ? "text-logo-primary" : "text-text/50"}`}
            />
            <h3
              className={`text-base font-semibold text-text ${clickable ? "group-hover:text-logo-primary" : ""} transition-colors`}
            >
              {t(model.nameKey)}
            </h3>
            {model.recommended && (
              <Badge variant="primary">{t("onboarding.recommended")}</Badge>
            )}
            {active && (
              <Badge variant="primary">
                <Check className="w-3 h-3 mr-1" />
                {t("modelSelector.active")}
              </Badge>
            )}
          </div>
          <p className="text-text/60 text-sm leading-relaxed">
            {t(model.descriptionKey)}
          </p>
        </div>

        {model.speedScore !== undefined &&
          model.accuracyScore !== undefined && (
            <div className="hidden sm:flex items-center shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-text/60 w-20 text-end">
                    {t("onboarding.modelCard.accuracy")}
                  </p>
                  <div className="w-14 h-1.5 bg-mid-gray/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-logo-primary rounded-full"
                      style={{ width: `${model.accuracyScore * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-text/60 w-20 text-end">
                    {t("onboarding.modelCard.speed")}
                  </p>
                  <div className="w-14 h-1.5 bg-mid-gray/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-logo-primary rounded-full"
                      style={{ width: `${model.speedScore * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>

      <hr className="w-full border-mid-gray/20" />

      <p className="text-xs text-text/45 truncate" title={model.id}>
        {model.id}
      </p>
    </div>
  );
};
