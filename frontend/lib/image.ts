const LIMIT = 1_200_000;
export async function prepareImage(
  file: File,
): Promise<{ name: string; dataUrl: string }> {
  if (file.size > 12_000_000) throw new Error("size");
  if (
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)
  )
    throw new Error("type");
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
  const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode"));
    image.src = original;
  });
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && original.length <= LIMIT && file.type !== "image/gif")
    return { name: file.name.slice(0, 60), dataUrl: original };
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("decode");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.85, 0.7, 0.55]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= LIMIT)
      return { name: file.name.slice(0, 60), dataUrl };
  }
  throw new Error("size");
}
