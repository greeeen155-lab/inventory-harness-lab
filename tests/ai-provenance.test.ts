import { describe, expect, it } from 'vitest'
import { readAiProvenance, unauthorizedProtectedPaths } from '../scripts/ai-provenance'

describe('AI harness provenance', () => {
  const valid = JSON.stringify({
    source: 'ai-harness',
    sessionId: 'session-1',
    repository: 'inventory-harness-lab',
    allowedPaths: ['AGENTS.md'],
    changedPaths: ['AGENTS.md'],
  })

  it('accepts a normalized exact-path scope', () => {
    const result = readAiProvenance(valid)
    expect(result.kind).toBe('valid')
    if (result.kind === 'valid') {
      expect(result.provenance.allowedPaths).toEqual(['AGENTS.md'])
      expect(unauthorizedProtectedPaths(['AGENTS.md'], result.provenance)).toEqual([])
    }
  })

  it('rejects traversal and absolute paths', () => {
    for (const file of ['../AGENTS.md', '/AGENTS.md', 'C:\\AGENTS.md']) {
      const result = readAiProvenance(JSON.stringify({
        source: 'ai-harness',
        sessionId: 'session-1',
        repository: 'inventory-harness-lab',
        allowedPaths: [file],
        changedPaths: [file],
      }))
      expect(result.kind).toBe('invalid')
    }
  })

  it('reports protected paths outside the stated scope', () => {
    const result = readAiProvenance(valid)
    expect(result.kind).toBe('valid')
    if (result.kind === 'valid') {
      expect(unauthorizedProtectedPaths(['AGENTS.md', 'CLAUDE.md'], result.provenance)).toEqual([
        'CLAUDE.md',
      ])
    }
  })

  it('does not treat legacy approval variables as provenance', () => {
    expect(readAiProvenance('').kind).toBe('absent')
    expect(readAiProvenance(undefined).kind).toBe('absent')
  })
})
