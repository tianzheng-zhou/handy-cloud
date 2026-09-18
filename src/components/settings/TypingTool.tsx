import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import {
  useSetting,
  useSettingUpdating,
  useSettingsActions,
} from "../../hooks/useSettings";
import { useOsType } from "../../hooks/useOsType";
import { commands } from "@/bindings";
import type { TypingTool } from "@/bindings";

interface TypingToolProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

const allToolLabels: Record<string, string> = {
  wtype: "wtype",
  kwtype: "kwtype",
  dotool: "dotool",
  ydotool: "ydotool",
  xdotool: "xdotool",
};

export const TypingToolSetting: React.FC<TypingToolProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { updateSetting } = useSettingsActions();
    const setting_paste_method = useSetting("paste_method");
    const setting_typing_tool = useSetting("typing_tool");
    const updating_typing_tool = useSettingUpdating("typing_tool");
    const osType = useOsType();
    const [availableTools, setAvailableTools] = useState<string[] | null>(null);

    useEffect(() => {
      if (osType !== "linux") return;
      commands
        .getAvailableTypingTools()
        .then(setAvailableTools)
        .catch(() => {
          setAvailableTools(["auto"]);
        });
    }, [osType]);

    // Only show this setting on Linux
    if (osType !== "linux") {
      return null;
    }

    // Only show if paste method is "direct"
    const pasteMethod = setting_paste_method;
    if (pasteMethod !== "direct") {
      return null;
    }

    const tools = availableTools ?? ["auto"];
    const typingToolOptions = tools.map((tool) =>
      tool === "auto"
        ? {
            value: "auto",
            label: t("settings.advanced.typingTool.options.auto"),
          }
        : { value: tool, label: allToolLabels[tool] ?? tool },
    );

    const selectedTool = (setting_typing_tool || "auto") as TypingTool;

    return (
      <SettingContainer
        title={t("settings.advanced.typingTool.title")}
        description={t("settings.advanced.typingTool.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
        tooltipPosition="bottom"
      >
        <Dropdown
          options={typingToolOptions}
          selectedValue={selectedTool}
          onSelect={(value) =>
            updateSetting("typing_tool", value as TypingTool)
          }
          disabled={updating_typing_tool}
        />
      </SettingContainer>
    );
  },
);
