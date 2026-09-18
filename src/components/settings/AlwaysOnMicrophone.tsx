import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";

interface AlwaysOnMicrophoneProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const AlwaysOnMicrophone: React.FC<AlwaysOnMicrophoneProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_always_on_microphone = useSetting("always_on_microphone");
    const updating_always_on_microphone = useSettingUpdating(
      "always_on_microphone",
    );

    const alwaysOnMode = setting_always_on_microphone || false;

    return (
      <ToggleSwitch
        checked={alwaysOnMode}
        onChange={(enabled) => updateSetting("always_on_microphone", enabled)}
        isUpdating={updating_always_on_microphone}
        label={t("settings.debug.alwaysOnMicrophone.label")}
        description={t("settings.debug.alwaysOnMicrophone.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);
