import React from "react";
import { useTranslation } from "react-i18next";
import { SettingContainer, SettingsGroup } from "@/components/ui";
import { ApiKeyField } from "../PostProcessingSettingsApi/ApiKeyField";
import { BaseUrlField } from "../PostProcessingSettingsApi/BaseUrlField";
import { useSetting, useSettingUpdating } from "@/hooks/useSettings";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  CloudAsrModelCard,
  type CloudAsrModelCardInfo,
} from "./CloudAsrModelCard";

const CLOUD_ASR_MODELS: CloudAsrModelCardInfo[] = [
  {
    id: "qwen3.5-omni-flash",
    nameKey: "settings.cloudAsr.models.flash.name",
    descriptionKey: "settings.cloudAsr.models.flash.description",
    speedScore: 0.95,
    accuracyScore: 0.75,
    recommended: true,
    icon: "flash",
  },
  {
    id: "qwen3.5-omni-plus",
    nameKey: "settings.cloudAsr.models.plus.name",
    descriptionKey: "settings.cloudAsr.models.plus.description",
    speedScore: 0.65,
    accuracyScore: 0.95,
    icon: "plus",
  },
];

export const CloudAsrSettings: React.FC = () => {
  const { t } = useTranslation();
  const apiKey = useSetting("cloud_asr_api_key") ?? "";
  const baseUrl = useSetting("cloud_asr_base_url") ?? "";
  const currentModel = useSetting("cloud_asr_model") ?? "";
  const savingKey = useSettingUpdating("cloud_asr_api_key");
  const savingUrl = useSettingUpdating("cloud_asr_base_url");
  const selectingModel = useSettingUpdating("cloud_asr_model");
  const updateCloudAsrApiKey = useSettingsStore(
    (state) => state.updateCloudAsrApiKey,
  );
  const updateCloudAsrBaseUrl = useSettingsStore(
    (state) => state.updateCloudAsrBaseUrl,
  );
  const updateCloudAsrModel = useSettingsStore(
    (state) => state.updateCloudAsrModel,
  );

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 px-3 sm:px-4 box-border">
      <div className="mb-2">
        <h1 className="text-xl font-semibold mb-2">
          {t("settings.cloudAsr.title")}
        </h1>
        <p className="text-sm text-text/60 leading-relaxed">
          {t("settings.cloudAsr.description")}
        </p>
      </div>

      <SettingsGroup title={t("settings.cloudAsr.model.groupTitle")}>
        <div className="flex flex-col gap-3 p-3">
          {CLOUD_ASR_MODELS.map((model) => (
            <CloudAsrModelCard
              key={model.id}
              model={model}
              active={currentModel === model.id}
              disabled={selectingModel}
              onSelect={(id) => {
                void updateCloudAsrModel(id);
              }}
            />
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title={t("settings.cloudAsr.groupTitle")}>
        <SettingContainer
          title={t("settings.cloudAsr.apiKey.title")}
          description={t("settings.cloudAsr.apiKey.description")}
          descriptionMode="tooltip"
          layout="stacked"
          grouped={true}
        >
          <ApiKeyField
            value={apiKey}
            onBlur={updateCloudAsrApiKey}
            placeholder={t("settings.cloudAsr.apiKey.placeholder")}
            disabled={savingKey}
            className="w-full min-w-0"
          />
        </SettingContainer>

        <SettingContainer
          title={t("settings.cloudAsr.baseUrl.title")}
          description={t("settings.cloudAsr.baseUrl.description")}
          descriptionMode="tooltip"
          layout="stacked"
          grouped={true}
        >
          <BaseUrlField
            value={baseUrl}
            onBlur={updateCloudAsrBaseUrl}
            placeholder={t("settings.cloudAsr.baseUrl.placeholder")}
            disabled={savingUrl}
            className="w-full min-w-0"
          />
        </SettingContainer>
      </SettingsGroup>
    </div>
  );
};
