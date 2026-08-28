export const STUDIO_ARCHIVE_VERSION = "1"
export const STUDIO_ARCHIVE_MARKER_KEY = "coquette_studio_archived"
export const STUDIO_ARCHIVE_VERSION_KEY = "coquette_studio_archive_version"
export const STUDIO_ARCHIVE_PREVIOUS_STATUS_KEY =
  "coquette_studio_archive_previous_status"

export function studioProductIsArchived(
  metadata: Record<string, unknown> | null | undefined
) {
  return metadata?.[STUDIO_ARCHIVE_MARKER_KEY] === "true"
}

export function studioArchivePreviousStatus(
  metadata: Record<string, unknown> | null | undefined
): "draft" | "published" | null {
  const value = metadata?.[STUDIO_ARCHIVE_PREVIOUS_STATUS_KEY]
  return value === "draft" || value === "published" ? value : null
}

export function studioArchivedMutationProblem(operation: string) {
  return {
    status: 409,
    code: "product_archived",
    message: `This product is archived. Restore it to an editable draft before ${operation}.`,
  }
}
