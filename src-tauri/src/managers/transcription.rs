//! Minimal stream routing stub.
//!
//! Local ASR streaming was removed; cloud Omni transcription is batch-only.
//! Audio recording still holds an `Arc<StreamRouter>` so frame callbacks remain
//! a cheap no-op when no stream is open.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

/// Routes real-time audio frames. Always closed under cloud ASR — `feed` is a
/// single relaxed atomic load no-op.
pub struct StreamRouter {
    open: Arc<AtomicBool>,
    _tx: Mutex<()>,
}

impl StreamRouter {
    pub fn new() -> Self {
        Self {
            open: Arc::new(AtomicBool::new(false)),
            _tx: Mutex::new(()),
        }
    }

    pub fn feed(&self, _frame: &[f32]) {
        // Cloud ASR path never opens a stream.
        let _ = self.open.load(Ordering::Relaxed);
    }
}

impl Default for StreamRouter {
    fn default() -> Self {
        Self::new()
    }
}
