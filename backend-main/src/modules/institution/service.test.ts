import { describe, it, expect, beforeEach, vi } from "bun:test";
import { NotFoundError } from "elysia";
import { BadRequestError, ConflictError, ForbiddenError } from "@/common/exceptions";

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
const { InstitutionService } = await import("./service");
const service = new InstitutionService();

function buildSelectMock(rows: any[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(rows),
  } as any;
}

function buildReturningMock(result: any) {
  return {
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result === undefined ? [] : result),
  } as any;
}

describe("InstitutionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // findAll: คืน data และ meta จาก query โดยใช้ pagination และการกรอง search/type
  it("findAll returns data and pagination meta", async () => {
    (db.select as any)
      .mockReturnValueOnce(buildSelectMock([{ id: 1, name: "A" }]))
      .mockReturnValueOnce(buildSelectMock([{ count: "1" }]));

    const res = await service.findAll({ page: 1, limit: 10, search: "A", type: "UNIVERSITY" });

    expect(res.data).toEqual([expect.objectContaining({ id: 1, name: "A" })]);
    expect(res.meta).toEqual(expect.objectContaining({ total: 1, page: 1, limit: 10, totalPages: 1, hasNextPage: false }));
  });

  // create: เมื่อสร้างสำเร็จ ต้องคืน object ที่ insert แล้ว
  it("create returns created institution object", async () => {
    const created = { id: 1, institutionsType: "UNIVERSITY", name: "Test" } as any;
    (db.insert as any).mockReturnValue(buildReturningMock([created]));

    const res = await service.create({ institutionsType: "UNIVERSITY", name: "Test" });
    expect(res).toEqual(created);
  });

  // create: เมื่อเกิด duplicate key 23505 ต้องโยน ConflictError
  it("create throws ConflictError on duplicate institution name", async () => {
    (db.insert as any).mockImplementation(() => {
      throw { cause: { code: "23505" } };
    });

    await expect(service.create({ institutionsType: "UNIVERSITY", name: "Dup" })).rejects.toBeInstanceOf(ConflictError);
  });

  // update: user ไม่พบต้องโยน ForbiddenError
  it("update throws ForbiddenError when user does not exist", async () => {
    (db.select as any).mockReturnValueOnce(buildSelectMock([]));

    await expect(service.update("u1", 1, { name: "New" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  // update: institution ไม่พบต้องโยน NotFoundError
  it("update throws NotFoundError when institution not found", async () => {
    (db.select as any).mockReturnValueOnce(buildSelectMock([{ id: "u1" }]));
    (db.update as any).mockReturnValue(buildReturningMock(undefined));

    await expect(service.update("u1", 1, { name: "New" })).rejects.toBeInstanceOf(NotFoundError);
  });

  // update: ข้อมูลถูก update สำเร็จ ต้องคืน object ที่แก้ไขแล้ว
  it("update returns updated institution when found", async () => {
    (db.select as any).mockReturnValueOnce(buildSelectMock([{ id: "u1" }]));
    (db.update as any).mockReturnValue(buildReturningMock([{ id: 1, institutionsType: "UNIVERSITY", name: "New", createdAt: new Date(), updatedAt: new Date() }]));

    const res = await service.update("u1", 1, { name: "New" });
    expect(res).toEqual(expect.objectContaining({ id: 1, name: "New" }));
  });

  // delete: เมื่อ user ไม่พบต้อง ForbiddenError
  it("delete throws ForbiddenError when user does not exist", async () => {
    (db.select as any).mockReturnValueOnce(buildSelectMock([]));

    await expect(service.delete("u1", 1)).rejects.toBeInstanceOf(ForbiddenError);
  });

  // delete: เมื่อ institution ไม่พบต้อง NotFoundError
  it("delete throws NotFoundError when institution not found", async () => {
    (db.select as any).mockReturnValueOnce(buildSelectMock([{ id: "u1" }]));
    (db.delete as any).mockReturnValue(buildReturningMock(undefined));

    await expect(service.delete("u1", 1)).rejects.toBeInstanceOf(NotFoundError);
  });

  // delete: เมื่อลบสำเร็จ ควรคืน success true
  it("delete returns success when institution deleted", async () => {
    (db.select as any).mockReturnValueOnce(buildSelectMock([{ id: "u1" }]));
    (db.delete as any).mockReturnValue(buildReturningMock([{ id: 1, institutionsType: "UNIVERSITY", name: "Test", createdAt: new Date(), updatedAt: new Date() }]));

    const res = await service.delete("u1", 1);
    expect(res).toEqual(expect.objectContaining({ success: true }));
  });

  // delete: เมื่อเกิด foreign key 23503 ต้องโยน BadRequestError
  it("delete throws BadRequestError on foreign key constraint", async () => {
    (db.select as any).mockReturnValueOnce(buildSelectMock([{ id: "u1" }]));
    (db.delete as any).mockImplementation(() => {
      throw { cause: { code: "23503" } };
    });

    await expect(service.delete("u1", 1)).rejects.toBeInstanceOf(BadRequestError);
  });
});
