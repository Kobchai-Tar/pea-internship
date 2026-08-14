/**
 * เทมเพลต unit test สำหรับ `institution-ticket` service
 */
import { describe, it, expect, vi, beforeEach } from 'bun:test'

describe('InstitutionTicketService (เทมเพลต)', () => {
  beforeEach(() => {
    ;(vi as any).resetModules?.()
  })

  // กรณี : สร้าง ticket ใหม่ โดย mock service ที่ส่ง notification
  // expect : จะเรียกฟังก์ชันส่ง notification หนึ่งครั้ง
  it('create ticket and notify; expect notify called once', async () => {
    const mockNotify = vi.fn()
    vi.mock('../notification', () => ({ notify: mockNotify }))

    const notification = await import('../notification')
    notification.notify('new-ticket')

    expect(mockNotify).toHaveBeenCalledTimes(1)
  })
})
