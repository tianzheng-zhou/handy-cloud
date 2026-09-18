import { useEffect, useState } from "react";
import { commands } from "@/bindings";

let capability: Promise<boolean> | undefined;

export function useUpdateCapability(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    capability ??= commands.getUpdateCapability().catch(() => false);
    void capability.then((value) => {
      if (active) setEnabled(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return enabled;
}
