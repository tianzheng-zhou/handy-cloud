import React from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";
import type { ClipboardHandling } from "@/bindings";

interface ClipboardHandlingProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const ClipboardHandlingSetting: React.FC<ClipboardHandlingProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_clipboard_handling = useSetting("clipboard_handling");
    const updating_clipboard_handling =
      useSettingUpdating("clipboard_handling");

    const clipboardHandlingOptions = [
      {
        value: "dont_modify",
        label: t("settings.advanced.clipboardHandling.options.dontModify"),
      },
      {
        value: "copy_to_clipboard",
        label: t("settings.advanced.clipboardHandling.options.copyToClipboard"),
      },
    ];

    const selectedHandling = (setting_clipboard_handling ||
      "dont_modify") as ClipboardHandling;

    return (
      <SettingContainer
        title={t("settings.advanced.clipboardHandling.title")}
        description={t("settings.advanced.clipboardHandling.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <Dropdown
          options={clipboardHandlingOptions}
          selectedValue={selectedHandling}
          onSelect={(value) =>
            updateSetting("clipboard_handling", value as ClipboardHandling)
          }
          disabled={updating_clipboard_handling}
        />
      </SettingContainer>
    );
  });
