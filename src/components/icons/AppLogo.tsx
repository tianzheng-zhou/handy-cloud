import React from "react";
import { useTranslation } from "react-i18next";
// Same artwork as the dock/taskbar icon, so the two always match.
import appIcon from "../../../src-tauri/icons/128x128@2x.png";

// Brand name, not translated (the "Cloud" edition label is).
const BRAND_NAME = "Handy";

const SIZES = {
  sm: { icon: "size-9 rounded-[9px]", name: "text-[17px]", sub: "text-xs" },
  lg: { icon: "size-14 rounded-[14px]", name: "text-2xl", sub: "text-sm" },
};

interface AppLogoProps {
  size?: keyof typeof SIZES;
  className?: string;
}

const AppLogo: React.FC<AppLogoProps> = ({ size = "sm", className = "" }) => {
  const { t } = useTranslation();
  const s = SIZES[size];

  return (
    <div
      role="img"
      aria-label={t("app.name")}
      className={`flex items-center gap-2.5 select-none ${className}`}
    >
      <img
        src={appIcon}
        alt=""
        draggable={false}
        className={`${s.icon} shrink-0 shadow-sm shadow-black/15`}
      />
      <div aria-hidden="true" className="leading-tight">
        <div className={`${s.name} font-bold tracking-tight text-text`}>
          {BRAND_NAME}
        </div>
        <div className={`${s.sub} font-semibold text-accent`}>
          {t("app.cloud")}
        </div>
      </div>
    </div>
  );
};

export default AppLogo;
