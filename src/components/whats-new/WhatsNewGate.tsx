import React, { useEffect, useRef, useState, lazy, Suspense } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { useSetting, useSettingsActions } from "../../hooks/useSettings";
import { useSettingsStore } from "../../stores/settingsStore";
import { findReleaseNoteToShow } from "./releaseNotes";
import type { ReleaseNote } from "./releaseNotes";
const WhatsNewModal = lazy(() =>
  import("./WhatsNewModal").then((module) => ({
    default: module.WhatsNewModal,
  })),
);

export const WhatsNewGate: React.FC = () => {
  const enabled = useSetting("show_whats_new_on_update");
  const lastSeenVersion = useSetting("whats_new_last_seen_version");
  const isLoading = useSettingsStore((state) => state.isLoading);
  const { updateSetting } = useSettingsActions();
  const [note, setNote] = useState<ReleaseNote | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dismissedVersionRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !enabled) {
      setIsOpen(false);
      setNote(null);
      return;
    }

    let cancelled = false;

    const loadReleaseNote = async () => {
      try {
        const currentVersion = await getVersion();
        if (cancelled) return;

        const releaseNote = findReleaseNoteToShow({
          currentVersion,
          lastSeenVersion: lastSeenVersion ?? "",
        });

        if (
          !releaseNote ||
          dismissedVersionRef.current === releaseNote.version
        ) {
          setIsOpen(false);
          setNote(null);
          return;
        }

        setNote(releaseNote);
        setIsOpen(true);
      } catch (error) {
        console.error("Failed to load release notes:", error);
      }
    };

    void loadReleaseNote();

    return () => {
      cancelled = true;
    };
  }, [isLoading, enabled, lastSeenVersion]);

  const dismiss = () => {
    if (!note) return;

    dismissedVersionRef.current = note.version;
    setIsOpen(false);
    void updateSetting("whats_new_last_seen_version", note.version);
  };

  if (!note) return null;

  return (
    <Suspense fallback={null}>
      <WhatsNewModal note={note} open={isOpen} onDismiss={dismiss} />
    </Suspense>
  );
};
