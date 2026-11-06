/** Relevance tiers, best first: lower is a more probable match. */
const MatchTier = { Exact: 0, Prefix: 1, WordStart: 2, Substring: 3, Subsequence: 4 } as const

/** Characters that separate words in identifiers such as `user_roles` or `order-items`. */
const WORD_SEPARATOR = /[_\-.\s]/

/** Whether the characters of `needle` appear in `haystack` in order. */
function isSubsequence(needle: string, haystack: string): boolean {
  let from = 0
  for (const char of needle) {
    from = haystack.indexOf(char, from) + 1
    if (from === 0) return false
  }
  return true
}

/** Index of the first occurrence of `needle` that starts a word in `haystack`, or -1. */
function findWordStart(needle: string, haystack: string): number {
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + 1)) {
    if (index === 0 || WORD_SEPARATOR.test(haystack[index - 1])) return index
  }
  return -1
}

/**
 * Scores how well a typed query matches a name, for ranking quick-open results.
 *
 * Matching is case-insensitive. An exact match beats a prefix, which beats a match
 * at a word start, then any substring, then a scattered subsequence. Within a tier,
 * earlier and tighter matches (shorter names) rank first.
 *
 * @param query - Text typed by the user; an empty query matches everything equally.
 * @param name - Candidate name to score.
 * @returns A sortable score (lower is better), or `null` when `name` does not match.
 */
export function scoreMatch(query: string, name: string): number | null {
  const needle = query.trim().toLowerCase()
  const haystack = name.toLowerCase()
  if (needle === '') return 0
  const tierScore = (tier: number, position: number): number =>
    tier * 1_000_000 + position * 1_000 + Math.min(haystack.length - needle.length, 999)
  if (haystack === needle) return tierScore(MatchTier.Exact, 0)
  if (haystack.startsWith(needle)) return tierScore(MatchTier.Prefix, 0)
  const wordStart = findWordStart(needle, haystack)
  if (wordStart !== -1) return tierScore(MatchTier.WordStart, wordStart)
  const substring = haystack.indexOf(needle)
  if (substring !== -1) return tierScore(MatchTier.Substring, substring)
  if (isSubsequence(needle, haystack)) return tierScore(MatchTier.Subsequence, haystack.indexOf(needle[0]))
  return null
}
