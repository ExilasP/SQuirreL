/**
 * Classes tinting a Ctrl+F hit; the current hit gets a stronger tint and an outline.
 *
 * @param isMatch - Whether the element matches the search.
 * @param isCurrent - Whether it is the hit the user is on.
 * @returns Tailwind classes, empty for an element that does not match.
 */
export function searchHitClassName(isMatch: boolean, isCurrent: boolean): string {
  if (isCurrent) return 'outline outline-2 -outline-offset-2 outline-search bg-search/20'
  return isMatch ? 'bg-search/15' : ''
}
