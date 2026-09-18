import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../../hooks/useSettings";
import { useOsType } from "../../../hooks/useOsType";

interface ReliablePasteToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const ReliablePasteToggle: React.FC<ReliablePasteToggleProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
}) => {
  const { t } = useTranslation();
  const { updateSetting } = useSettingsActions();
  const setting_reliable_paste = useSetting("reliable_paste");
  const updating_reliable_paste = useSettingUpdating("reliable_paste");
  const osType = useOsType();

  // The receipt-sequenced paste path is implemented for macOS and Windows.
  if (osType !== "macos" && osType !== "windows") {
    return null;
  }

  return (
    <ToggleSwitch
      checked={setting_reliable_paste ?? false}
      onChange={(enabled) => updateSetting("reliable_paste", enabled)}
      isUpdating={updating_reliable_paste}
      label={t("settings.debug.reliablePaste.title")}
      description={t("settings.debug.reliablePaste.description")}
      descriptionMode={descriptionMode}
      grouped={grouped}
    />
  );
};
