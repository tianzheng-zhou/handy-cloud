import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";

interface LazyStreamCloseProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const LazyStreamClose: React.FC<LazyStreamCloseProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_lazy_stream_close = useSetting("lazy_stream_close");
    const updating_lazy_stream_close = useSettingUpdating("lazy_stream_close");

    const enabled = setting_lazy_stream_close ?? false;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(enabled) => updateSetting("lazy_stream_close", enabled)}
        isUpdating={updating_lazy_stream_close}
        label={t("settings.advanced.lazyStreamClose.label")}
        description={t("settings.advanced.lazyStreamClose.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);
