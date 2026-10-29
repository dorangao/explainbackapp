// Records the learner's spoken explanation as the WAV that Muse Voice Transcribe
// accepts: mono, 16-bit PCM, 16 kHz. Audio stays in memory and goes only to this
// app's transcribe route; nothing is kept after the transcript arrives.
export const SPEECH_RATE = 16_000;
export const MAX_SPEECH_MS = 60_000;

export function resample(
  samples: Float32Array,
  from: number,
  to: number,
): Float32Array {
  if (from === to) return samples;
  const length = Math.max(1, Math.round((samples.length * to) / from)),
    out = new Float32Array(length),
    ratio = from / to;
  for (let i = 0; i < length; i++) {
    const position = i * ratio,
      index = Math.floor(position),
      next = Math.min(index + 1, samples.length - 1),
      weight = position - index;
    out[i] =
      (samples[index] ?? 0) * (1 - weight) + (samples[next] ?? 0) * weight;
  }
  return out;
}

export function encodeWav(
  samples: Float32Array,
  sampleRate = SPEECH_RATE,
): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2),
    view = new DataView(buffer),
    text = (at: number, value: string) => {
      for (let i = 0; i < value.length; i++)
        view.setUint8(at + i, value.charCodeAt(i));
    };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      44 + i * 2,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true,
    );
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export type Recording = {
  // Resolves with the WAV once the microphone is released.
  stop: () => Promise<{ wav: Blob; durationMs: number }>;
};

export class MicrophoneError extends Error {}

// Captures microphone audio through Web Audio so the sample format is under our
// control (MediaRecorder cannot produce PCM WAV). Stops itself at `maxMs`.
export async function startRecording({
  maxMs = MAX_SPEECH_MS,
  onAutoStop,
}: { maxMs?: number; onAutoStop?: () => void } = {}): Promise<Recording> {
  if (
    !navigator.mediaDevices?.getUserMedia ||
    typeof AudioContext === "undefined"
  )
    throw new MicrophoneError("unsupported");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  } catch {
    throw new MicrophoneError("denied");
  }
  let context: AudioContext;
  try {
    context = new AudioContext({ sampleRate: SPEECH_RATE });
  } catch {
    context = new AudioContext();
  }
  const source = context.createMediaStreamSource(stream),
    processor = context.createScriptProcessor(4096, 1, 1),
    chunks: Float32Array[] = [];
  let frames = 0,
    done = false;
  processor.onaudioprocess = (event) => {
    if (done) return;
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    frames += input.length;
    if ((frames / context.sampleRate) * 1000 >= maxMs) {
      done = true;
      onAutoStop?.();
    }
  };
  source.connect(processor);
  processor.connect(context.destination);
  const stop = async () => {
    done = true;
    processor.disconnect();
    source.disconnect();
    for (const track of stream.getTracks()) track.stop();
    await context.close().catch(() => {});
    const all = new Float32Array(frames);
    let at = 0;
    for (const chunk of chunks) {
      all.set(chunk.subarray(0, Math.min(chunk.length, frames - at)), at);
      at += chunk.length;
      if (at >= frames) break;
    }
    const samples = resample(all, context.sampleRate, SPEECH_RATE);
    return {
      wav: encodeWav(samples, SPEECH_RATE),
      durationMs: Math.round((samples.length / SPEECH_RATE) * 1000),
    };
  };
  return { stop };
}
