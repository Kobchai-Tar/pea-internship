import { describe, it, expect, vi, beforeEach } from 'bun:test'

describe('StaffLogsService (เทมเพลต)', () => {
  beforeEach(() => {
    ;(vi as any).resetModules?.()
  })

  // กรณี : mock DB query returns log items
  // expect : ฟังก์ชันจะคืน array ที่มีความยาว > 0
  it('mock db query; expect array length > 0', async () => {
    const mockQuery = vi.fn().mockResolvedValue([{ id: 1, action: 'login' }])
    vi.mock('../db', () => ({ query: mockQuery }))

    const db = await import('../db')
    const rows = await db.query('select 1')

    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
  })
})
