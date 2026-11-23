import { describe, expect, it } from 'vitest'
import type { TypeInfo } from '@shared/types'
import { createTypeDraft, diffTypeDraft, validateTypeDraft, type TypeDraft } from './typeDraft'

const baseType: TypeInfo = {
  schema: 'public', name: 'mood', kind: 'enum', owner: 'postgres', comment: null,
  labels: [], attributes: [], baseType: null, isNotNull: false, defaultValue: null, checks: [], definition: ''
}
const enumType: TypeInfo = { ...baseType, labels: ['sad', 'ok', 'happy'] }
const compositeType: TypeInfo = {
  ...baseType, name: 'address', kind: 'composite',
  attributes: [{ name: 'street', type: 'text' }, { name: 'town', type: 'text' }, { name: 'fax', type: 'text' }]
}
const domainType: TypeInfo = {
  ...baseType, name: 'positive', kind: 'domain', baseType: 'integer', defaultValue: '1',
  checks: [{ name: 'positive_check', definition: 'CHECK ((VALUE > 0))' }]
}

const newLabel = (value: string) => ({ key: value, original: null, value })

describe('diffTypeDraft', () => {
  it('returns nothing for an untouched draft', () => {
    for (const type of [enumType, compositeType, domainType]) expect(diffTypeDraft(type, createTypeDraft(type))).toEqual([])
  })

  it('renames enum values and positions new ones after their predecessor', () => {
    const draft = createTypeDraft(enumType)
    const [sad, ok, happy] = draft.labels
    const edited: TypeDraft = { ...draft, labels: [newLabel('awful'), sad, { ...ok, value: 'meh' }, newLabel('fine'), happy, newLabel('great')] }
    expect(diffTypeDraft(enumType, edited)).toEqual([
      { op: 'renameEnumValue', from: 'ok', to: 'meh' },
      { op: 'addEnumValue', value: 'awful', placement: { position: 'before', neighbor: 'sad' } },
      { op: 'addEnumValue', value: 'fine', placement: { position: 'after', neighbor: 'meh' } },
      { op: 'addEnumValue', value: 'great', placement: { position: 'after', neighbor: 'happy' } }
    ])
  })

  it('adds the first value of an empty enum without placement', () => {
    const empty = { ...enumType, labels: [] }
    expect(diffTypeDraft(empty, { ...createTypeDraft(empty), labels: [newLabel('a'), newLabel('b')] })).toEqual([
      { op: 'addEnumValue', value: 'a' },
      { op: 'addEnumValue', value: 'b', placement: { position: 'after', neighbor: 'a' } }
    ])
  })

  it('drops, renames, retypes and adds composite attributes', () => {
    const draft = createTypeDraft(compositeType)
    const [street, town] = draft.attributes
    const edited: TypeDraft = {
      ...draft,
      attributes: [{ ...street, type: 'varchar(200)' }, { ...town, name: 'city', type: 'varchar(80)' }, { key: 'n', original: null, name: 'fax', type: 'int' }]
    }
    expect(diffTypeDraft(compositeType, edited)).toEqual([
      { op: 'dropAttribute', name: 'fax' },
      { op: 'renameAttribute', from: 'town', to: 'city' },
      { op: 'alterAttributeType', name: 'street', type: 'varchar(200)' },
      { op: 'alterAttributeType', name: 'city', type: 'varchar(80)' },
      { op: 'addAttribute', name: 'fax', type: 'int' }
    ])
  })

  it('changes domain default, nullability and checks', () => {
    const edited: TypeDraft = {
      ...createTypeDraft(domainType), defaultValue: ' ', isNotNull: true,
      checks: [{ key: 'n', original: null, definition: 'VALUE < 100' }]
    }
    expect(diffTypeDraft(domainType, edited)).toEqual([
      { op: 'setDefault', expression: null },
      { op: 'setNotNull', isNotNull: true },
      { op: 'dropCheck', name: 'positive_check' },
      { op: 'addCheck', expression: 'VALUE < 100' }
    ])
  })

  it('puts owner first and comment then rename last', () => {
    const edited: TypeDraft = { ...createTypeDraft(enumType), name: ' feeling ', owner: 'admin', comment: 'How you feel' }
    expect(diffTypeDraft(enumType, edited)).toEqual([
      { op: 'setOwner', owner: 'admin' },
      { op: 'setComment', comment: 'How you feel' },
      { op: 'rename', newName: 'feeling' }
    ])
  })

  it('clears a comment emptied by the user', () => {
    const commented = { ...enumType, comment: 'x' }
    expect(diffTypeDraft(commented, { ...createTypeDraft(commented), comment: '' })).toEqual([{ op: 'setComment', comment: null }])
  })
})

describe('validateTypeDraft', () => {
  it('accepts an untouched draft', () => {
    expect(validateTypeDraft(enumType, createTypeDraft(enumType))).toEqual([])
  })

  it('rejects empty names and duplicate enum values', () => {
    const draft = createTypeDraft(enumType)
    expect(validateTypeDraft(enumType, { ...draft, name: ' ', labels: [...draft.labels, newLabel('ok'), newLabel('')] }))
      .toEqual(['The type name cannot be empty', 'Enum values cannot be empty', 'Duplicate enum value "ok"'])
  })

  it('rejects incomplete or duplicate attributes', () => {
    const draft = createTypeDraft(compositeType)
    expect(validateTypeDraft(compositeType, { ...draft, attributes: [...draft.attributes, { key: 'n', original: null, name: 'town', type: '' }] }))
      .toEqual(['Attribute types cannot be empty', 'Duplicate attribute "town"'])
  })

  it('rejects empty new checks', () => {
    const draft = createTypeDraft(domainType)
    expect(validateTypeDraft(domainType, { ...draft, checks: [{ key: 'n', original: null, definition: '' }] })).toEqual(['Checks cannot be empty'])
  })
})
