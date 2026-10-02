import React, { lazy } from "react";
import type { AppSettings } from "@/bindings";
import { useTranslation } from "react-i18next";
import { Cog, FlaskConical, History, Info, Sparkles, Cpu } from "lucide-react";
import AppLogo from "./icons/AppLogo";
import HandyHand from "./icons/HandyHand";
import { useSetting } from "../hooks/useSettings";
const GeneralSettings = lazy(() =>
  import("./settings/general/GeneralSettings").then((module) => ({
    default: module.GeneralSettings,
  })),
);
const AdvancedSettings = lazy(() =>
  import("./settings/advanced/AdvancedSettings").then((module) => ({
    default: module.AdvancedSettings,
  })),
);
const HistorySettings = lazy(() =>
  import("./settings/history/HistorySettings").then((module) => ({
    default: module.HistorySettings,
  })),
);
const DebugSettings = lazy(() =>
  import("./settings/debug/DebugSettings").then((module) => ({
    default: module.DebugSettings,
  })),
);
const AboutSettings = lazy(() =>
  import("./settings/about/AboutSettings").then((module) => ({
    default: module.AboutSettings,
  })),
);
const PostProcessingSettings = lazy(() =>
  import("./settings/post-processing/PostProcessingSettings").then(
    (module) => ({ default: module.PostProcessingSettings }),
  ),
);
const CloudAsrSettings = lazy(() =>
  import("./settings/cloud-asr/CloudAsrSettings").then((module) => ({
    default: module.CloudAsrSettings,
  })),
);

export type SidebarSection = keyof typeof SECTIONS_CONFIG;

interface IconProps {
  width?: number | string;
  height?: number | string;
  size?: number | string;
  className?: string;
}

interface SectionConfig {
  labelKey: string;
  icon: React.ComponentType<IconProps>;
  component: React.ComponentType;
  enabled: (settings: AppSettings | null) => boolean;
}

export const SECTIONS_CONFIG = {
  general: {
    labelKey: "sidebar.general",
    icon: HandyHand,
    component: GeneralSettings,
    enabled: () => true,
  },
  history: {
    labelKey: "sidebar.history",
    icon: History,
    component: HistorySettings,
    enabled: () => true,
  },
  cloudAsr: {
    labelKey: "sidebar.cloudAsr",
    icon: Cpu,
    component: CloudAsrSettings,
    enabled: () => true,
  },
  advanced: {
    labelKey: "sidebar.advanced",
    icon: Cog,
    component: AdvancedSettings,
    enabled: () => true,
  },
  postprocessing: {
    labelKey: "sidebar.postProcessing",
    icon: Sparkles,
    component: PostProcessingSettings,
    enabled: (settings) => settings?.post_process_enabled ?? false,
  },
  debug: {
    labelKey: "sidebar.debug",
    icon: FlaskConical,
    component: DebugSettings,
    enabled: (settings) => settings?.debug_mode ?? false,
  },
  about: {
    labelKey: "sidebar.about",
    icon: Info,
    component: AboutSettings,
    enabled: () => true,
  },
} as const satisfies Record<string, SectionConfig>;

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { t } = useTranslation();
  const settings: AppSettings = {
    debug_mode: useSetting("debug_mode"),
    post_process_enabled: useSetting("post_process_enabled"),
  };

  const availableSections = Object.entries(SECTIONS_CONFIG)
    .filter(([_, config]) => config.enabled(settings))
    .map(([id, config]) => ({ id: id as SidebarSection, ...config }));

  return (
    <div className="flex flex-col w-40 shrink-0 h-full border-e border-mid-gray/20 items-center px-2">
      <AppLogo className="self-start mx-2 my-4" />
      <div className="flex flex-col w-full items-center gap-1 pt-2 border-t border-mid-gray/20">
        {availableSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <button
              type="button"
              aria-current={isActive ? "page" : undefined}
              key={section.id}
              className={`flex gap-2 items-center p-2 w-full min-w-0 rounded-lg cursor-pointer transition-colors ${
                isActive
                  ? "bg-background-ui/15 text-accent"
                  : "hover:bg-mid-gray/20 hover:opacity-100 opacity-85"
              }`}
              onClick={() => onSectionChange(section.id)}
            >
              <Icon width={24} height={24} className="shrink-0" />
              <p
                className="text-sm font-medium leading-tight break-words min-w-0"
                title={t(section.labelKey)}
              >
                {t(section.labelKey)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
