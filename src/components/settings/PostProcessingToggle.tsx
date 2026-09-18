import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";

interface PostProcessingToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const PostProcessingToggle: React.FC<PostProcessingToggleProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_post_process_enabled = useSetting("post_process_enabled");
    const updating_post_process_enabled = useSettingUpdating(
      "post_process_enabled",
    );

    const enabled = setting_post_process_enabled || false;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(enabled) => updateSetting("post_process_enabled", enabled)}
        isUpdating={updating_post_process_enabled}
        label={t("settings.debug.postProcessingToggle.label")}
        description={t("settings.debug.postProcessingToggle.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  });
