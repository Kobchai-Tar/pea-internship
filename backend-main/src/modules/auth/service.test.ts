import { describe, expect, it, beforeEach, vi } from "bun:test";
import { AuthService } from "./service";
import { BadRequestError, InternalServerError } from "@/common/exceptions";

vi.mock("@/db", () => ({
  db: {
    transaction: vi.fn(),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/db/schema", () => ({
  accounts: {},
  passwordResetTokens: {},
  studentProfiles: {},
  userFcmTokens: {},
  users: {},
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
      signInUsername: vi.fn(),
      signOut: vi.fn(),
      signInSocial: vi.fn(),
    },
    $context: Promise.resolve({ password: { hash: vi.fn().mockResolvedValue("hashed-password") } }),
  },
}));

vi.mock("@/modules/mail/service", () => ({
  sendResetPasswordCodeEmail: vi.fn(),
}));

const { db } = await import("@/db");
const { auth } = await import("@/lib/auth");
const { sendResetPasswordCodeEmail } = await import("@/modules/mail/service");

const authService = new AuthService();

function buildSelectMock(rows: any[]) {
  const query = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockReturnThis(),
  };
  return query;
}

function buildUpdateMock(result: any = undefined) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(result),
    returning: vi.fn().mockResolvedValue(result),
  };
}

function buildInsertMock(result: any = undefined) {
  return {
    values: vi.fn().mockResolvedValue(result),
  };
}

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ตรวจสอบกรณีลงทะเบียน intern สำเร็จ เมื่อ auth.signUpEmail และ db.transaction ทำงานปกติ
  it("registerIntern succeeds when auth and DB transaction work", async () => {
    (auth.api.signUpEmail as any).mockResolvedValue({ user: { id: "user-123" } });
    (db.transaction as any).mockResolvedValue({ success: true, message: "Intern registration successful" });

    const result = await authService.registerIntern({
      email: "intern@example.com",
      password: "Abcd1234",
      fname: "Intern",
      lname: "User",
      phoneNumber: "0812345678",
      gender: "MALE",
      institutionId: 1,
      major: "Testing",
      studentNote: "note",
    });

    expect(result).toEqual({ success: true, message: "Intern registration successful" });
    expect(auth.api.signUpEmail).toHaveBeenCalled();
    expect(db.transaction).toHaveBeenCalled();
  });

  // ตรวจสอบกรณีลงทะเบียน intern ล้มเหลวเมื่อ db.transaction โยน error และ cleanup โดยเรียก db.delete
  it("registerIntern rolls back when DB transaction throws and throws BadRequestError", async () => {
    (auth.api.signUpEmail as any).mockResolvedValue({ user: { id: "user-123" } });
    (db.transaction as any).mockRejectedValue(new Error("DB failure"));
    (db.delete as any).mockResolvedValue(undefined);

    await expect(
      authService.registerIntern({
        email: "intern@example.com",
        password: "Abcd1234",
        fname: "Intern",
        lname: "User",
        phoneNumber: "0812345678",
        gender: "MALE",
        institutionId: 1,
        major: "Testing",
        studentNote: "note",
      })
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(db.delete).toHaveBeenCalled();
  });

  // เมื่อ login ส่งข้อมูลไม่ถูกต้อง auth api จะคืน response ที่ไม่ ok แล้ว service ต้องโยน BadRequestError
  it("login throws BadRequestError when auth response is invalid", async () => {
    (auth.api.signInUsername as any).mockResolvedValue({ ok: false });

    await expect(
      authService.login({ phoneNumber: "0812345678", password: "wrong" })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  // เมื่อขอ reset password แล้วไม่พบผู้ใช้ในฐานข้อมูล จะต้องโยน BadRequestError
  it("requestResetPassword throws BadRequestError when user is not found", async () => {
    (db.select as any).mockReturnValue(buildSelectMock([]));

    await expect(
      authService.requestResetPassword({ email: "missing@example.com", phoneNumber: "0812345678" })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  // เมื่อพบผู้ใช้ในระบบ จะต้องสร้าง token, save ลง DB แล้วเรียก email service ส่งรหัส
  it("requestResetPassword succeeds when user exists", async () => {
    (db.select as any).mockReturnValue(buildSelectMock([{ id: "user-123", email: "intern@example.com", phoneNumber: "0812345678" }]));
    (db.update as any).mockReturnValue(buildUpdateMock());
    (db.insert as any).mockReturnValue(buildInsertMock());

    const result = await authService.requestResetPassword({
      email: "intern@example.com",
      phoneNumber: "0812345678",
    });

    expect(result).toEqual({ success: true, message: "ส่งรหัสยืนยันไปยังอีเมลเรียบร้อยแล้ว" });
    expect(sendResetPasswordCodeEmail).toHaveBeenCalledWith("intern@example.com", expect.any(String));
  });

  // ยืนยันว่า loginWithKeycloak จะเรียก auth.api.signInSocial และส่ง response เดิมกลับ
  it("loginWithKeycloak delegates to auth.api.signInSocial", async () => {
    const response = new Response(null, { status: 302 });
    (auth.api.signInSocial as any).mockResolvedValue(response);

    const result = await authService.loginWithKeycloak(new Headers({}));

    expect(result).toBe(response);
    expect(auth.api.signInSocial).toHaveBeenCalled();
  });
});
