//! Optional screen-context capture for Qwen Omni multimodal transcription.
//!
//! Linux: method is user-selectable — Screenshot portal, ScreenCast + one
//! PipeWire frame via `gst-launch-1.0` (silent after share grant), or on X11
//! sessions a direct read of the root window through GDK (silent, no prompt).
//! Windows/macOS: xcap monitor capture (method setting ignored).

use image::codecs::jpeg::JpegEncoder;
use image::{DynamicImage, ExtendedColorType, GenericImageView, ImageEncoder};
use log::{debug, info, warn};
use once_cell::sync::Lazy;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

/// Longest edge after downscale. Keeps OCR usable while staying well under the
/// DashScope Base64 limit (encoded string must be < 10MB).
const MAX_EDGE: u32 = 1600;
const JPEG_QUALITY: u8 = 80;
/// Soft cap on JPEG bytes before we re-encode at lower quality.
const MAX_JPEG_BYTES: usize = 2 * 1024 * 1024;
/// Hotkey ScreenCast budget (portal restore + gst). 6s was too tight in practice.
#[cfg(target_os = "linux")]
const HOTKEY_SCREENCAST_TIMEOUT: Duration = Duration::from_secs(15);
/// Hotkey Screenshot-portal budget. The portal answers in well under a second
/// once permission is granted; anything longer means it is wedged.
#[cfg(target_os = "linux")]
const HOTKEY_SCREENSHOT_TIMEOUT: Duration = Duration::from_secs(8);
/// How long `gst-launch-1.0` may block waiting for its single PipeWire buffer.
#[cfg(target_os = "linux")]
const GST_GRAB_TIMEOUT: Duration = Duration::from_secs(6);
/// Marker in the error text so callers can tell "wedged" from "wrong property".
#[cfg(target_os = "linux")]
const GST_TIMEOUT_MARKER: &str = "timed out";
/// Budget for the GTK main thread to service an X11 root-window grab.
#[cfg(target_os = "linux")]
const X11_GRAB_TIMEOUT: Duration = Duration::from_secs(5);

static PENDING: Lazy<Mutex<PendingCapture>> = Lazy::new(|| Mutex::new(PendingCapture::Idle));
/// Serialize portal / gst work so authorize + hotkey capture don't race.
static PORTAL_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));
/// Drop stale authorize results when the user switches methods quickly.
static AUTHORIZE_GENERATION: AtomicU64 = AtomicU64::new(0);
/// Last successful hotkey/authorize JPEG — emergency fallback only.
type CapturedFrame = Option<(Instant, Vec<u8>)>;
static LAST_JPEG: Lazy<Mutex<CapturedFrame>> = Lazy::new(|| Mutex::new(None));
const LAST_JPEG_MAX_AGE: Duration = Duration::from_secs(45);

enum PendingCapture {
    Idle,
    InFlight(JoinHandle<Option<Vec<u8>>>),
}

/// The one Tokio runtime every portal call must use — and it must outlive them all.
///
/// `ashpd` memoizes its D-Bus connection in a process-global `OnceLock`, and zbus
/// (built with its `tokio` feature) drives that connection's socket reader with
/// `tokio::task::spawn`, binding it to whatever runtime happened to be current when
/// the connection was first opened. Building a throwaway `current_thread` runtime per
/// capture therefore worked exactly once: dropping the runtime killed the socket
/// reader, and every later portal call wrote its request to a connection whose replies
/// nobody was reading — hanging until our own timeout fired. That is what surfaced as
/// "Screenshot authorization timed out" and as hotkey captures silently degrading to
/// audio-only after the first success.
///
/// A `Lazy` static is never dropped, so the reader task lives for the whole process.
/// Multi-threaded (not `current_thread`) so the reader keeps draining between calls,
/// and `block_on` imposes no `Send` bound — portal sessions and `OwnedFd` stay `!Send`.
#[cfg(target_os = "linux")]
static PORTAL_RT: Lazy<tokio::runtime::Runtime> = Lazy::new(|| {
    tokio::runtime::Builder::new_multi_thread()
        .worker_threads(1)
        .enable_all()
        .thread_name("handy-portal")
        .build()
        .expect("failed to build the screen-context portal runtime")
});

/// Start capturing a JPEG screenshot in a background thread.
pub fn kickoff_capture(app: &AppHandle) {
    clear();
    let app = app.clone();
    let handle = std::thread::spawn(move || {
        let started = Instant::now();
        let result = {
            // Wait for any in-flight authorize so we share one portal session.
            let _portal = PORTAL_LOCK.lock().unwrap_or_else(|e| e.into_inner());
            capture_primary_jpeg(&app)
        };
        match result {
            Ok(bytes) => {
                info!(
                    "Screen context captured: {} KB JPEG in {:?}",
                    bytes.len() / 1024,
                    started.elapsed()
                );
                remember_jpeg(&bytes);
                Some(bytes)
            }
            Err(e) => {
                if let Some(bytes) = take_recent_jpeg() {
                    warn!(
                        "Screen context capture failed ({e}); reusing last frame ({} KB)",
                        bytes.len() / 1024
                    );
                    Some(bytes)
                } else {
                    warn!(
                        "Screen context capture failed (will send audio only): {}",
                        e
                    );
                    None
                }
            }
        }
    });
    if let Ok(mut guard) = PENDING.lock() {
        *guard = PendingCapture::InFlight(handle);
    }
}

fn remember_jpeg(bytes: &[u8]) {
    if let Ok(mut guard) = LAST_JPEG.lock() {
        *guard = Some((Instant::now(), bytes.to_vec()));
    }
}

fn take_recent_jpeg() -> Option<Vec<u8>> {
    let Ok(guard) = LAST_JPEG.lock() else {
        return None;
    };
    let (when, bytes) = guard.as_ref()?;
    if when.elapsed() <= LAST_JPEG_MAX_AGE {
        Some(bytes.clone())
    } else {
        None
    }
}

/// Wait for any in-flight capture and return JPEG bytes if available.
pub fn take_jpeg() -> Option<Vec<u8>> {
    let pending = {
        let Ok(mut guard) = PENDING.lock() else {
            return None;
        };
        std::mem::replace(&mut *guard, PendingCapture::Idle)
    };
    match pending {
        PendingCapture::Idle => None,
        PendingCapture::InFlight(handle) => match handle.join() {
            Ok(bytes) => bytes,
            Err(_) => {
                warn!("Screen context capture thread panicked");
                None
            }
        },
    }
}

/// Drop any pending capture (e.g. on cancel).
pub fn clear() {
    let pending = {
        let Ok(mut guard) = PENDING.lock() else {
            return;
        };
        std::mem::replace(&mut *guard, PendingCapture::Idle)
    };
    if let PendingCapture::InFlight(handle) = pending {
        std::thread::spawn(move || {
            let _ = handle.join();
        });
    }
}

/// Why authorization was started — used to revert settings on failure.
#[derive(Debug, Clone, Copy)]
pub enum AuthorizeKind {
    /// User turned on "Use screen as context".
    Enable,
    /// User changed capture method while screen context is already on.
    MethodChange,
}

#[cfg(target_os = "linux")]
fn has_screencast_token(app: &AppHandle) -> bool {
    crate::settings::get_screencast_restore_token(app).is_some()
}

/// Start authorization in the background and return immediately.
///
/// Must not run inside a sync Tauri command that waits: joining portal work
/// freezes the GTK UI, and calling `window_handle()` off the main thread
/// deadlocks Wayland (no share dialog ever appears).
pub fn kickoff_authorize(app: &AppHandle, kind: AuthorizeKind) {
    #[cfg(target_os = "linux")]
    {
        use crate::settings::ScreenCaptureMethod;
        // Switching back to ScreenCast with a saved token must NOT open another
        // share dialog — silent restore is enough. Re-prompting races with
        // hotkey capture and often hangs with no UI.
        if matches!(kind, AuthorizeKind::MethodChange)
            && selected_capture_method(app) == ScreenCaptureMethod::Screencast
            && has_screencast_token(app)
        {
            info!("ScreenCast already authorized (restore token present); skipping share dialog");
            use tauri::Emitter;
            let _ = app.emit(
                "screen-context-authorize-result",
                serde_json::json!({ "ok": true, "bytes": 0, "skipped": true }),
            );
            return;
        }
    }

    let generation = AUTHORIZE_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    focus_main_window(app);
    let app = app.clone();
    std::thread::spawn(move || {
        // Let the UI finish the settings invoke and keep focus.
        std::thread::sleep(Duration::from_millis(400));
        if AUTHORIZE_GENERATION.load(Ordering::SeqCst) != generation {
            debug!("Skipping stale screen-context authorize (gen={generation})");
            return;
        }
        focus_main_window(&app);

        let started = Instant::now();
        let result = {
            let _portal = PORTAL_LOCK.lock().unwrap_or_else(|e| e.into_inner());
            if AUTHORIZE_GENERATION.load(Ordering::SeqCst) != generation {
                debug!("Skipping stale screen-context authorize after lock (gen={generation})");
                return;
            }
            authorize_capture_on_worker(&app)
        };

        if AUTHORIZE_GENERATION.load(Ordering::SeqCst) != generation {
            debug!("Discarding stale screen-context authorize result (gen={generation})");
            return;
        }

        match &result {
            Ok(bytes) => info!(
                "Screen context authorization ok: {} KB JPEG in {:?}",
                bytes / 1024,
                started.elapsed()
            ),
            Err(e) => {
                warn!("Screen context authorization failed: {e}");
                if matches!(kind, AuthorizeKind::Enable) {
                    let enabled = crate::settings::get_settings(&app).cloud_asr_screen_context;
                    #[cfg(target_os = "linux")]
                    let keep_enabled = has_screencast_token(&app);
                    #[cfg(not(target_os = "linux"))]
                    let keep_enabled = false;
                    if enabled && !keep_enabled {
                        if let Err(error) = crate::settings::update_settings(&app, |s| {
                            s.cloud_asr_screen_context = false;
                            Ok(())
                        }) {
                            warn!("Could not persist screen context state: {error}");
                        }
                    }
                }
            }
        }

        use tauri::Emitter;
        let payload = match result {
            Ok(bytes) => serde_json::json!({ "ok": true, "bytes": bytes }),
            Err(e) => serde_json::json!({ "ok": false, "error": e }),
        };
        let _ = app.emit("screen-context-authorize-result", payload);
    });
}

fn authorize_capture_on_worker(app: &AppHandle) -> Result<usize, String> {
    #[cfg(target_os = "linux")]
    {
        let rgba = PORTAL_RT.block_on(capture_primary_rgba_for_authorize(app))?;
        let bytes = encode_jpeg(rgba)?;
        remember_jpeg(&bytes);
        Ok(bytes.len())
    }
    #[cfg(not(target_os = "linux"))]
    {
        capture_primary_jpeg(app).map(|b| b.len())
    }
}

/// Clear persisted ScreenCast restore token (e.g. when disabling the setting).
pub fn clear_restore_token(app: &AppHandle) -> Result<(), String> {
    if crate::settings::get_screencast_restore_token(app).is_some() {
        crate::settings::set_screencast_restore_token(app, None)?;
        debug!("Cleared ScreenCast restore token");
    }
    Ok(())
}

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn capture_primary_jpeg(app: &AppHandle) -> Result<Vec<u8>, String> {
    let rgba = capture_primary_rgba(app)?;
    encode_jpeg(rgba)
}

fn encode_jpeg(rgba: image::RgbaImage) -> Result<Vec<u8>, String> {
    let mut img = DynamicImage::ImageRgba8(rgba);
    let (w, h) = img.dimensions();
    let longest = w.max(h);
    if longest > MAX_EDGE {
        let scale = MAX_EDGE as f32 / longest as f32;
        let nw = ((w as f32) * scale).round().max(1.0) as u32;
        let nh = ((h as f32) * scale).round().max(1.0) as u32;
        img = img.resize(nw, nh, image::imageops::FilterType::Triangle);
    }

    let rgb = img.to_rgb8();
    let mut quality = JPEG_QUALITY;
    loop {
        let mut buf = Vec::new();
        let encoder = JpegEncoder::new_with_quality(&mut buf, quality);
        encoder
            .write_image(
                rgb.as_raw(),
                rgb.width(),
                rgb.height(),
                ExtendedColorType::Rgb8,
            )
            .map_err(|e| format!("JPEG encode failed: {}", e))?;
        if buf.len() <= MAX_JPEG_BYTES || quality <= 40 {
            return Ok(buf);
        }
        quality = quality.saturating_sub(15);
        debug!(
            "Screen JPEG {} bytes too large; retrying at quality {}",
            buf.len(),
            quality
        );
    }
}

#[cfg(target_os = "linux")]
fn selected_capture_method(app: &AppHandle) -> crate::settings::ScreenCaptureMethod {
    crate::settings::get_settings(app).cloud_asr_screen_capture_method
}

#[cfg(target_os = "linux")]
fn capture_primary_rgba(app: &AppHandle) -> Result<image::RgbaImage, String> {
    use crate::settings::ScreenCaptureMethod;

    match selected_capture_method(app) {
        ScreenCaptureMethod::Screenshot => {
            debug!("Screen context method=screenshot");
            capture_via_screenshot_portal(app, HOTKEY_SCREENSHOT_TIMEOUT)
        }
        ScreenCaptureMethod::Screencast => {
            let restore_token = crate::settings::get_screencast_restore_token(app);
            if restore_token.is_none() {
                warn!(
                    "ScreenCast selected but restore token missing; falling back to Screenshot portal"
                );
                return capture_via_screenshot_portal(app, HOTKEY_SCREENSHOT_TIMEOUT);
            }
            info!("Screen context method=screencast (silent restore)");
            match capture_via_screencast(app, restore_token.as_deref(), HOTKEY_SCREENCAST_TIMEOUT) {
                Ok(img) => Ok(img),
                Err(e) => {
                    warn!(
                        "ScreenCast hotkey capture failed ({e}); falling back to Screenshot portal"
                    );
                    capture_via_screenshot_portal(app, HOTKEY_SCREENSHOT_TIMEOUT)
                }
            }
        }
        ScreenCaptureMethod::X11 => {
            debug!("Screen context method=x11");
            capture_via_x11(app).or_else(|e| {
                warn!("X11 capture failed ({e}); falling back to Screenshot portal");
                capture_via_screenshot_portal(app, HOTKEY_SCREENSHOT_TIMEOUT)
            })
        }
    }
}

/// Authorize path: Handy is focused, so ScreenCast may show the share dialog.
#[cfg(target_os = "linux")]
async fn capture_primary_rgba_for_authorize(app: &AppHandle) -> Result<image::RgbaImage, String> {
    use crate::settings::ScreenCaptureMethod;

    match selected_capture_method(app) {
        ScreenCaptureMethod::Screenshot => {
            info!("Authorizing screen context via Screenshot portal");
            // Generous: the very first call may raise a "allow screenshots?" prompt
            // the user has to answer. Once granted it returns in well under a second.
            tokio::time::timeout(
                Duration::from_secs(30),
                capture_via_screenshot_portal_async(app),
            )
            .await
            .map_err(|_| {
                "Screenshot authorization timed out. Keep Handy focused and try again.".to_string()
            })?
        }
        ScreenCaptureMethod::Screencast => {
            // Only prompt the share dialog when we have no restore token.
            // With a token, force a silent restore test (no UI).
            let restore_token = crate::settings::get_screencast_restore_token(app);
            let had_token = restore_token.is_some();
            if had_token {
                info!("Authorizing screen context via ScreenCast silent restore");
            } else {
                info!("Authorizing screen context via ScreenCast share dialog");
            }
            let app = app.clone();
            let budget = if had_token {
                Duration::from_secs(20)
            } else {
                Duration::from_secs(90)
            };
            tokio::time::timeout(budget, async move {
                capture_via_screencast_async(&app, restore_token.as_deref()).await
            })
            .await
            .map_err(|_| {
                if had_token {
                    "ScreenCast silent restore timed out. Re-select ScreenCast or toggle the setting to share again.".to_string()
                } else {
                    "ScreenCast authorization timed out. Keep Handy focused, pick a monitor in the share dialog, then click Share.".to_string()
                }
            })?
        }
        ScreenCaptureMethod::X11 => {
            // Nothing to grant on X11; a test grab just confirms it works.
            info!("Authorizing screen context via X11 direct capture");
            capture_via_x11(app)
        }
    }
}

/// Grab the primary monitor straight from the X11 root window.
///
/// GDK is not thread-safe, so the grab runs on the GTK main thread. Callers are
/// always worker threads (hotkey capture / authorize), never the main thread,
/// so waiting here cannot deadlock it.
#[cfg(target_os = "linux")]
fn capture_via_x11(app: &AppHandle) -> Result<image::RgbaImage, String> {
    if !crate::utils::is_x11_session() {
        return Err("X11 direct capture needs an X11 session".to_string());
    }
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    app.run_on_main_thread(move || {
        let _ = tx.send(grab_x11_primary_monitor());
    })
    .map_err(|e| format!("Could not schedule X11 capture: {}", e))?;
    rx.recv_timeout(X11_GRAB_TIMEOUT)
        .map_err(|_| format!("X11 capture timed out after {:?}", X11_GRAB_TIMEOUT))?
}

#[cfg(target_os = "linux")]
fn grab_x11_primary_monitor() -> Result<image::RgbaImage, String> {
    use gtk::gdk::prelude::*;
    use gtk::{cairo, gdk};

    let display = gdk::Display::default().ok_or("No GDK display")?;
    let monitor = display
        .primary_monitor()
        .or_else(|| display.monitor(0))
        .ok_or("No monitors available for screenshot")?;
    let area = monitor.geometry();
    let root = display
        .default_screen()
        .root_window()
        .ok_or("No X11 root window")?;

    // Geometry is in logical pixels; paint at device scale so HiDPI screens keep
    // full resolution (encode_jpeg downsizes afterwards).
    let scale = root.scale_factor().max(1);
    let (width, height) = (area.width() * scale, area.height() * scale);
    let mut surface = cairo::ImageSurface::create(cairo::Format::Rgb24, width, height)
        .map_err(|e| format!("Could not allocate X11 capture surface: {}", e))?;
    surface.set_device_scale(scale as f64, scale as f64);
    {
        let cr = cairo::Context::new(&surface)
            .map_err(|e| format!("Could not start X11 capture: {}", e))?;
        cr.set_source_window(&root, -(area.x() as f64), -(area.y() as f64));
        cr.paint()
            .map_err(|e| format!("Could not read the X11 root window: {}", e))?;
    }
    surface.flush();

    // Rgb24 is native-endian 0xXXRRGGBB, i.e. B, G, R, X bytes on little-endian.
    let stride = surface.stride() as usize;
    let data = surface
        .data()
        .map_err(|e| format!("Could not access X11 capture pixels: {}", e))?;
    let (width, height) = (width as usize, height as usize);
    let mut rgba = Vec::with_capacity(width * height * 4);
    for row in data.chunks(stride).take(height) {
        for px in row[..width * 4].as_chunks::<4>().0 {
            let argb = u32::from_ne_bytes(*px);
            rgba.extend_from_slice(&[(argb >> 16) as u8, (argb >> 8) as u8, argb as u8, 255]);
        }
    }
    image::RgbaImage::from_raw(width as u32, height as u32, rgba)
        .ok_or_else(|| "X11 capture produced a truncated image".to_string())
}

#[cfg(target_os = "linux")]
fn persist_restore_token(app: &AppHandle, token: Option<String>) {
    let Some(token) = token else {
        return;
    };
    let previous = crate::settings::get_screencast_restore_token(app);
    if previous.as_deref() != Some(token.as_str()) {
        if let Err(error) = crate::settings::set_screencast_restore_token(app, Some(token)) {
            warn!("Could not save ScreenCast restore token: {error}");
            return;
        }
        info!("Saved ScreenCast restore token for silent re-capture");
    }
}

#[cfg(target_os = "linux")]
fn capture_via_screencast(
    app: &AppHandle,
    restore_token: Option<&str>,
    budget: Duration,
) -> Result<image::RgbaImage, String> {
    // Bound the work with a Tokio timeout rather than spawn+abandon: orphaned portal
    // sessions were hanging the *next* hotkey capture (audio only). Dropping the
    // future cancels the session cleanly.
    PORTAL_RT.block_on(async {
        match tokio::time::timeout(budget, capture_via_screencast_async(app, restore_token)).await {
            Ok(result) => result,
            Err(_) => Err(format!("Screen capture timed out after {:?}", budget)),
        }
    })
}

#[cfg(target_os = "linux")]
async fn capture_via_screencast_async(
    app: &AppHandle,
    restore_token: Option<&str>,
) -> Result<image::RgbaImage, String> {
    let (png_bytes, new_token) = screencast_grab_png(app, restore_token).await?;
    persist_restore_token(app, new_token);

    let img = image::load_from_memory(&png_bytes)
        .map_err(|e| format!("Failed to decode ScreenCast frame: {}", e))?;
    Ok(img.to_rgba8())
}

#[cfg(target_os = "linux")]
async fn screencast_grab_png(
    app: &AppHandle,
    restore_token: Option<&str>,
) -> Result<(Vec<u8>, Option<String>), String> {
    use ashpd::desktop::screencast::{CursorMode, Screencast, SelectSourcesOptions, SourceType};
    use ashpd::desktop::PersistMode;

    // Do NOT call portal_window_identifier() here. On Wayland, reading the
    // webview's raw handle from a worker thread deadlocks GTK — the share
    // dialog never appears and Handy looks frozen. Rely on focus instead.
    info!("ScreenCast: connecting to portal");
    let proxy = Screencast::new()
        .await
        .map_err(|e| {
            format!(
                "ScreenCast is not supported by this desktop ({}). Switch the screen capture method to Screenshot.",
                e
            )
        })?;
    info!("ScreenCast: create_session");
    let session = proxy
        .create_session(Default::default())
        .await
        .map_err(|e| format!("ScreenCast create_session failed: {}", e))?;

    let mut select = SelectSourcesOptions::default()
        .set_cursor_mode(CursorMode::Embedded)
        .set_sources(ashpd::enumflags2::BitFlags::from(SourceType::Monitor))
        .set_multiple(false)
        .set_persist_mode(PersistMode::ExplicitlyRevoked);
    if let Some(token) = restore_token {
        select = select.set_restore_token(token);
    }

    info!("ScreenCast: select_sources");
    proxy
        .select_sources(&session, select)
        .await
        .map_err(|e| format!("ScreenCast select_sources failed: {}", e))?;

    if restore_token.is_some() {
        info!("ScreenCast: starting stream (silent restore)");
    } else {
        info!("ScreenCast: waiting for share dialog (pick a monitor and Share)");
    }
    let response = proxy
        .start(&session, None, Default::default())
        .await
        .map_err(|e| format!("ScreenCast start failed: {}", e))?
        .response()
        .map_err(|e| format!("ScreenCast start denied or cancelled: {}", e))?;
    info!("ScreenCast: share granted");

    // Persist the token even if the subsequent GStreamer grab fails — the user
    // already completed the share dialog.
    let new_token = response.restore_token().map(|s| s.to_string());
    let node_id = response
        .streams()
        .first()
        .map(|s| s.pipe_wire_node_id())
        .ok_or_else(|| "ScreenCast returned no streams".to_string())?;

    debug!("ScreenCast: open_pipe_wire_remote (node={node_id})");
    let fd = proxy
        .open_pipe_wire_remote(&session, Default::default())
        .await
        .map_err(|e| format!("ScreenCast OpenPipeWireRemote failed: {}", e))?;

    // GStreamer is sync/blocking and runs inline (no spawn_blocking — OwnedFd and
    // the portal types aren't Send). Because it blocks, the caller's
    // `tokio::time::timeout` cannot cancel it, so it enforces its own deadline.
    match grab_png_via_gstreamer(&fd, node_id) {
        Ok(png_bytes) => {
            drop(session);
            Ok((png_bytes, new_token))
        }
        Err(gst_err) => {
            if let Some(ref token) = new_token {
                persist_restore_token(app, Some(token.clone()));
            }
            drop(session);
            Err(gst_err)
        }
    }
}

/// Pull one frame from the portal PipeWire remote using system GStreamer.
#[cfg(target_os = "linux")]
fn grab_png_via_gstreamer(fd: &std::os::fd::OwnedFd, node_id: u32) -> Result<Vec<u8>, String> {
    use std::os::fd::AsRawFd;

    if which_gst_launch().is_none() {
        return Err("gst-launch-1.0 not found (install gstreamer1.0-tools)".into());
    }

    let raw_fd = fd.as_raw_fd();
    // Portal FDs are typically CLOEXEC; clear it so gst-launch can inherit.
    unsafe {
        let flags = libc::fcntl(raw_fd, libc::F_GETFD);
        if flags >= 0 {
            libc::fcntl(raw_fd, libc::F_SETFD, flags & !libc::FD_CLOEXEC);
        }
    }

    // On current PipeWire/GStreamer builds, path=<node_id> works; target-object
    // often fails with "target not found". Try path first.
    match grab_png_via_gstreamer_with(raw_fd, &format!("path={node_id}")) {
        Ok(bytes) => Ok(bytes),
        // A timeout means the pipeline wedged rather than rejected the property, so
        // the alternate spelling would only burn a second full budget. Give up now.
        Err(first) if first.contains(GST_TIMEOUT_MARKER) => Err(first),
        Err(first) => {
            warn!("ScreenCast gst path= failed ({first}); retrying with target-object=");
            grab_png_via_gstreamer_with(raw_fd, &format!("target-object={node_id}"))
                .map_err(|second| format!("{first} | retry: {second}"))
        }
    }
}

#[cfg(target_os = "linux")]
fn grab_png_via_gstreamer_with(raw_fd: i32, target_prop: &str) -> Result<Vec<u8>, String> {
    use std::io::Read;
    use std::process::{Command, Stdio};

    static SEQ: AtomicU64 = AtomicU64::new(0);
    let out_path = std::env::temp_dir().join(format!(
        "handy-screencast-{}-{}.png",
        std::process::id(),
        SEQ.fetch_add(1, Ordering::Relaxed)
    ));
    let location = out_path.to_string_lossy().replace('\\', "/");

    // gst-launch parses each token separately. Properties must NOT be glued into
    // the element name (that yields "pipeline syntax error" on GStreamer 1.24).
    let mut child = Command::new("gst-launch-1.0")
        .arg("-q")
        .arg("pipewiresrc")
        .arg(format!("fd={raw_fd}"))
        .arg(target_prop)
        .arg("num-buffers=1")
        .arg("!")
        .arg("videoconvert")
        .arg("!")
        .arg("pngenc")
        .arg("!")
        .arg("filesink")
        .arg(format!("location={location}"))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run gst-launch-1.0: {}", e))?;

    // Drain stderr on a helper thread; polling try_wait() while the pipe fills
    // would deadlock the child.
    let mut stderr_pipe = child.stderr.take();
    let stderr_reader = std::thread::spawn(move || {
        let mut buf = String::new();
        if let Some(pipe) = stderr_pipe.as_mut() {
            let _ = pipe.read_to_string(&mut buf);
        }
        buf
    });

    // If the stream never produces a buffer, gst-launch waits forever. Nothing
    // upstream can cancel this blocking call, so kill it ourselves.
    let deadline = Instant::now() + GST_GRAB_TIMEOUT;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = stderr_reader.join();
                let _ = std::fs::remove_file(&out_path);
                return Err(format!(
                    "gst-launch-1.0 {} after {:?}",
                    GST_TIMEOUT_MARKER, GST_GRAB_TIMEOUT
                ));
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(25)),
            Err(e) => {
                let _ = child.kill();
                let _ = stderr_reader.join();
                let _ = std::fs::remove_file(&out_path);
                return Err(format!("Failed to wait for gst-launch-1.0: {}", e));
            }
        }
    };
    let stderr = stderr_reader.join().unwrap_or_default();

    if !status.success() {
        let _ = std::fs::remove_file(&out_path);
        return Err(format!(
            "gst-launch-1.0 failed ({}): {}",
            status,
            stderr.trim()
        ));
    }

    let bytes = std::fs::read(&out_path).map_err(|e| {
        let _ = std::fs::remove_file(&out_path);
        format!("Failed to read ScreenCast PNG: {}", e)
    })?;
    let _ = std::fs::remove_file(&out_path);

    if bytes.is_empty() {
        return Err("gst-launch-1.0 wrote an empty PNG".into());
    }
    Ok(bytes)
}

#[cfg(target_os = "linux")]
fn which_gst_launch() -> Option<std::path::PathBuf> {
    std::env::var_os("PATH").and_then(|paths| {
        for dir in std::env::split_paths(&paths) {
            let candidate = dir.join("gst-launch-1.0");
            if candidate.is_file() {
                return Some(candidate);
            }
        }
        None
    })
}

/// `file://` URI → path. Percent-decoding works on bytes so multi-byte UTF-8
/// escapes (e.g. a localized `~/图片` Pictures dir) round-trip correctly.
#[cfg(target_os = "linux")]
fn file_uri_to_path(uri: &str) -> Result<std::path::PathBuf, String> {
    use std::os::unix::ffi::OsStringExt;

    let rest = uri
        .strip_prefix("file://")
        .ok_or_else(|| format!("Screenshot portal returned non-file URI: {}", uri))?;
    // Skip an optional authority (`file://localhost/...`).
    let encoded = &rest[rest
        .find('/')
        .ok_or_else(|| format!("Screenshot portal URI has no path: {}", uri))?..];

    let hex = |b: u8| (b as char).to_digit(16).map(|d| d as u8);
    let bytes = encoded.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match (bytes[i], bytes.get(i + 1), bytes.get(i + 2)) {
            (b'%', Some(&hi), Some(&lo)) if hex(hi).is_some() && hex(lo).is_some() => {
                decoded.push(hex(hi).unwrap() << 4 | hex(lo).unwrap());
                i += 3;
            }
            (b, _, _) => {
                decoded.push(b);
                i += 1;
            }
        }
    }
    Ok(std::ffi::OsString::from_vec(decoded).into())
}

/// Fallback: classic Screenshot portal (may flash / play shutter on GNOME).
#[cfg(target_os = "linux")]
fn capture_via_screenshot_portal(
    app: &AppHandle,
    budget: Duration,
) -> Result<image::RgbaImage, String> {
    PORTAL_RT.block_on(async {
        match tokio::time::timeout(budget, capture_via_screenshot_portal_async(app)).await {
            Ok(result) => result,
            Err(_) => Err(format!("Screenshot portal timed out after {:?}", budget)),
        }
    })
}

#[cfg(target_os = "linux")]
async fn capture_via_screenshot_portal_async(app: &AppHandle) -> Result<image::RgbaImage, String> {
    let _ = app;
    let _sound_guard = GnomeEventSoundGuard::silence_if_gnome();
    // No parent `WindowIdentifier` on purpose, exactly as the ScreenCast path does.
    // Building one means reading the webview's Wayland handle off the GTK main
    // thread, which deadlocks — and because that read is synchronous, the timeout
    // that was supposed to bound it could never fire. The portal is happy with an
    // empty parent: any permission prompt still appears, just unparented.
    let response = ashpd::desktop::screenshot::Screenshot::request()
        .interactive(false)
        .send()
        .await
        .map_err(|e| format!("Screenshot portal request failed: {}", e))?
        .response()
        .map_err(|e| format!("Screenshot portal denied or failed: {}", e))?;
    let uri = response.uri().as_str().to_string();

    let path = file_uri_to_path(&uri)?;
    let bytes = std::fs::read(&path)
        .map_err(|e| format!("Failed to read screenshot {}: {}", path.display(), e))?;
    let _ = std::fs::remove_file(&path);

    let img = image::load_from_memory(&bytes)
        .map_err(|e| format!("Failed to decode screenshot: {}", e))?;
    Ok(img.to_rgba8())
}

#[cfg(target_os = "linux")]
struct GnomeEventSoundGuard {
    previous: Option<String>,
}

#[cfg(target_os = "linux")]
impl GnomeEventSoundGuard {
    fn silence_if_gnome() -> Self {
        if !crate::utils::is_gnome() {
            return Self { previous: None };
        }
        let previous = std::process::Command::new("gsettings")
            .args(["get", "org.gnome.desktop.sound", "event-sounds"])
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());
        if previous.as_deref() == Some("true") {
            let _ = std::process::Command::new("gsettings")
                .args(["set", "org.gnome.desktop.sound", "event-sounds", "false"])
                .status();
        }
        Self { previous }
    }
}

#[cfg(target_os = "linux")]
impl Drop for GnomeEventSoundGuard {
    fn drop(&mut self) {
        if let Some(ref previous) = self.previous {
            if previous == "true" {
                let _ = std::process::Command::new("gsettings")
                    .args(["set", "org.gnome.desktop.sound", "event-sounds", "true"])
                    .status();
            }
        }
    }
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
fn capture_primary_rgba(_app: &AppHandle) -> Result<image::RgbaImage, String> {
    use xcap::Monitor;

    let monitors = Monitor::all().map_err(|e| format!("Failed to list monitors: {}", e))?;
    let monitor = monitors
        .iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or_else(|| monitors.first())
        .ok_or_else(|| "No monitors available for screenshot".to_string())?;

    monitor
        .capture_image()
        .map_err(|e| format!("Failed to capture monitor: {}", e))
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn capture_primary_rgba(_app: &AppHandle) -> Result<image::RgbaImage, String> {
    Err("Screen context capture is not supported on this platform".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_small_rgba() {
        let img = image::RgbaImage::from_pixel(32, 24, image::Rgba([10, 20, 30, 255]));
        let jpeg = encode_jpeg(img).expect("jpeg");
        assert!(!jpeg.is_empty());
        assert!(jpeg.starts_with(&[0xFF, 0xD8]));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn file_uri_decodes_non_ascii_paths() {
        assert_eq!(
            file_uri_to_path(
                "file:///home/ztz/%E5%9B%BE%E7%89%87/Screenshot%20from%202026-10-02%2023-12-08.png"
            )
            .unwrap(),
            std::path::PathBuf::from("/home/ztz/图片/Screenshot from 2026-10-02 23-12-08.png")
        );
        assert_eq!(
            file_uri_to_path("file://localhost/tmp/a%25b.png").unwrap(),
            std::path::PathBuf::from("/tmp/a%b.png")
        );
        assert!(file_uri_to_path("https://example.com/a.png").is_err());
    }
}
