import type { FileTypeCategory } from "@docysen/types";

/**
 * Dérive la facette de filtre/l'icône de fallback à partir du `mimeType` stocké en base. Partagé
 * entre l'indexation Meilisearch (api-service) et le fallback icône (frontend) pour ne pas avoir
 * deux logiques de classification qui divergent.
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
