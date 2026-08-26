import { manifestKey } from "./manifest"
import type { MigrationManifestEntry, MigrationSourceKey } from "./types"

export function buildImportedTargetMap(
  entries: MigrationManifestEntry[]
): Map<string, string> {
  const mapping = new Map<string, string>()

  for (const entry of entries) {
    if (entry.status !== "imported" || !entry.targetId) {
      continue
    }

    const key = manifestKey(entry)
    const existing = mapping.get(key)

    if (existing && existing !== entry.targetId) {
      throw new Error(
        `Conflicting target IDs for migration source key ${key}: ${existing} vs ${entry.targetId}`
      )
    }

    mapping.set(key, entry.targetId)
  }

  return mapping
}

export function resolveImportedTargetId(
  entries: MigrationManifestEntry[],
  key: MigrationSourceKey
): string | undefined {
  return buildImportedTargetMap(entries).get(manifestKey(key))
}

export function requireImportedTargetId(
  entries: MigrationManifestEntry[],
  key: MigrationSourceKey
): string {
  const targetId = resolveImportedTargetId(entries, key)

  if (!targetId) {
    throw new Error(`Missing imported target mapping for ${manifestKey(key)}`)
  }

  return targetId
}
