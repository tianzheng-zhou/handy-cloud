import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";

interface ShowTrayIconProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const ShowTrayIcon: React.FC<ShowTrayIconProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_show_tray_icon = useSetting("show_tray_icon");
    const updating_show_tray_icon = useSettingUpdating("show_tray_icon");

    const showTrayIcon = setting_show_tray_icon ?? true;

    return (
      <ToggleSwitch
        checked={showTrayIcon}
        onChange={(enabled) => updateSetting("show_tray_icon", enabled)}
        isUpdating={updating_show_tray_icon}
        label={t("settings.advanced.showTrayIcon.label")}
        description={t("settings.advanced.showTrayIcon.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
        tooltipPosition="bottom"
      />
    );
  },
);
