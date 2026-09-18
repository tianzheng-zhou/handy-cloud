import React from "react";
import { useTranslation } from "react-i18next";
import { SettingContainer } from "../../ui/SettingContainer";
import { Dropdown, type DropdownOption } from "../../ui/Dropdown";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../../hooks/useSettings";
import { commands } from "@/bindings";
import { toast } from "sonner";

const KEYBOARD_IMPLEMENTATION_OPTIONS: DropdownOption[] = [
  { value: "tauri", label: "Tauri Global Shortcut" },
  { value: "handy_keys", label: "Handy Keys" },
];

interface KeyboardImplementationSelectorProps {
  descriptionMode?: "tooltip" | "inline";
  grouped?: boolean;
}

export const KeyboardImplementationSelector: React.FC<
  KeyboardImplementationSelectorProps
> = ({ descriptionMode = "tooltip", grouped = false }) => {
  const { t } = useTranslation();
  const { refreshSettings } = useSettingsActions();
  const setting_keyboard_implementation = useSetting("keyboard_implementation");
  const updating_keyboard_implementation = useSettingUpdating(
    "keyboard_implementation",
  );
  const currentImplementation = setting_keyboard_implementation ?? "tauri";

  const handleSelect = async (value: string) => {
    if (value === currentImplementation) return;

    try {
      const result = await commands.changeKeyboardImplementationSetting(value);

      if (result.status === "error") {
        console.error(
          "Failed to update keyboard implementation:",
          result.error,
        );
        toast.error(String(result.error));
        return;
      }

      // If any bindings were reset due to incompatibility, notify the user
      if (result.data.reset_bindings.length > 0) {
        toast.warning(t("settings.debug.keyboardImplementation.bindingsReset"));
      }

      await refreshSettings();
    } catch (error) {
      console.error("Failed to update keyboard implementation:", error);
      toast.error(String(error));
    }
  };

  return (
    <SettingContainer
      title={t("settings.debug.keyboardImplementation.title")}
      description={t("settings.debug.keyboardImplementation.description")}
      descriptionMode={descriptionMode}
      grouped={grouped}
      layout="horizontal"
    >
      <Dropdown
        options={KEYBOARD_IMPLEMENTATION_OPTIONS}
        selectedValue={currentImplementation}
        onSelect={handleSelect}
        disabled={updating_keyboard_implementation}
      />
    </SettingContainer>
  );
};
