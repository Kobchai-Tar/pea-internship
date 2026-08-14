import { describe, it, expect, vi, beforeEach } from 'bun:test'

describe('RoleService (เทมเพลต)', () => {
  beforeEach(() => {
    ;(vi as any).resetModules?.()
  })

  // กรณี : ยิง api ไปหา user โดยทำการ mock api ขึ้นมา
  // ตัวอย่างการ mock แล้ว import โมดูลที่ mocked
  // expect : user จะต้องตอบกลับมาด้วยชื่อ 'ทดสอบ'
  it('mock external api getUser; expect name === ทดสอบ', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({ id: 1, name: 'ทดสอบ' })
    vi.mock('../api', () => ({ getUser: mockGetUser }))

    const api = await import('../api')
    const user = await api.getUser(1)

    expect(user?.name).toBe('ทดสอบ')
    expect(mockGetUser).toHaveBeenCalledWith(1)
  })
})
