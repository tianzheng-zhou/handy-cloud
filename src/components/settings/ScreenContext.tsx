import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { type } from "@tauri-apps/plugin-os";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { Dropdown, type DropdownOption } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";
import type { ScreenCaptureMethod } from "@/bindings";

interface ScreenContextProps {
  descriptionMode?: "tooltip" | "inline";
  grouped?: boolean;
}

type AuthorizeResultPayload = {
  ok: boolean;
  error?: string;
  bytes?: number;
};

export const ScreenContext: React.FC<ScreenContextProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating, refreshSettings } =
    useSettings();
  const isLinux = type() === "linux";
  const enabled = getSetting("cloud_asr_screen_context") || false;
  const method = (getSetting("cloud_asr_screen_capture_method") ||
    "screenshot") as ScreenCaptureMethod;

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<AuthorizeResultPayload>(
      "screen-context-authorize-result",
      (event) => {
        if (event.payload.ok) {
          void refreshSettings();
          return;
        }
        const message =
          event.payload.error ||
          t("settings.advanced.screenContext.authorizeFailed");
        window.alert(message);
        void refreshSettings();
      },
    ).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [refreshSettings, t]);

  const methodOptions: DropdownOption[] = [
    {
      value: "screenshot",
      label: t("settings.advanced.screenContext.method.options.screenshot"),
    },
    {
      value: "screencast",
      label: t("settings.advanced.screenContext.method.options.screencast"),
    },
  ];

  return (
    <>
      <ToggleSwitch
        checked={enabled}
        onChange={(next) => {
          void updateSetting("cloud_asr_screen_context", next).catch(
            (error) => {
              const message =
                error instanceof Error
                  ? error.message
                  : t("settings.advanced.screenContext.authorizeFailed");
              window.alert(message);
            },
          );
        }}
        isUpdating={isUpdating("cloud_asr_screen_context")}
        label={t("settings.advanced.screenContext.label")}
        description={t("settings.advanced.screenContext.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />

      {enabled && isLinux && (
        <SettingContainer
          title={t("settings.advanced.screenContext.method.title")}
          description={t("settings.advanced.screenContext.method.description")}
          descriptionMode={descriptionMode}
          grouped={grouped}
        >
          <Dropdown
            options={methodOptions}
            selectedValue={method}
            onSelect={(value) => {
              void updateSetting(
                "cloud_asr_screen_capture_method",
                value as ScreenCaptureMethod,
              ).catch((error) => {
                const message =
                  error instanceof Error
                    ? error.message
                    : t("settings.advanced.screenContext.authorizeFailed");
                window.alert(message);
              });
            }}
            disabled={isUpdating("cloud_asr_screen_capture_method")}
          />
        </SettingContainer>
      )}
    </>
  );
};
