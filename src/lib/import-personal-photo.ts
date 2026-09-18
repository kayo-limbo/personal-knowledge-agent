"use client";

/** Decode then re-encode to discard metadata and keep the combined Action below 1 MB. */
export async function importPersonalPhoto(file: File, kind: "avatar" | "background"): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("请选择 JPG、PNG 或 WebP 照片；HEIC 请先转换为 JPG。");
  if (file.size > 10 * 1024 * 1024) throw new Error("原始照片不能超过 10 MB。");
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("无法读取这张照片，请换一张图片。"); });
  try {
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error("照片尺寸过大，请先缩小后再导入。");
    const avatar = kind === "avatar";
    const scale = Math.min(1, (avatar ? 256 : 1440) / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = avatar ? 256 : Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = avatar ? 256 : Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器暂时无法处理图片。");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const side = Math.min(bitmap.width, bitmap.height);
    if (avatar) context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
    else context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55, 0.4, 0.25]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= (avatar ? 100_000 : 450_000)) return data;
    }
    throw new Error("压缩后图片仍然过大，请裁剪或选择更简单的照片。");
  } finally { bitmap.close(); }
}
