use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug, Clone, Default)]
#[command(name = "handy-cloud", about = "Handy Cloud - Speech to Text")]
pub struct CliArgs {
    /// Export frontend bindings without starting the application (development only).
    #[cfg(debug_assertions)]
    #[arg(long, hide = true)]
    pub export_bindings: bool,
    /// Start with the main window hidden
    #[arg(long)]
    pub start_hidden: bool,

    /// Disable the system tray icon
    #[arg(long)]
    pub no_tray: bool,

    /// Toggle transcription on/off (sent to running instance)
    #[arg(long)]
    pub toggle_transcription: bool,

    /// Toggle transcription with post-processing on/off (sent to running instance)
    #[arg(long)]
    pub toggle_post_process: bool,

    /// Cancel the current operation (sent to running instance)
    #[arg(long)]
    pub cancel: bool,

    /// Enable debug mode with verbose logging
    #[arg(long)]
    pub debug: bool,

    /// Transcribe this WAV (16 kHz mono) headlessly via cloud ASR and exit.
    #[arg(short = 'f', long, value_name = "WAV")]
    pub transcribe_file: Option<PathBuf>,

    /// Cloud ASR model id for --transcribe-file (default: settings cloud_asr_model).
    #[arg(long)]
    pub model: Option<String>,

    /// Legacy flag (local GPU devices removed). Accepted and ignored.
    #[arg(long, value_name = "N")]
    pub device_index: Option<usize>,

    /// Legacy flag (local compute devices removed).
    #[arg(long)]
    pub list_devices: bool,

    /// List available cloud ASR models and exit.
    #[arg(long)]
    pub list_models: bool,

    /// Repeat the transcription N times (best_ms reports the fastest run).
    #[arg(long, value_name = "N")]
    pub repeat: Option<usize>,

    /// Emit --transcribe-file results as JSON.
    #[arg(long)]
    pub json: bool,
}
