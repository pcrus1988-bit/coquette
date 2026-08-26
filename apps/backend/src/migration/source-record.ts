import { sourceChecksum } from "./checksum"
import type { MigrationSourceKey } from "./types"

export type NormalizedMigrationSourceRecord<TData> = MigrationSourceKey & {
  sourceChecksum: string
  sourceUpdatedAt?: string
  data: TData
}

export function createNormalizedSourceRecord<TData>(
  key: MigrationSourceKey,
  data: TData,
  sourceUpdatedAt?: string
): NormalizedMigrationSourceRecord<TData> {
  return {
    ...key,
    sourceChecksum: sourceChecksum(data),
    sourceUpdatedAt,
    data,
  }
}
