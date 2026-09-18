import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";

interface AutostartToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const AutostartToggle: React.FC<AutostartToggleProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_autostart_enabled = useSetting("autostart_enabled");
    const updating_autostart_enabled = useSettingUpdating("autostart_enabled");

    const autostartEnabled = setting_autostart_enabled ?? false;

    return (
      <ToggleSwitch
        checked={autostartEnabled}
        onChange={(enabled) => updateSetting("autostart_enabled", enabled)}
        isUpdating={updating_autostart_enabled}
        label={t("settings.advanced.autostart.label")}
        description={t("settings.advanced.autostart.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);
