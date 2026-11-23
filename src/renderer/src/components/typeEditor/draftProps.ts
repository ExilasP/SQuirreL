import type { TypeDraft } from '@/lib/typeDraft'

/** Props shared by the kind-specific sections of the type editor. */
export interface DraftSectionProps {
  draft: TypeDraft
  onChange(patch: Partial<TypeDraft>): void
}

/** Key for an entry added in the editor; existing entries get theirs from `createTypeDraft`. */
export const newEntryKey = (): string => crypto.randomUUID()

/** Returns a copy of `items` with `item` inserted at `index`. */
export const insertAt = <T,>(items: T[], index: number, item: T): T[] => [...items.slice(0, index), item, ...items.slice(index)]
