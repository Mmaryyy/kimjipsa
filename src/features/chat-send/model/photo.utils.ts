// INV-17: local compression; the original never leaves the browser.
export async function compressPhoto(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPEG, PNG, WebP 사진을 선택해 주세요.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("20MB 이하 사진을 선택해 주세요.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진을 변환하지 못했어요.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= 1048576) return blob;
    }
    throw new Error("사진 용량이 커요. 영수증 부분을 잘라 다시 선택해 주세요.");
  } finally {
    bitmap.close();
  }
}
