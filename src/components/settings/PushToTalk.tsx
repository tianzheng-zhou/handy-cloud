import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";

interface PushToTalkProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const PushToTalk: React.FC<PushToTalkProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_push_to_talk = useSetting("push_to_talk");
    const updating_push_to_talk = useSettingUpdating("push_to_talk");

    const pttEnabled = setting_push_to_talk || false;

    return (
      <ToggleSwitch
        checked={pttEnabled}
        onChange={(enabled) => updateSetting("push_to_talk", enabled)}
        isUpdating={updating_push_to_talk}
        label={t("settings.general.pushToTalk.label")}
        description={t("settings.general.pushToTalk.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);
