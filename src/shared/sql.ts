/** Quotes an SQL identifier (table, column, type name), doubling embedded quotes. */
export const quoteIdent = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`

/** Quotes an SQL string literal, doubling embedded single quotes. */
export const quoteLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`
