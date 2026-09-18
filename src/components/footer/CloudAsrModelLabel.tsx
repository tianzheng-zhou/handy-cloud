import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type CloudAsrModelOption } from "@/bindings";
import { useSetting } from "@/hooks/useSettings";

export const CloudAsrModelLabel: React.FC = () => {
  const { t } = useTranslation();
  const [modelOptions, setModelOptions] = useState<CloudAsrModelOption[]>([]);

  const currentModelId = useSetting("cloud_asr_model") ?? "";

  useEffect(() => {
    commands
      .getCloudAsrModels()
      .then((options) => setModelOptions(options))
      .catch((error) => {
        console.error("Failed to load cloud ASR models:", error);
      });
  }, []);

  const label = useMemo(() => {
    const match = modelOptions.find((option) => option.id === currentModelId);
    return match?.label ?? currentModelId;
  }, [currentModelId, modelOptions]);

  if (!label) {
    return null;
  }

  return (
    <span className="text-text/60 truncate max-w-[200px]" title={label}>
      {t("footer.cloudAsrModel", { model: label })}
    </span>
  );
};
