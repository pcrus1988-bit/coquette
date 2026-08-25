import type {
  MigrationManifestEntry,
  MigrationSourceKey,
} from "./types"

export function manifestKey(key: MigrationSourceKey): string {
  return [key.entityType, key.sourceId, key.locale ?? "-"]
    .map((part) => encodeURIComponent(part))
    .join(":")
}

export function findDuplicateManifestKeys(
  entries: MigrationManifestEntry[]
): string[] {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    const key = manifestKey(entry)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort()
}

export function createPendingManifestEntry(
  key: MigrationSourceKey,
  sourceChecksum: string,
  sourceUpdatedAt?: string
): MigrationManifestEntry {
  return {
    ...key,
    sourceChecksum,
    status: "pending",
    warnings: [],
    errors: [],
    attempts: 0,
    sourceUpdatedAt,
  }
}

export function shouldReimport(
  previous: MigrationManifestEntry | undefined,
  nextChecksum: string
): boolean {
  if (!previous) {
    return true
  }

  if (previous.status === "error" || previous.status === "pending") {
    return true
  }

  return previous.sourceChecksum !== nextChecksum
}
