import { describe, expect, it, beforeEach, vi } from "bun:test";
import { NotFoundError } from "@/common/exceptions";

// Mock db shape used by UserService
vi.mock("@/db", () => ({
  db: {
    query: { users: { findFirst: vi.fn(), findMany: vi.fn() } },
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

// note: do not mock '@/db/schema' to avoid ESM resolution issues; use real schema exports

const { db } = await import("@/db");
const { UserService } = await import("./service");

const service = new UserService();

function buildSelectMock(rows: any[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(rows),
  } as any;
}

function buildReturningMock(result: any) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result === undefined ? [] : result),
  } as any;
}

describe("UserService (selected methods)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // me: กรณีผู้ใช้เป็น intern ต้อง merge profile กับ application info
  it("me returns merged profile for intern when application info exists", async () => {
    const userId = "user-1";
    const user = {
      id: userId,
      roleId: 3, // ROLE_INTERN
      studentProfiles: [{ id: 10, image: null }],
    } as any;

    (db.query.users.findFirst as any).mockResolvedValue(user);

    // first select: latest application status
    (db.select as any)
      .mockReturnValueOnce(buildSelectMock([{ applicationStatusId: 555 }]))
      // second select: applicationInformations
      .mockReturnValueOnce(buildSelectMock([{ startDate: new Date("2020-01-01"), endDate: new Date("2020-06-01"), hours: "100" }]));

    const result = await service.me(userId);

    // คาดว่า result จะมี fields หลักของ user และ profile ที่รวมข้อมูล startDate/endDate/hours
    expect(result).toHaveProperty("profile");
    expect(result.profile).toEqual(expect.objectContaining({ startDate: expect.anything(), endDate: expect.anything(), hours: "100" }));
  });

  // me: กรณีผู้ใช้ไม่พบ ต้องโยน Error
  it("me throws when user not found", async () => {
    (db.query.users.findFirst as any).mockResolvedValue(null);
    await expect(service.me("no-user")).rejects.toThrow();
  });

  // getStaff: คืนรายชื่อ staff และ staffProfileId
  it("getStaff maps staffProfileId correctly", async () => {
    const staff = [
      { id: "u1", roleId: 1, staffProfiles: [{ id: 7 }] },
      { id: "u2", roleId: 2, staffProfiles: null },
    ] as any;

    (db.query.users.findMany as any).mockResolvedValue(staff);

    const res = await service.getStaff(5);
    expect(res[0]).toHaveProperty("staffProfileId", 7);
    expect(res[1]).toHaveProperty("staffProfileId", null);
  });

  // updateUser: เมื่ออัปเดตสำเร็จ คืน object เดิม
  it("updateUser returns updated user when found", async () => {
    const updated = { id: "u1", fname: "A" } as any;
    (db.update as any).mockReturnValue(buildReturningMock([updated]));

    const res = await service.updateUser("u1", { fname: "A" });
    expect(res).toEqual(updated);
  });

  // updateUser: เมื่อไม่มีแถวที่อัปเดต -> throw
  it("updateUser throws when user not found", async () => {
    (db.update as any).mockReturnValue(buildReturningMock(undefined));
    await expect(service.updateUser("missing", { fname: "X" })).rejects.toThrow("User not found");
  });

  // updateStaffPhone: เมื่อ staffProfile ไม่พบ -> NotFoundError
  it("updateStaffPhone throws NotFoundError when staffProfile not found", async () => {
    // select from staffProfiles returns nothing
    (db.select as any).mockReturnValueOnce(buildSelectMock([]));
    await expect(service.updateStaffPhone(123, "0812345")).rejects.toBeInstanceOf(NotFoundError);
  });

  // getStudentProgress: คืนค่า accumulated, total, percentage
  it("getStudentProgress returns calculated percentage", async () => {
    (db.select as any).mockReturnValueOnce(buildSelectMock([{ accumulatedHours: "10", totalHoursGoal: "20" }]));
    const res = await service.getStudentProgress("stu1");
    expect(res).toEqual({ accumulatedHours: 10, totalHoursGoal: 20, percentage: 50 });
  });

  it("getStudentProgress throws NotFoundError when no summary", async () => {
    (db.select as any).mockReturnValueOnce(buildSelectMock([undefined]));
    await expect(service.getStudentProgress("stu2")).rejects.toBeInstanceOf(NotFoundError);
  });
});
