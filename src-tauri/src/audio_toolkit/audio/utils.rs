use anyhow::Result;
use hound::{WavReader, WavSpec, WavWriter};
use log::debug;
use std::io::Cursor;
use std::path::Path;

/// Read a WAV file and return normalised f32 samples.
pub fn read_wav_samples<P: AsRef<Path>>(file_path: P) -> Result<Vec<f32>> {
    let reader = WavReader::open(file_path.as_ref())?;
    let samples = reader
        .into_samples::<i16>()
        .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
        .collect::<Result<Vec<f32>, _>>()?;
    Ok(samples)
}

/// Verify a WAV file by reading it back and checking the sample count.
pub fn verify_wav_file<P: AsRef<Path>>(file_path: P, expected_samples: usize) -> Result<()> {
    let reader = WavReader::open(file_path.as_ref())?;
    let actual_samples = reader.len() as usize;
    if actual_samples != expected_samples {
        anyhow::bail!(
            "WAV sample count mismatch: expected {}, got {}",
            expected_samples,
            actual_samples
        );
    }
    Ok(())
}

/// Save audio samples as a WAV file
pub fn save_wav_file<P: AsRef<Path>>(file_path: P, samples: &[f32]) -> Result<()> {
    std::fs::write(file_path.as_ref(), encode_wav(samples)?)?;
    debug!("Saved WAV file: {:?}", file_path.as_ref());
    Ok(())
}

/// Encode a mono 16 kHz recording once for both upload and persistence.
pub fn encode_wav(samples: &[f32]) -> Result<Vec<u8>> {
    let spec = WavSpec {
        channels: 1,
        sample_rate: 16000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut bytes = Cursor::new(Vec::with_capacity(samples.len() * 2 + 44));
    let mut writer = WavWriter::new(&mut bytes, spec)?;

    // Convert f32 samples to i16 for WAV
    for sample in samples {
        let sample_i16 = (sample * i16::MAX as f32) as i16;
        writer.write_sample(sample_i16)?;
    }

    writer.finalize()?;
    Ok(bytes.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encoded_audio_and_saved_audio_are_identical() {
        let samples = [-1.0, -0.5, 0.0, 0.5, 1.0];
        let encoded = encode_wav(&samples).unwrap();
        let reader = WavReader::new(Cursor::new(&encoded)).unwrap();
        assert_eq!(reader.spec().sample_rate, 16000);
        assert_eq!(reader.spec().channels, 1);
        assert_eq!(reader.len(), samples.len() as u32);
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("recording.wav");
        save_wav_file(&path, &samples).unwrap();
        assert_eq!(std::fs::read(path).unwrap(), encoded);
    }
}
