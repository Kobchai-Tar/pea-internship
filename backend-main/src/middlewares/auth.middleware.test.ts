import { describe, expect, it, vi, beforeEach } from "bun:test";
import { isAuthenticated, ROLE_IDS } from "./auth.middleware";
import { UnauthorizedError, ForbiddenError } from "@/common/exceptions";

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

const { auth } = await import("@/lib/auth");

function buildHeaders() {
  return new Headers({ authorization: "Bearer test-token" });
}

function authResolve() {
  return (isAuthenticated as any).extender.macro.auth.resolve;
}

function roleResolve(roles: number | number[]) {
  return (isAuthenticated as any).extender.macro.role(roles).resolve;
}

describe("auth.middleware macros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // เมื่อไม่มี session อยู่ในระบบ ต้องถูกปฏิเสธด้วย UnauthorizedError
  it("throws UnauthorizedError when no session is found", async () => {
    (auth.api.getSession as any).mockResolvedValue(null);

    await expect(
      authResolve()({ request: { headers: buildHeaders() } })
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  // เมื่อมี session ถูกต้อง macro auth จะต้องคืนข้อมูล user และ session
  it("returns user and session when auth macro resolves", async () => {
    const session = {
      user: { id: "user-123", roleId: ROLE_IDS.STUDENT },
      session: {},
    };
    (auth.api.getSession as any).mockResolvedValue(session);

    const result = await authResolve()({ request: { headers: buildHeaders() } });

    expect(result).toEqual({ user: session.user, session: session.session });
  });

  // เมื่อ role ผู้ใช้ไม่ตรงกับที่ร้องขอ ต้องถูกปฏิเสธด้วย ForbiddenError
  it("throws ForbiddenError when role is not allowed", async () => {
    const session = {
      user: { id: "user-123", roleId: ROLE_IDS.STUDENT },
      session: {},
    };
    (auth.api.getSession as any).mockResolvedValue(session);

    await expect(
      roleResolve(ROLE_IDS.ADMIN)({ request: { headers: buildHeaders() } })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  // เมื่อ role ผู้ใช้ตรงกับที่อนุญาต จะต้องได้รับการอนุญาตและคืนข้อมูล user/session
  it("allows access when role is allowed", async () => {
    const session = {
      user: { id: "user-123", roleId: ROLE_IDS.ADMIN },
      session: {},
    };
    (auth.api.getSession as any).mockResolvedValue(session);

    const result = await roleResolve(ROLE_IDS.ADMIN)(
      { request: { headers: buildHeaders() } }
    );

    expect(result).toEqual({ user: session.user, session: session.session });
  });

  // ยืนยันว่าค่าคงที่ ROLE_IDS ถูก export และมีค่าตรงตามที่คาดไว้
  it("exports ROLE_IDS", () => {
    expect(ROLE_IDS.ADMIN).toBe(1);
    expect(ROLE_IDS.MENTOR).toBe(2);
    expect(ROLE_IDS.STUDENT).toBe(3);
  });
});
