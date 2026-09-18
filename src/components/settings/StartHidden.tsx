import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";

interface StartHiddenProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const StartHidden: React.FC<StartHiddenProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_start_hidden = useSetting("start_hidden");
    const updating_start_hidden = useSettingUpdating("start_hidden");

    const startHidden = setting_start_hidden ?? false;

    return (
      <ToggleSwitch
        checked={startHidden}
        onChange={(enabled) => updateSetting("start_hidden", enabled)}
        isUpdating={updating_start_hidden}
        label={t("settings.advanced.startHidden.label")}
        description={t("settings.advanced.startHidden.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
        tooltipPosition="bottom"
      />
    );
  },
);
