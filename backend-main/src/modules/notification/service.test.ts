import { describe, it, expect, beforeEach, vi } from "bun:test";
import { ForbiddenError, NotFoundError } from "@/common/exceptions";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

const { db } = await import("@/db");
const { NotificationService } = await import("./service");

const service = new NotificationService();

function buildSelectMock(rows: any[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(rows),
  } as any;
}

function buildReturningMock(result: any) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result === undefined ? [] : result),
    where: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  } as any;
}

describe("NotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // create: ควรคืน object ที่ถูกสร้าง
  it("create returns created notification", async () => {
    const created = { id: 1, userId: "u1", title: "t", message: "m", isRead: false } as any;
    (db.insert as any).mockReturnValue(buildReturningMock([created]));

    const res = await service.create("u1", "t", "m");
    expect(res).toEqual(created);
  });

  // createMany: หากรายการว่าง -> คืน count 0
  it("createMany returns count 0 for empty or falsy ids", async () => {
    const res = await service.createMany(["", ""], "t", "m");
    expect(res).toEqual({ count: 0 });
  });

  // createMany: กรอง duplicate และคืน count ของ unique
  it("createMany inserts unique userIds and returns count", async () => {
    (db.insert as any).mockReturnValue(buildReturningMock([]));
    const res = await service.createMany(["u1", "u1", "u2"], "t", "m");
    expect(res).toEqual({ count: 2 });
    expect(db.insert).toHaveBeenCalled();
  });

  // getMyNotifications: คืน rows ตาม select
  it("getMyNotifications returns rows from db select", async () => {
    (db.select as any).mockReturnValue(buildSelectMock([{ id: 9, title: "x" }]));
    const rows = await service.getMyNotifications("u1", { unreadOnly: false, limit: 10, offset: 0 });
    expect(rows).toEqual([{ id: 9, title: "x" }]);
  });

  // markRead: notification not found -> NotFoundError
  it("markRead throws NotFoundError if notification not found", async () => {
    (db.select as any).mockReturnValueOnce(buildSelectMock([]));
    await expect(service.markRead("u1", 5, true)).rejects.toBeInstanceOf(NotFoundError);
  });

  // markRead: owner mismatch -> ForbiddenError
  it("markRead throws ForbiddenError when owner mismatch", async () => {
    (db.select as any)
      .mockReturnValueOnce(buildSelectMock([{ id: 5, owner: "other" }]));
    await expect(service.markRead("u1", 5, true)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // markRead: success -> returns updated object
  it("markRead returns updated notification when owner matches", async () => {
    (db.select as any)
      .mockReturnValueOnce(buildSelectMock([{ id: 5, owner: "u1" }]));
    (db.update as any).mockReturnValue(buildReturningMock([{ id: 5, isRead: true }]));

    const res = await service.markRead("u1", 5, true);
    expect(res).toEqual({ id: 5, isRead: true });
  });

  // markAllRead: should call db.update and return success
  it("markAllRead returns success true", async () => {
    (db.update as any).mockReturnValue(buildReturningMock([]));
    const res = await service.markAllRead("u1");
    expect(res).toEqual({ success: true });
  });

  // getAdminUserIds/getOwnerUserIdsByDepartment: map ids
  it("getAdminUserIds and getOwnerUserIdsByDepartment return id arrays", async () => {
    (db.select as any)
      .mockReturnValueOnce(buildSelectMock([{ id: "a1" }]));
    const admins = await service.getAdminUserIds();
    expect(admins).toEqual(["a1"]);

    (db.select as any).mockReturnValueOnce(buildSelectMock([{ id: "o1" }]));
    const owners = await service.getOwnerUserIdsByDepartment(7);
    expect(owners).toEqual(["o1"]);
  });

  // deleteNotification: user not found -> ForbiddenError
  it("deleteNotification throws ForbiddenError when user not found", async () => {
    const tx: any = { select: vi.fn(), delete: vi.fn() };
    tx.select.mockReturnValueOnce(buildSelectMock([])); // users -> none
    (db.transaction as any).mockImplementation(async (cb: any) => cb(tx));
    await expect(service.deleteNotification("u1", 10)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // deleteNotification: notification not found -> NotFoundError
  it("deleteNotification throws NotFoundError when notification not found", async () => {
    const tx: any = { select: vi.fn(), delete: vi.fn() };
    tx.select
      .mockReturnValueOnce(buildSelectMock([{ id: "u1" }])) // user exists
      .mockReturnValueOnce(buildSelectMock([])); // notification none
    (db.transaction as any).mockImplementation(async (cb: any) => cb(tx));
    await expect(service.deleteNotification("u1", 11)).rejects.toBeInstanceOf(NotFoundError);
  });

  // deleteNotification: success -> returns success message
  it("deleteNotification succeeds when user and notification match", async () => {
    const tx: any = { select: vi.fn(), delete: vi.fn() };
    tx.select
      .mockReturnValueOnce(buildSelectMock([{ id: "u1" }]))
      .mockReturnValueOnce(buildSelectMock([{ id: 12, userId: "u1" }]));
    tx.delete.mockReturnValue({ where: vi.fn().mockReturnThis() });
    (db.transaction as any).mockImplementation(async (cb: any) => cb(tx));

    const res = await service.deleteNotification("u1", 12);
    expect(res).toEqual(expect.objectContaining({ success: true }));
  });
});
