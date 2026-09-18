import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";
import { useUpdateCapability } from "../../hooks/useUpdateCapability";

interface UpdateChecksToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const UpdateChecksToggle: React.FC<UpdateChecksToggleProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
}) => {
  const { t } = useTranslation();
  const updateAvailable = useUpdateCapability();
  const { updateSetting } = useSettingsActions();
  const setting_update_checks_enabled = useSetting("update_checks_enabled");
  const updating_update_checks_enabled = useSettingUpdating(
    "update_checks_enabled",
  );
  const updateChecksEnabled = setting_update_checks_enabled ?? true;

  return (
    <ToggleSwitch
      disabled={!updateAvailable}
      checked={updateChecksEnabled}
      onChange={(enabled) => updateSetting("update_checks_enabled", enabled)}
      isUpdating={updating_update_checks_enabled}
      label={t("settings.debug.updateChecks.label")}
      description={t("settings.debug.updateChecks.description")}
      descriptionMode={descriptionMode}
      grouped={grouped}
    />
  );
};
