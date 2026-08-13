import { describe, expect, it, beforeEach, vi } from "bun:test";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/common/exceptions";

// mock db.transaction and provide a tx object we can control per-test
vi.mock("@/db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

// Avoid mocking '@/db/schema' to prevent ESM export issues

const { db } = await import("@/db");
const { ApplicationService } = await import("./service");

const service = new ApplicationService();

function buildSelectMock(rows: any[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(rows),
  } as any;
}

function buildInsertMock(result: any) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result === undefined ? [] : result),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
  } as any;
}

function buildUpdateMock(result: any) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result === undefined ? [] : result),
  } as any;
}

describe("ApplicationService (selected methods)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // apply: กรณี user ไม่พบ คาดว่าจะโยน ForbiddenError
  it("apply throws ForbiddenError when user not found", async () => {
    const tx: any = { select: vi.fn() };
    tx.select.mockReturnValueOnce(buildSelectMock([])); // users select -> none

    (db.transaction as any).mockImplementation(async (cb: any) => cb(tx));

    await expect(service.apply("u1", 5)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // apply: กรณี profile นักศึกษาไม่พบ -> ForbiddenError
  it("apply throws ForbiddenError when student profile not found", async () => {
    const tx: any = { select: vi.fn() };
    tx.select
      .mockReturnValueOnce(buildSelectMock([{ id: "u1" }])) // users
      .mockReturnValueOnce(buildSelectMock([])); // studentProfiles -> none

    (db.transaction as any).mockImplementation(async (cb: any) => cb(tx));

    await expect(service.apply("u1", 5)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // apply: เมื่อตำแหน่งถูกพบและเปิดรับสมัคร ควรคืนข้อมูล position และ nextStep
  it("apply returns position info when position open", async () => {
    const tx: any = { select: vi.fn() };
    tx.select
      .mockReturnValueOnce(buildSelectMock([{ id: "u1" }])) // users
      .mockReturnValueOnce(buildSelectMock([{ internshipStatus: "IDLE" }])) // studentProfiles
      .mockReturnValueOnce(buildSelectMock([
        { id: 99, departmentId: 7, recruitmentStatus: "OPEN", resumeRq: false, portfolioRq: false, positionCount: null, acceptedCount: 0 },
      ])); // internshipPositions

    (db.transaction as any).mockImplementation(async (cb: any) => cb(tx));

    const res = await service.apply("u1", 99);
    expect(res).toEqual(expect.objectContaining({ positionId: 99, departmentId: 7, nextStep: "SUBMIT_INFORMATION" }));
  });

  // submitInformation: เมื่อ endDate < startDate -> BadRequestError
  it("submitInformation throws BadRequestError when endDate before startDate", async () => {
    const tx: any = { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
    tx.select
      .mockReturnValueOnce(buildSelectMock([{ id: "u1" }])) // users
      .mockReturnValueOnce(buildSelectMock([{ internshipStatus: "IDLE" }])) // studentProfiles
      .mockReturnValueOnce(buildSelectMock([{ id: 200, departmentId: 8, recruitmentStatus: "OPEN" }])) // positions
      .mockReturnValueOnce(buildSelectMock([])); // last round select -> none

    (db.transaction as any).mockImplementation(async (cb: any) => cb(tx));

    const start = new Date("2023-06-10");
    const end = new Date("2023-06-01");

    await expect(
      service.submitInformation("u1", 200, { skill: "s", expectation: "e", startDate: start, endDate: end, hours: 10 })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  // submitInformation: เส้นทางสำเร็จ ควรคืน applicationId และ applicationStatus
  it("submitInformation creates application and returns ids on success", async () => {
    const tx: any = { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
    tx.select
      .mockReturnValueOnce(buildSelectMock([{ id: "u1" }]))
      .mockReturnValueOnce(buildSelectMock([{ internshipStatus: "IDLE" }]))
      .mockReturnValueOnce(buildSelectMock([{ id: 200, departmentId: 8, recruitmentStatus: "OPEN" }]))
      .mockReturnValueOnce(buildSelectMock([])); // last round select -> none

    // insert applicationStatuses -> returning new app id
    tx.insert.mockReturnValueOnce(buildInsertMock([{ id: 12345, applicationStatus: "PENDING_DOCUMENT" }]));
    // subsequent inserts/updates can be no-ops
    tx.insert.mockReturnValue(buildInsertMock([]));
    tx.update.mockReturnValue(buildUpdateMock([]));

    (db.transaction as any).mockImplementation(async (cb: any) => cb(tx));

    const start = new Date("2024-01-01");
    const end = new Date("2024-06-01");

    const res = await service.submitInformation("u1", 200, { skill: "s", expectation: "e", startDate: start, endDate: end, hours: 100 });

    expect(res).toEqual(expect.objectContaining({ applicationId: 12345, applicationStatus: "PENDING_DOCUMENT" }));
  });
});
