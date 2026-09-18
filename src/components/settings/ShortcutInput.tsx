import React from "react";
import { useSetting } from "../../hooks/useSettings";
import { GlobalShortcutInput } from "./GlobalShortcutInput";
import { HandyKeysShortcutInput } from "./HandyKeysShortcutInput";

interface ShortcutInputProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  shortcutId: string;
  disabled?: boolean;
}

/**
 * Wrapper component that selects the appropriate shortcut input implementation
 * based on the keyboard_implementation setting.
 *
 * - "tauri" (default): Uses GlobalShortcutInput with JS keyboard events
 * - "handy_keys": Uses HandyKeysShortcutInput with backend key events
 */
export const ShortcutInput: React.FC<ShortcutInputProps> = (props) => {
  const setting_keyboard_implementation = useSetting("keyboard_implementation");

  const keyboardImplementation = setting_keyboard_implementation;

  // Default to Tauri implementation if not set
  if (keyboardImplementation === "handy_keys") {
    return <HandyKeysShortcutInput {...props} />;
  }

  return <GlobalShortcutInput {...props} />;
};
