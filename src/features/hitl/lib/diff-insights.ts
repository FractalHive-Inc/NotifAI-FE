import { isRecord, stringify } from './primitives'

/**
 * What a reviewer changed, derived by comparing two extractions.
 *
 * The agent's original is on `agent_request.state.doc_insights` and the approved
 * version on `approval.decision.doc_insights`. Both are already persisted, so
 * the corrections can be recovered from data we hold — which is why there is no
 * audit table and nothing extra is sent with the decision. A stored list of
 * edits would be a third copy that can disagree with the two blobs it describes;
 * this cannot, because it *is* the two blobs.
 *
 * The trade-off is honest: this sees what changed, not who typed what or in what
 * order. That is enough to show a reviewer which values are theirs.
 */

export interface InsightChange {
  /** Dotted path including array indices, as it sits in the payload. */
  path: string
  /**
   * The same path with numeric segments dropped. `FieldSection` keys fields this
   * way — array position is an artefact of how the agent packs single-key
   * objects, not part of a field's identity.
   */
  key: string
  from: string
  to: string
}

/** Every leaf in the payload, flattened to `path -> display text`. */
function leaves(value: unknown, path: string[], into: Map<string, string>): void {
  if (Array.isArray(value)) {
    // Empty containers are not leaves — there is no value to have changed.
    value.forEach((item, index) => leaves(item, [...path, String(index)], into))
    return
  }

  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      leaves(child, [...path, key], into)
    }
    return
  }

  if (path.length > 0) into.set(path.join('.'), stringify(value))
}

function stripIndices(path: string): string {
  return path
    .split('.')
    .filter((segment) => !/^\d+$/.test(segment))
    .join('.')
}

/**
 * The leaves that differ between the agent's extraction and the approved one.
 *
 * A key present in one side and absent from the other counts as a change to or
 * from empty: a reviewer clearing a field is a correction, and showing nothing
 * would make it look like the agent never extracted it.
 *
 * Line items are compared leaf by leaf like everything else. A row inserted in
 * the middle therefore reports every following cell as changed, which is
 * technically true and not useful — so the caller summarises line-item changes
 * rather than listing them.
 */
export function diffInsights(original: unknown, corrected: unknown): InsightChange[] {
  const before = new Map<string, string>()
  const after = new Map<string, string>()

  leaves(original, [], before)
  leaves(corrected, [], after)

  const changes: InsightChange[] = []

  for (const path of new Set([...before.keys(), ...after.keys()])) {
    const from = before.get(path) ?? ''
    const to = after.get(path) ?? ''
    if (from === to) continue

    changes.push({ path, key: stripIndices(path), from, to })
  }

  return changes.sort((a, b) => a.path.localeCompare(b.path))
}

/** Changes by field key, for looking one up while rendering that field. */
export function changesByKey(changes: InsightChange[]): Map<string, InsightChange> {
  const map = new Map<string, InsightChange>()
  for (const change of changes) {
    // First wins: with an array of single-key objects, several paths collapse to
    // the same key and the earliest is the one the field renders from.
    if (!map.has(change.key)) map.set(change.key, change)
  }
  return map
}
