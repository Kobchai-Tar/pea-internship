import { describe, expect, it, beforeEach, vi } from "bun:test";
import { NotFoundError } from "elysia";
import { BadRequestError, ConflictError } from "@/common/exceptions";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/db/schema", () => ({
  departments: {},
}));

const { db } = await import("@/db");
const { DepartmentService } = await import("./service");

const service = new DepartmentService();

function buildSelectMock(rows: any[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    // final step: when awaited, resolve to rows
    then: (resolve: any) => resolve(rows),
  } as any;
}

function buildCountMock(total: number) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve([{ count: String(total) }]),
  } as any;
}

function buildInsertMock(result: any) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  } as any;
}

function buildUpdateMock(result: any) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result === undefined ? [] : result),
  } as any;
}

function buildDeleteMock(result: any) {
  return {
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result === undefined ? [] : result),
  } as any;
}

describe("DepartmentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // findAll: เมื่อมีข้อมูลใน DB ต้องคืน structure { data, meta }
  it("findAll returns data and meta with pagination", async () => {
    const rows = [ { id: 1, deptSap: 1 } ] as any;
    (db.select as any)
      .mockReturnValueOnce(buildSelectMock(rows)) // data query
      .mockReturnValueOnce(buildCountMock(1)); // count query

    const result = await service.findAll({ page: 1, limit: 1 });

    // Expect returned data array to match mocked rows
    expect(result.data).toEqual(rows);
    // Expect meta to include total and pagination info
    expect(result.meta).toEqual(expect.objectContaining({ total: 1, page: 1, limit: 1 }));
  });

  // create: เมื่อ insert สำเร็จ ต้องคืนแถวใหม่
  it("create returns new department on success", async () => {
    const newDept = { deptSap: 123, deptFull: "Dept" } as any;
    (db.insert as any).mockReturnValue(buildInsertMock([newDept]));

    const result = await service.create({ deptSap: 123 } as any);

    // Expect new department record to be returned
    expect(result).toEqual(newDept);
  });

  // create: เมื่อเกิด Unique constraint (23505) ต้องโยน ConflictError
  it("create throws ConflictError on unique constraint violation", async () => {
    // simulate DB error shape: error.cause.code === '23505'
    (db.insert as any).mockImplementation(() => {
      throw { cause: { code: '23505' } };
    });

    await expect(service.create({ deptSap: 123 } as any)).rejects.toBeInstanceOf(ConflictError);
  });

  // update: เมื่อ update พบแถว ให้คืนข้อมูลใหม่
  it("update returns updated department when found", async () => {
    const updated = { deptSap: 5, deptFull: "Updated" } as any;
    (db.update as any).mockReturnValue(buildUpdateMock([updated]));

    const result = await service.update(5, { deptFull: "Updated" } as any);

    // Expect returned updated department object
    expect(result).toEqual(updated);
  });

  // update: เมื่อไม่มีแถวที่อัปเดต ต้องโยน NotFoundError
  it("update throws NotFoundError when department not found", async () => {
    // ensure the mock returns a chainable object even after clearAllMocks
    (db as any).update = vi.fn(() => buildUpdateMock(undefined));

    await expect(service.update(999, { deptFull: "X" } as any)).rejects.toBeInstanceOf(NotFoundError);
  });

  // update: conflict (23505) -> ConflictError
  it("update throws ConflictError on unique constraint violation", async () => {
    // simulate DB unique constraint by assigning a function that throws the shaped error
    (db as any).update = () => { throw { cause: { code: '23505' } }; };

    await expect(service.update(5, { deptFull: "X" } as any)).rejects.toBeInstanceOf(ConflictError);
  });

  // delete: success -> return success message
  it("delete returns success when department deleted", async () => {
    const deleted = { deptSap: 10 } as any;
    (db.delete as any).mockReturnValue(buildDeleteMock([deleted]));

    const result = await service.delete(10);

    // Expect success response structure
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  // delete: not found -> NotFoundError
  it("delete throws NotFoundError when department not found", async () => {
    // ensure delete returns a chainable mock even after clearAllMocks
    (db as any).delete = vi.fn(() => buildDeleteMock(undefined));

    await expect(service.delete(12345)).rejects.toBeInstanceOf(NotFoundError);
  });

  // delete: foreign key violation 23503 -> BadRequestError
  it("delete throws BadRequestError on foreign key constraint", async () => {
    // simulate foreign key constraint by assigning a function that throws the shaped error
    (db as any).delete = () => { throw { cause: { code: '23503' } }; };

    await expect(service.delete(20)).rejects.toBeInstanceOf(BadRequestError);
  });
});
