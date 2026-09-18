import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";

interface AppendTrailingSpaceProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const AppendTrailingSpace: React.FC<AppendTrailingSpaceProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_append_trailing_space = useSetting("append_trailing_space");
    const updating_append_trailing_space = useSettingUpdating(
      "append_trailing_space",
    );

    const enabled = setting_append_trailing_space ?? false;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(enabled) => updateSetting("append_trailing_space", enabled)}
        isUpdating={updating_append_trailing_space}
        label={t("settings.debug.appendTrailingSpace.label")}
        description={t("settings.debug.appendTrailingSpace.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  });
