import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";

interface ShowWhatsNewOnUpdateProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const ShowWhatsNewOnUpdate: React.FC<ShowWhatsNewOnUpdateProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
}) => {
  const { t } = useTranslation();
  const { updateSetting } = useSettingsActions();
  const setting_show_whats_new_on_update = useSetting(
    "show_whats_new_on_update",
  );
  const updating_show_whats_new_on_update = useSettingUpdating(
    "show_whats_new_on_update",
  );
  const enabled = setting_show_whats_new_on_update ?? true;

  return (
    <ToggleSwitch
      checked={enabled}
      onChange={(nextEnabled) =>
        updateSetting("show_whats_new_on_update", nextEnabled)
      }
      isUpdating={updating_show_whats_new_on_update}
      label={t("settings.about.whatsNewUpdates.label")}
      description={t("settings.about.whatsNewUpdates.description")}
      descriptionMode={descriptionMode}
      grouped={grouped}
    />
  );
};
