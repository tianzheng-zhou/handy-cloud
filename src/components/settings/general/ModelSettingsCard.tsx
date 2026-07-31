import React from "react";
import { useTranslation } from "react-i18next";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { LanguageSelector } from "../LanguageSelector";
import { TranslateToEnglish } from "../TranslateToEnglish";

export const ModelSettingsCard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <SettingsGroup title={t("settings.modelSettings.cloudTitle")}>
      <LanguageSelector
        descriptionMode="tooltip"
        grouped={true}
        supportsLanguageDetection={true}
      />
      <TranslateToEnglish descriptionMode="tooltip" grouped={true} />
    </SettingsGroup>
  );
};
