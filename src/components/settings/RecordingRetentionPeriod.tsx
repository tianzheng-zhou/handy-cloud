import React from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";
import { RecordingRetentionPeriod } from "@/bindings";

interface RecordingRetentionPeriodProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const RecordingRetentionPeriodSelector: React.FC<RecordingRetentionPeriodProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_recording_retention_period = useSetting(
      "recording_retention_period",
    );
    const setting_history_limit = useSetting("history_limit");
    const updating_recording_retention_period = useSettingUpdating(
      "recording_retention_period",
    );

    const selectedRetentionPeriod =
      setting_recording_retention_period || "never";
    const historyLimit = setting_history_limit || 5;

    const handleRetentionPeriodSelect = (period: string) => {
      return updateSetting(
        "recording_retention_period",
        period as RecordingRetentionPeriod,
      );
    };

    const retentionOptions = [
      { value: "never", label: t("settings.debug.recordingRetention.never") },
      {
        value: "preserve_limit",
        label: t("settings.debug.recordingRetention.preserveLimit", {
          count: Number(historyLimit),
        }),
      },
      { value: "days3", label: t("settings.debug.recordingRetention.days3") },
      { value: "weeks2", label: t("settings.debug.recordingRetention.weeks2") },
      {
        value: "months3",
        label: t("settings.debug.recordingRetention.months3"),
      },
    ];

    return (
      <SettingContainer
        title={t("settings.debug.recordingRetention.title")}
        description={t("settings.debug.recordingRetention.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <Dropdown
          options={retentionOptions}
          selectedValue={selectedRetentionPeriod}
          onSelect={handleRetentionPeriodSelect}
          placeholder={t("settings.debug.recordingRetention.placeholder")}
          disabled={updating_recording_retention_period}
        />
      </SettingContainer>
    );
  });

RecordingRetentionPeriodSelector.displayName =
  "RecordingRetentionPeriodSelector";
