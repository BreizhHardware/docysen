import type { FileTypeCategory } from "@docysen/types";

/**
 * Portage frontend de fileTypeFromMimeType (packages/utils/src/mimeType.ts) : dupliqué plutôt
 * qu'importé pour ne pas faire dépendre le bundle navigateur de @docysen/utils. Même logique, à garder en phase si un
 * type de fichier est ajouté d'un côté.
 */
export function fileTypeFromMimeType(mimeType: string): FileTypeCategory {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "text/markdown" || mimeType === "text/x-markdown") return "markdown";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    return "docx";
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint"
  ) {
    return "pptx";
  }
  return "other";
}
