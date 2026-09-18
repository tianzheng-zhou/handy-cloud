import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";

interface VoiceActivityDetectionProps {
  descriptionMode?: "tooltip" | "inline";
  grouped?: boolean;
}

export const VoiceActivityDetection: React.FC<VoiceActivityDetectionProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
}) => {
  const { t } = useTranslation();
  const { updateSetting } = useSettingsActions();
  const setting_vad_enabled = useSetting("vad_enabled");
  const updating_vad_enabled = useSettingUpdating("vad_enabled");
  const enabled = setting_vad_enabled ?? true;

  return (
    <ToggleSwitch
      checked={enabled}
      onChange={(enabled) => updateSetting("vad_enabled", enabled)}
      isUpdating={updating_vad_enabled}
      label={t("settings.advanced.voiceActivityDetection.title")}
      description={t("settings.advanced.voiceActivityDetection.description")}
      descriptionMode={descriptionMode}
      grouped={grouped}
    />
  );
};
