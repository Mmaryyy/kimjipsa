// INV-17: keep the receipt-specific guidance for oversized photos.
import { compressPhoto as resizePhoto } from "@/shared/lib";

export const compressPhoto = (file: File) =>
  resizePhoto(
    file,
    2000,
    "사진 용량이 커요. 영수증 부분을 잘라 다시 선택해 주세요.",
  );
