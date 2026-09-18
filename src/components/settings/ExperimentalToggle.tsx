import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";

interface ExperimentalToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const ExperimentalToggle: React.FC<ExperimentalToggleProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_experimental_enabled = useSetting("experimental_enabled");
    const updating_experimental_enabled = useSettingUpdating(
      "experimental_enabled",
    );

    const enabled = setting_experimental_enabled || false;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(enabled) => updateSetting("experimental_enabled", enabled)}
        isUpdating={updating_experimental_enabled}
        label={t("settings.advanced.experimentalToggle.label")}
        description={t("settings.advanced.experimentalToggle.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);
