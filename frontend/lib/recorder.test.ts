import { describe, expect, test } from "vitest";
import { blobToBase64, encodeWav, resample } from "./recorder";

describe("WAV recorder helpers", () => {
  test("encodeWav writes a mono 16-bit PCM header the server reader accepts", async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 2, -2]);
    const wav = encodeWav(samples, 16000);
    expect(wav.type).toBe("audio/wav");
    const view = new DataView(await wav.arrayBuffer());
    const tag = (at: number) =>
      String.fromCharCode(...new Uint8Array(view.buffer, at, 4));
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(tag(12)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(tag(36)).toBe("data");
    expect(view.getUint32(40, true)).toBe(14);
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(Math.trunc(0.5 * 0x7fff));
    expect(view.getInt16(48, true)).toBe(-0x4000);
    expect(view.getInt16(50, true)).toBe(0x7fff);
    expect(view.getInt16(52, true)).toBe(-0x8000);
    // Out-of-range samples are clamped, not wrapped.
    expect(view.getInt16(54, true)).toBe(0x7fff);
    expect(view.getInt16(56, true)).toBe(-0x8000);
  });
  test("resample keeps the duration and interpolates", () => {
    const input = new Float32Array(48000).map((_, i) => (i % 2 ? 1 : 0));
    const out = resample(input, 48000, 16000);
    expect(out.length).toBe(16000);
    expect(resample(input, 16000, 16000)).toBe(input);
    expect(resample(new Float32Array([0, 1]), 2, 4)).toEqual(
      new Float32Array([0, 0.5, 1, 1]),
    );
  });
  test("blobToBase64 encodes bytes", async () => {
    expect(await blobToBase64(new Blob([new Uint8Array([65, 66, 67])]))).toBe(
      "QUJD",
    );
    const big = new Uint8Array(70000).fill(1);
    expect((await blobToBase64(new Blob([big]))).length).toBe(
      Math.ceil(70000 / 3) * 4,
    );
  });
});
