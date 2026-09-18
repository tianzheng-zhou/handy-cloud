import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";

interface TranslateToEnglishProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const TranslateToEnglish: React.FC<TranslateToEnglishProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_translate_to_english = useSetting("translate_to_english");
    const updating_translate_to_english = useSettingUpdating(
      "translate_to_english",
    );

    const translateToEnglish = setting_translate_to_english || false;

    return (
      <ToggleSwitch
        checked={translateToEnglish}
        onChange={(enabled) => updateSetting("translate_to_english", enabled)}
        isUpdating={updating_translate_to_english}
        label={t("settings.advanced.translateToEnglish.label")}
        description={t("settings.advanced.translateToEnglish.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);
