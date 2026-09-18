import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";

interface MuteWhileRecordingToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const MuteWhileRecording: React.FC<MuteWhileRecordingToggleProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_mute_while_recording = useSetting("mute_while_recording");
    const updating_mute_while_recording = useSettingUpdating(
      "mute_while_recording",
    );

    const muteEnabled = setting_mute_while_recording ?? false;

    return (
      <ToggleSwitch
        checked={muteEnabled}
        onChange={(enabled) => updateSetting("mute_while_recording", enabled)}
        isUpdating={updating_mute_while_recording}
        label={t("settings.debug.muteWhileRecording.label")}
        description={t("settings.debug.muteWhileRecording.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  });
