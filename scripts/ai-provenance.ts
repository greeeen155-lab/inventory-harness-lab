import path from 'node:path'

export type AiProvenance = {
  source: 'ai-harness'
  sessionId: string
  repository: string
  allowedPaths: string[]
  changedPaths: string[]
  expiresAt?: string
}

export type ProvenanceResult =
  | { kind: 'absent' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'valid'; provenance: AiProvenance }

export const normalizeProvenancePath = (value: string): string | null => {
  const normalized = value.replace(/\\/g, '/')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:\//.test(normalized)
  ) return null

  const parts = normalized.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..')) return null
  return parts.join('/')
}

const paths = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null
  const normalized = value.map((item) => (typeof item === 'string' ? normalizeProvenancePath(item) : null))
  if (normalized.some((item) => item === null)) return null
  return [...new Set(normalized as string[])].sort()
}

export const readAiProvenance = (raw = process.env.AI_HARNESS_PROVENANCE): ProvenanceResult => {
  if (!raw?.trim()) return { kind: 'absent' }

  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return { kind: 'invalid', reason: 'not an object' }
    const candidate = value as Record<string, unknown>

    if (candidate.source !== 'ai-harness') {
      return { kind: 'invalid', reason: 'unsupported source' }
    }
    if (typeof candidate.sessionId !== 'string' || !candidate.sessionId.trim()) {
      return { kind: 'invalid', reason: 'missing session id' }
    }
    if (typeof candidate.repository !== 'string' || !candidate.repository.trim()) {
      return { kind: 'invalid', reason: 'missing repository' }
    }

    const allowedPaths = paths(candidate.allowedPaths)
    const changedPaths = paths(candidate.changedPaths)
    if (!allowedPaths || !changedPaths) {
      return { kind: 'invalid', reason: 'invalid path list' }
    }
    if (candidate.expiresAt !== undefined) {
      if (typeof candidate.expiresAt !== 'string' || Number.isNaN(Date.parse(candidate.expiresAt))) {
        return { kind: 'invalid', reason: 'invalid expiry' }
      }
      if (Date.parse(candidate.expiresAt) <= Date.now()) {
        return { kind: 'invalid', reason: 'expired' }
      }
    }

    return {
      kind: 'valid',
      provenance: {
        source: 'ai-harness',
        sessionId: candidate.sessionId.trim(),
        repository: candidate.repository.trim(),
        allowedPaths,
        changedPaths,
        ...(candidate.expiresAt === undefined ? {} : { expiresAt: candidate.expiresAt as string }),
      },
    }
  } catch {
    return { kind: 'invalid', reason: 'invalid JSON' }
  }
}

export const unauthorizedProtectedPaths = (
  protectedChanges: Iterable<string>,
  provenance: AiProvenance,
): string[] => {
  const allowed = new Set(provenance.allowedPaths)
  const changed = new Set(provenance.changedPaths)
  return [...new Set(protectedChanges)].filter((file) => !allowed.has(file) || !changed.has(file)).sort()
}
