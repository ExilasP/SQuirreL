import { describe, expect, it } from 'vitest'
import type { TypeTarget } from './types'
import { buildAlterTypeStatements } from './typeAlterations'

const mood: TypeTarget = { schema: 'public', name: 'mood', kind: 'enum' }
const address: TypeTarget = { schema: 'app', name: 'address', kind: 'composite' }
const positive: TypeTarget = { schema: 'public', name: 'positive', kind: 'domain' }

describe('buildAlterTypeStatements', () => {
  it('adds enum values at the end or next to a neighbour', () => {
    expect(buildAlterTypeStatements(mood, [
      { op: 'addEnumValue', value: 'meh' },
      { op: 'addEnumValue', value: 'great', placement: { position: 'after', neighbor: 'happy' } },
      { op: 'addEnumValue', value: 'awful', placement: { position: 'before', neighbor: 'sad' } }
    ])).toEqual([
      `ALTER TYPE "public"."mood" ADD VALUE 'meh';`,
      `ALTER TYPE "public"."mood" ADD VALUE 'great' AFTER 'happy';`,
      `ALTER TYPE "public"."mood" ADD VALUE 'awful' BEFORE 'sad';`
    ])
  })

  it('escapes labels and identifiers', () => {
    expect(buildAlterTypeStatements({ ...mood, name: 'my"type' }, [{ op: 'renameEnumValue', from: "it's", to: 'ok' }]))
      .toEqual([`ALTER TYPE "public"."my""type" RENAME VALUE 'it''s' TO 'ok';`])
  })

  it('alters composite attributes', () => {
    expect(buildAlterTypeStatements(address, [
      { op: 'addAttribute', name: 'zip', type: ' varchar(10) ' },
      { op: 'dropAttribute', name: 'fax' },
      { op: 'renameAttribute', from: 'town', to: 'city' },
      { op: 'alterAttributeType', name: 'street', type: 'text' }
    ])).toEqual([
      `ALTER TYPE "app"."address" ADD ATTRIBUTE "zip" varchar(10);`,
      `ALTER TYPE "app"."address" DROP ATTRIBUTE "fax";`,
      `ALTER TYPE "app"."address" RENAME ATTRIBUTE "town" TO "city";`,
      `ALTER TYPE "app"."address" ALTER ATTRIBUTE "street" TYPE text;`
    ])
  })

  it('uses ALTER DOMAIN and wraps bare check expressions', () => {
    expect(buildAlterTypeStatements(positive, [
      { op: 'setDefault', expression: '1' },
      { op: 'setDefault', expression: null },
      { op: 'setNotNull', isNotNull: true },
      { op: 'setNotNull', isNotNull: false },
      { op: 'addCheck', expression: 'VALUE > 0' },
      { op: 'addCheck', expression: 'check (VALUE < 100)' },
      { op: 'dropCheck', name: 'positive_check' }
    ])).toEqual([
      `ALTER DOMAIN "public"."positive" SET DEFAULT 1;`,
      `ALTER DOMAIN "public"."positive" DROP DEFAULT;`,
      `ALTER DOMAIN "public"."positive" SET NOT NULL;`,
      `ALTER DOMAIN "public"."positive" DROP NOT NULL;`,
      `ALTER DOMAIN "public"."positive" ADD CHECK (VALUE > 0);`,
      `ALTER DOMAIN "public"."positive" ADD check (VALUE < 100);`,
      `ALTER DOMAIN "public"."positive" DROP CONSTRAINT "positive_check";`
    ])
  })

  it('sets owner and comment with the right object keyword', () => {
    expect(buildAlterTypeStatements(positive, [{ op: 'setOwner', owner: 'admin' }, { op: 'setComment', comment: "Bob's" }]))
      .toEqual([`ALTER DOMAIN "public"."positive" OWNER TO "admin";`, `COMMENT ON DOMAIN "public"."positive" IS 'Bob''s';`])
    expect(buildAlterTypeStatements(mood, [{ op: 'setComment', comment: null }]))
      .toEqual([`COMMENT ON TYPE "public"."mood" IS NULL;`])
  })

  it('targets the new name after a rename', () => {
    expect(buildAlterTypeStatements(mood, [{ op: 'rename', newName: 'feeling' }, { op: 'addEnumValue', value: 'calm' }]))
      .toEqual([`ALTER TYPE "public"."mood" RENAME TO "feeling";`, `ALTER TYPE "public"."feeling" ADD VALUE 'calm';`])
  })
})
