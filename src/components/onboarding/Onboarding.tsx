import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { commands } from "@/bindings";
import HandyTextLogo from "../icons/HandyTextLogo";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      toast.error(t("onboarding.cloudAsr.errors.apiKeyRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const keyResult = await commands.changeCloudAsrApiKey(trimmed);
      if (keyResult.status === "error") {
        toast.error(keyResult.error);
        return;
      }

      const completeResult = await commands.completeCloudAsrOnboarding();
      if (completeResult.status === "error") {
        toast.error(completeResult.error);
        return;
      }

      onComplete();
    } catch (error) {
      console.error("Failed to complete cloud ASR onboarding:", error);
      toast.error(t("onboarding.cloudAsr.errors.setupFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col p-6 gap-4 inset-0">
      <div className="flex flex-col items-center gap-2 shrink-0">
        <HandyTextLogo width={200} />
        <p className="text-text/70 max-w-md font-medium mx-auto text-center">
          {t("onboarding.cloudAsr.subtitle")}
        </p>
      </div>

      <div className="max-w-[600px] w-full mx-auto flex-1 flex flex-col min-h-0 justify-center">
        <div className="space-y-4">
          <div className="text-left space-y-2">
            <h2 className="text-sm font-medium text-text/80">
              {t("onboarding.cloudAsr.apiKey.title")}
            </h2>
            <p className="text-sm text-text/60">
              {t("onboarding.cloudAsr.apiKey.description")}
            </p>
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              disabled={isSubmitting}
              placeholder={t("onboarding.cloudAsr.apiKey.placeholder")}
              variant="compact"
              className="w-full"
            />
          </div>

          <Button
            onClick={() => void handleContinue()}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting
              ? t("onboarding.cloudAsr.continueLoading")
              : t("onboarding.cloudAsr.continue")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
