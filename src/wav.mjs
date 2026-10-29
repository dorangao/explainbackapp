// Reads the learner's recorded speech: a RIFF/WAVE file with mono 16-bit PCM at 16 or
// 24 kHz, which is what Muse Voice Transcribe accepts. Anything else is refused here, so
// no unexpected bytes are forwarded. Bounded to one minute of speech.
export const MAX_SPEECH_MS = 60_000, MIN_SPEECH_MS = 300, SPEECH_RATES = [16_000, 24_000];

export function readWav(buffer) {
  if (!(buffer instanceof Uint8Array) || buffer.byteLength < 44) throw new Error('WAV header is missing.');
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const tag = at => String.fromCharCode(...buffer.subarray(at, at + 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a RIFF/WAVE file.');
  let offset = 12, format = null, data = null;
  while (offset + 8 <= buffer.byteLength) {
    const id = tag(offset), size = view.getUint32(offset + 4, true), start = offset + 8;
    if (start + size > buffer.byteLength) throw new Error('WAV chunk runs past the end.');
    if (id === 'fmt ') {
      if (size < 16) throw new Error('WAV format chunk is too short.');
      format = { audioFormat: view.getUint16(start, true), channels: view.getUint16(start + 2, true), sampleRate: view.getUint32(start + 4, true), bits: view.getUint16(start + 14, true) };
    } else if (id === 'data') data = { start, size };
    offset = start + size + (size % 2);
  }
  if (!format || !data) throw new Error('WAV is missing its format or data chunk.');
  if (format.audioFormat !== 1 || format.channels !== 1 || format.bits !== 16) throw new Error('Use mono 16-bit PCM audio.');
  if (!SPEECH_RATES.includes(format.sampleRate)) throw new Error('Use a 16 kHz or 24 kHz sample rate.');
  const durationMs = Math.round(data.size / (format.sampleRate * 2) * 1000);
  if (durationMs < MIN_SPEECH_MS) throw new Error('The recording is too short.');
  if (durationMs > MAX_SPEECH_MS) throw new Error('The recording is longer than one minute.');
  return { sampleRate: format.sampleRate, durationMs, bytes: buffer.byteLength };
}

// The browser sends the file as base64 inside JSON; a bound on the text keeps the decode small.
export const MAX_WAV_BASE64 = 2_600_000;
export function readWavBase64(text) {
  if (typeof text !== 'string' || !text || text.length > MAX_WAV_BASE64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) throw new Error('Send the recording as base64 WAV.');
  const buffer = Buffer.from(text, 'base64');
  return { buffer, ...readWav(buffer) };
}

// Test helper and fixture maker: silence or a tone as a valid WAV of the given length.
export function makeWav({ sampleRate = 16_000, durationMs = 1000, tone = 0 } = {}) {
  const frames = Math.round(sampleRate * durationMs / 1000), buffer = Buffer.alloc(44 + frames * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + frames * 2, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) buffer.writeInt16LE(tone ? Math.round(Math.sin(2 * Math.PI * tone * i / sampleRate) * 12000) : 0, 44 + i * 2);
  return buffer;
}
