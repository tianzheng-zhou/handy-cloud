//! One-time, non-destructive import from the original Handy application.

use anyhow::{Context, Result};
use rusqlite::{Connection, OpenFlags, MAIN_DB};
use std::fs::{self, OpenOptions};
use std::path::Path;
use tauri::Manager;

const LEGACY_ID: &str = "com.pais.handy";
const ITEMS: &[&str] = &[
    "settings_store.json",
    "history.db",
    "recordings",
    "custom_start.wav",
    "custom_stop.wav",
];
const STAGING: &str = ".legacy-import";
const COMPLETE: &str = ".legacy-import-complete";

/// Import before either the settings store or history manager opens user data.
pub fn import_legacy_data(app: &tauri::AppHandle) -> Result<()> {
    if crate::portable::is_portable() {
        return Ok(());
    }
    let destination = app.path().app_data_dir()?;
    let source = app.path().data_dir()?.join(LEGACY_ID);
    import_from(&source, &destination)
}

fn import_from(source: &Path, destination: &Path) -> Result<()> {
    if !source.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(destination)?;
    // Headless invocations can start alongside the GUI's first launch.
    let lock = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(destination.join(".legacy-import.lock"))?;
    lock.lock().context("Could not lock the data migration")?;
    if destination.join(COMPLETE).exists() {
        return Ok(());
    }

    let staging = destination.join(STAGING);
    let ready = staging.join("ready");
    if !ready.exists() {
        if ITEMS.iter().any(|item| destination.join(item).exists()) {
            return Ok(());
        }
        // An interrupted copy never becomes visible to the application.
        if staging.exists() {
            fs::remove_dir_all(&staging)?;
        }
        fs::create_dir(&staging)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&staging, fs::Permissions::from_mode(0o700))?;
        }
        for item in ITEMS {
            let from = source.join(item);
            if !from.exists() {
                continue;
            }
            let to = staging.join(item);
            if from.symlink_metadata()?.file_type().is_symlink() {
                anyhow::bail!(
                    "Legacy data must not be a symbolic link: {}",
                    from.display()
                );
            }
            if *item == "history.db" {
                // A raw file copy would miss committed pages in a SQLite WAL.
                let database =
                    Connection::open_with_flags(&from, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
                database.backup(MAIN_DB, &to, None)?;
                fs::set_permissions(&to, fs::metadata(&from)?.permissions())?;
            } else {
                copy_data(&from, &to)?;
            }
        }
        let settings_path = staging.join("settings_store.json");
        if settings_path.exists() {
            let mut value: serde_json::Value =
                serde_json::from_slice(&fs::read(&settings_path)?)
                    .context("Legacy settings are not valid JSON; original data was left intact")?;
            if let Some(store) = value.as_object_mut() {
                store.remove("screencast_restore_token");
                if let Some(settings) = store.get_mut("settings").and_then(|v| v.as_object_mut()) {
                    settings.remove("cloud_asr_screencast_restore_token");
                }
            }
            fs::write(&settings_path, serde_json::to_vec_pretty(&value)?)?;
        }
        fs::write(&ready, b"ready")?;
    }

    // Resume a partially committed import. Never replace a destination file.
    for item in ITEMS {
        let from = staging.join(item);
        let to = destination.join(item);
        if from.exists() && !to.exists() {
            fs::rename(from, to)?;
        }
    }
    fs::write(
        destination.join(COMPLETE),
        b"Imported from com.pais.handy; original data retained",
    )?;
    fs::remove_dir_all(staging)?;
    Ok(())
}

fn copy_data(source: &Path, destination: &Path) -> Result<()> {
    let metadata = source.symlink_metadata()?;
    if metadata.is_dir() {
        fs::create_dir(destination)?;
        for entry in fs::read_dir(source)? {
            let entry = entry?;
            copy_data(&entry.path(), &destination.join(entry.file_name()))?;
        }
    } else if metadata.is_file() {
        fs::copy(source, destination)?;
    } else {
        anyhow::bail!("Unsupported legacy data file: {}", source.display());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn imports_wal_database_settings_and_recordings_without_changing_source() {
        let source = tempfile::tempdir().unwrap();
        let destination = tempfile::tempdir().unwrap();
        let settings = br#"{"settings":{"cloud_asr_api_key":"test-key","cloud_asr_screencast_restore_token":"old","push_to_talk":false},"screencast_restore_token":"old"}"#;
        fs::write(source.path().join("settings_store.json"), settings).unwrap();
        fs::create_dir(source.path().join("recordings")).unwrap();
        fs::write(source.path().join("recordings/one.wav"), b"audio").unwrap();
        let db = Connection::open(source.path().join("history.db")).unwrap();
        db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE history(text TEXT); INSERT INTO history VALUES ('hello');").unwrap();
        import_from(source.path(), destination.path()).unwrap();
        let imported: serde_json::Value = serde_json::from_slice(
            &fs::read(destination.path().join("settings_store.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(imported["settings"]["cloud_asr_api_key"], "test-key");
        assert_eq!(imported["settings"]["push_to_talk"], false);
        assert!(imported.get("screencast_restore_token").is_none());
        assert!(imported["settings"]
            .get("cloud_asr_screencast_restore_token")
            .is_none());
        assert_eq!(
            fs::read(source.path().join("settings_store.json")).unwrap(),
            settings
        );
        let copied = Connection::open(destination.path().join("history.db")).unwrap();
        assert_eq!(
            copied
                .query_row("SELECT text FROM history", [], |row| row
                    .get::<_, String>(0))
                .unwrap(),
            "hello"
        );
        assert_eq!(
            fs::read(destination.path().join("recordings/one.wav")).unwrap(),
            b"audio"
        );
        import_from(source.path(), destination.path()).unwrap();
    }

    #[test]
    fn existing_user_data_is_never_overwritten() {
        let source = tempfile::tempdir().unwrap();
        let destination = tempfile::tempdir().unwrap();
        fs::write(source.path().join("settings_store.json"), b"{}").unwrap();
        fs::write(
            destination.path().join("settings_store.json"),
            b"new settings",
        )
        .unwrap();
        import_from(source.path(), destination.path()).unwrap();
        assert_eq!(
            fs::read(destination.path().join("settings_store.json")).unwrap(),
            b"new settings"
        );
    }

    #[test]
    fn failed_copy_can_retry_and_partial_commit_can_resume() {
        let source = tempfile::tempdir().unwrap();
        let destination = tempfile::tempdir().unwrap();
        fs::write(source.path().join("settings_store.json"), b"invalid JSON").unwrap();
        assert!(import_from(source.path(), destination.path()).is_err());
        assert!(!destination.path().join("settings_store.json").exists());
        fs::write(source.path().join("settings_store.json"), b"{}").unwrap();
        import_from(source.path(), destination.path()).unwrap();
        fs::remove_file(destination.path().join(COMPLETE)).unwrap();
        let stage = destination.path().join(STAGING);
        fs::create_dir(&stage).unwrap();
        fs::write(stage.join("ready"), b"ready").unwrap();
        fs::write(stage.join("custom_start.wav"), b"sound").unwrap();
        import_from(source.path(), destination.path()).unwrap();
        assert_eq!(
            fs::read(destination.path().join("custom_start.wav")).unwrap(),
            b"sound"
        );
    }
}
