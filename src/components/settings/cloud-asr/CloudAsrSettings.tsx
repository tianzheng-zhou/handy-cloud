import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type CloudAsrModelOption } from "@/bindings";
import { SettingContainer, SettingsGroup } from "@/components/ui";
import { Select } from "@/components/ui/Select";
import { ApiKeyField } from "../PostProcessingSettingsApi/ApiKeyField";
import { BaseUrlField } from "../PostProcessingSettingsApi/BaseUrlField";
import { useSettingsStore } from "@/stores/settingsStore";

export const CloudAsrSettings: React.FC = () => {
  const { t } = useTranslation();
  const settings = useSettingsStore((state) => state.settings);
  const isUpdatingKey = useSettingsStore((state) => state.isUpdatingKey);
  const updateCloudAsrApiKey = useSettingsStore(
    (state) => state.updateCloudAsrApiKey,
  );
  const updateCloudAsrBaseUrl = useSettingsStore(
    (state) => state.updateCloudAsrBaseUrl,
  );
  const updateCloudAsrModel = useSettingsStore(
    (state) => state.updateCloudAsrModel,
  );

  const [modelOptions, setModelOptions] = useState<CloudAsrModelOption[]>([]);

  useEffect(() => {
    commands
      .getCloudAsrModels()
      .then((options) => setModelOptions(options))
      .catch((error) => {
        console.error("Failed to load cloud ASR models:", error);
      });
  }, []);

  const selectOptions = useMemo(
    () =>
      modelOptions.map((option) => ({
        value: option.id,
        label: option.label,
      })),
    [modelOptions],
  );

  const currentModel = settings?.cloud_asr_model ?? "";

  return (
    <div className="max-w-3xl w-full mx-auto space-y-4">
      <div className="mb-4">
        <h1 className="text-xl font-semibold mb-2">
          {t("settings.cloudAsr.title")}
        </h1>
        <p className="text-sm text-text/60">
          {t("settings.cloudAsr.description")}
        </p>
      </div>

      <SettingsGroup title={t("settings.cloudAsr.groupTitle")}>
        <SettingContainer
          title={t("settings.cloudAsr.apiKey.title")}
          description={t("settings.cloudAsr.apiKey.description")}
          descriptionMode="tooltip"
          layout="horizontal"
          grouped={true}
        >
          <div className="flex items-center gap-2">
            <ApiKeyField
              value={settings?.cloud_asr_api_key ?? ""}
              onBlur={updateCloudAsrApiKey}
              placeholder={t("settings.cloudAsr.apiKey.placeholder")}
              disabled={isUpdatingKey("cloud_asr_api_key")}
              className="min-w-[320px]"
            />
          </div>
        </SettingContainer>

        <SettingContainer
          title={t("settings.cloudAsr.baseUrl.title")}
          description={t("settings.cloudAsr.baseUrl.description")}
          descriptionMode="tooltip"
          layout="horizontal"
          grouped={true}
        >
          <div className="flex items-center gap-2">
            <BaseUrlField
              value={settings?.cloud_asr_base_url ?? ""}
              onBlur={updateCloudAsrBaseUrl}
              placeholder={t("settings.cloudAsr.baseUrl.placeholder")}
              disabled={isUpdatingKey("cloud_asr_base_url")}
              className="min-w-[380px]"
            />
          </div>
        </SettingContainer>

        <SettingContainer
          title={t("settings.cloudAsr.model.title")}
          description={t("settings.cloudAsr.model.description")}
          descriptionMode="tooltip"
          layout="horizontal"
          grouped={true}
        >
          <div className="flex items-center gap-2 min-w-[320px]">
            <Select
              value={currentModel || null}
              options={selectOptions}
              onChange={(value) => {
                if (value) {
                  void updateCloudAsrModel(value);
                }
              }}
              placeholder={t("settings.cloudAsr.model.placeholder")}
              disabled={
                isUpdatingKey("cloud_asr_model") || selectOptions.length === 0
              }
              isClearable={false}
              className="flex-1"
            />
          </div>
        </SettingContainer>
      </SettingsGroup>
    </div>
  );
};
