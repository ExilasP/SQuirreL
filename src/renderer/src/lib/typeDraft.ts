import type { TypeAlteration, TypeInfo } from '@shared/types'

/**
 * Editable copy of a list entry. `original` remembers what the entry was when the
 * editor opened (`null` for entries added since), so a changed value reads as a
 * rename rather than a drop followed by an add.
 */
interface DraftEntry<T> {
  /** Stable React key. */
  key: string
  original: T | null
}

export interface EnumLabelDraft extends DraftEntry<string> { value: string }
export interface AttributeDraft extends DraftEntry<{ name: string; type: string }> { name: string; type: string }
/** Existing checks can only be dropped (PostgreSQL cannot alter one); `original` is the constraint name. */
export interface CheckDraft extends DraftEntry<string> { definition: string }

/** State of the type editor; fields that do not apply to the type's kind are ignored. */
export interface TypeDraft {
  name: string
  owner: string
  /** Empty means no comment. */
  comment: string
  labels: EnumLabelDraft[]
  attributes: AttributeDraft[]
  /** Domain default expression; empty means no default. */
  defaultValue: string
  isNotNull: boolean
  checks: CheckDraft[]
}

/** Builds the editor state mirroring a type as fetched from the database. */
export function createTypeDraft(type: TypeInfo): TypeDraft {
  return {
    name: type.name,
    owner: type.owner,
    comment: type.comment ?? '',
    labels: type.labels.map((label, i) => ({ key: `label:${i}`, original: label, value: label })),
    attributes: type.attributes.map((a, i) => ({ key: `attribute:${i}`, original: a, name: a.name, type: a.type })),
    defaultValue: type.defaultValue ?? '',
    isNotNull: type.isNotNull,
    checks: type.checks.map((c) => ({ key: `check:${c.name}`, original: c.name, definition: c.definition }))
  }
}

const findDuplicate = (values: string[]): string | undefined => values.find((v, i) => values.indexOf(v) !== i)

function validateEnum(draft: TypeDraft): string[] {
  const values = draft.labels.map((l) => l.value)
  const duplicate = findDuplicate(values)
  return [
    ...(values.some((v) => !v) ? ['Enum values cannot be empty'] : []),
    ...(duplicate !== undefined ? [`Duplicate enum value "${duplicate}"`] : [])
  ]
}

function validateComposite(draft: TypeDraft): string[] {
  const names = draft.attributes.map((a) => a.name.trim())
  const duplicate = findDuplicate(names)
  return [
    ...(names.some((n) => !n) ? ['Attribute names cannot be empty'] : []),
    ...(draft.attributes.some((a) => !a.type.trim()) ? ['Attribute types cannot be empty'] : []),
    ...(duplicate !== undefined ? [`Duplicate attribute "${duplicate}"`] : [])
  ]
}

/**
 * Lists what prevents the draft from being applied.
 *
 * @returns Human-readable problems; empty when the draft is valid.
 */
export function validateTypeDraft(type: TypeInfo, draft: TypeDraft): string[] {
  const common = [
    ...(!draft.name.trim() ? ['The type name cannot be empty'] : []),
    ...(!draft.owner.trim() ? ['The owner cannot be empty'] : [])
  ]
  switch (type.kind) {
    case 'enum': return [...common, ...validateEnum(draft)]
    case 'composite': return [...common, ...validateComposite(draft)]
    case 'domain': return [...common, ...(draft.checks.some((c) => !c.original && !c.definition.trim()) ? ['Checks cannot be empty'] : [])]
    case 'range': return common
  }
}

/**
 * Renames come first so that a new value may sit next to a renamed one. Each new
 * value goes after its predecessor, which by then exists; a new first value goes
 * before the first existing one.
 */
function diffEnumLabels(labels: EnumLabelDraft[]): TypeAlteration[] {
  const renames = labels
    .filter((l) => l.original !== null && l.original !== l.value)
    .map((l): TypeAlteration => ({ op: 'renameEnumValue', from: l.original!, to: l.value }))
  const firstExisting = labels.find((l) => l.original !== null)
  const adds = labels.flatMap((l, i): TypeAlteration[] => {
    if (l.original !== null) return []
    if (i > 0) return [{ op: 'addEnumValue', value: l.value, placement: { position: 'after', neighbor: labels[i - 1].value } }]
    return [{ op: 'addEnumValue', value: l.value, ...(firstExisting && { placement: { position: 'before', neighbor: firstExisting.value } }) }]
  })
  return [...renames, ...adds]
}

/** Drops first, so a new attribute may reuse the name of a dropped one. */
function diffAttributes(original: TypeInfo['attributes'], attributes: AttributeDraft[]): TypeAlteration[] {
  const kept = attributes.filter((a) => a.original !== null)
  const keptNames = new Set(kept.map((a) => a.original!.name))
  return [
    ...original.filter((a) => !keptNames.has(a.name)).map((a): TypeAlteration => ({ op: 'dropAttribute', name: a.name })),
    ...kept.filter((a) => a.name.trim() !== a.original!.name)
      .map((a): TypeAlteration => ({ op: 'renameAttribute', from: a.original!.name, to: a.name.trim() })),
    ...kept.filter((a) => a.type.trim() !== a.original!.type)
      .map((a): TypeAlteration => ({ op: 'alterAttributeType', name: a.name.trim(), type: a.type.trim() })),
    ...attributes.filter((a) => a.original === null)
      .map((a): TypeAlteration => ({ op: 'addAttribute', name: a.name.trim(), type: a.type.trim() }))
  ]
}

function diffDomain(type: TypeInfo, draft: TypeDraft): TypeAlteration[] {
  const defaultValue = draft.defaultValue.trim() || null
  const keptChecks = new Set(draft.checks.map((c) => c.original))
  return [
    ...(defaultValue !== type.defaultValue ? [{ op: 'setDefault', expression: defaultValue } as const] : []),
    ...(draft.isNotNull !== type.isNotNull ? [{ op: 'setNotNull', isNotNull: draft.isNotNull } as const] : []),
    ...type.checks.filter((c) => !keptChecks.has(c.name)).map((c): TypeAlteration => ({ op: 'dropCheck', name: c.name })),
    ...draft.checks.filter((c) => c.original === null).map((c): TypeAlteration => ({ op: 'addCheck', expression: c.definition.trim() }))
  ]
}

function diffKindSpecific(type: TypeInfo, draft: TypeDraft): TypeAlteration[] {
  switch (type.kind) {
    case 'enum': return diffEnumLabels(draft.labels)
    case 'composite': return diffAttributes(type.attributes, draft.attributes)
    case 'domain': return diffDomain(type, draft)
    case 'range': return []
  }
}

/**
 * Computes the alterations turning `type` into what the draft describes. The
 * rename comes last so the preview reads top-down against the current name.
 *
 * @param type - The type as currently stored in the database.
 * @param draft - Editor state, assumed valid (see {@link validateTypeDraft}).
 * @returns Alterations in the order they must run; empty when nothing changed.
 */
export function diffTypeDraft(type: TypeInfo, draft: TypeDraft): TypeAlteration[] {
  const owner = draft.owner.trim()
  const comment = draft.comment.trim() || null
  const name = draft.name.trim()
  return [
    ...(owner !== type.owner ? [{ op: 'setOwner', owner } as const] : []),
    ...diffKindSpecific(type, draft),
    ...(comment !== type.comment ? [{ op: 'setComment', comment } as const] : []),
    ...(name !== type.name ? [{ op: 'rename', newName: name } as const] : [])
  ]
}
