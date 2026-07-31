import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands, type CloudAsrModelOption } from "@/bindings";
import { useSettings } from "@/hooks/useSettings";

export const CloudAsrModelLabel: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting } = useSettings();
  const [modelOptions, setModelOptions] = useState<CloudAsrModelOption[]>([]);

  const currentModelId = getSetting("cloud_asr_model") ?? "";

  useEffect(() => {
    commands.getCloudAsrModels().then((result) => {
      if (result.status === "ok") {
        setModelOptions(result.data);
      }
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
