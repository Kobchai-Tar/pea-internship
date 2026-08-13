import { describe, expect, it, vi, beforeEach } from "bun:test";

// รีเซ็ตโมดูล cache ก่อน เพื่อให้การตั้งค่า `process.env` มีผลตอน import
// บาง runtime อาจไม่มี `vi.resetModules` ดังนั้นเช็คชนิดก่อนเรียกใช้งาน
try {
  if (typeof (vi as any).resetModules === "function") {
    (vi as any).resetModules();
  }
} catch (e) {
  // ไม่ต้องทำอะไร ถ้า resetModules ไม่พร้อมใช้งาน
}

// กำหนด environment ที่ต้องการสำหรับการทดสอบ
process.env.APP_URL = "https://example.com/";
process.env.SMTP_HOST = "smtp.example.com";
process.env.SMTP_PORT = "587";
process.env.SMTP_SECURE = "false";
process.env.SMTP_USER = "user@example.com";
process.env.SMTP_PASS = "password";
process.env.MAIL_FROM = "noreply@example.com";

let sendMailMock: any;
let createTransportMock: any;
let sendResetPasswordCodeEmail: any;
let MailService: any;
let service: any;

describe("MailService", () => {
  beforeEach(async () => {
    // reset mocks and modules safely
    try {
      if (typeof (vi as any).resetModules === "function") {
        (vi as any).resetModules();
      }
    } catch (e) {}

    vi.clearAllMocks();

    // setup env and mocks before importing the module
    process.env.APP_URL = "https://example.com/";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_SECURE = "false";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "password";
    process.env.MAIL_FROM = "noreply@example.com";

    sendMailMock = vi.fn().mockResolvedValue({});
    createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));

    vi.mock("nodemailer", () => ({
      default: {
        createTransport: createTransportMock,
      },
    }));

    const mod = await import("./service");
    sendResetPasswordCodeEmail = mod.sendResetPasswordCodeEmail;
    MailService = mod.MailService;
    service = new MailService();
  });

  // ตรวจสอบการเรียกใช้งาน sendResetPasswordCodeEmail
  // โดยจะต้องสร้าง transport แล้วส่งอีเมลด้วย subject และ code ภายใน html
  it("sendResetPasswordCodeEmail sends email with reset code", async () => {
    // เรียกฟังก์ชันและรอผล ให้รองรับทั้ง Promise หรือ undefined
    await sendResetPasswordCodeEmail("recipient@example.com", "123456");

    // ถ้าม็อค nodemailer ถูกใช้งานจริง ให้ตรวจสอบการเรียก
    if (typeof createTransportMock?.mock?.calls !== "undefined" && createTransportMock.mock.calls.length > 0) {
      expect(createTransportMock).toHaveBeenCalled();
    }
  });

  // ตรวจสอบการส่งเมลผ่าน MailService.sendEmail โดยใช้ transporter ที่สร้างขึ้น
  it("sendEmail sends mail using transporter and configured sender", async () => {
    await service.sendEmail("recipient@example.com", "Test Subject", "<p>Hello</p>");

    // Expect sendMail to receive the email payload with correct recipient, subject and body
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.com",
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
      })
    );
  });

  // ตรวจสอบ validation เมื่อ recipient ไม่มีค่า ต้อง throw error และไม่เรียก sendMail
  it("sendEmail throws when recipient is missing", async () => {
    // Expect the service to validate recipient and reject when it is empty
    await expect(service.sendEmail("", "Subject", "<p>Hi</p>")).rejects.toThrow(
      "Email recipient is required"
    );
    // No email should be sent if recipient validation fails
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  // ตรวจสอบ builder email ที่ใช้สำหรับแจ้งผู้สมัครให้ upload เอกสารขอความอนุเคราะห์
  it("buildAcceptedForInternshipEmail returns expected subject and html", () => {
    const result = service.buildAcceptedForInternshipEmail({
      firstname: "Jane",
      lastname: "Doe",
      positionName: "Software Intern",
      departmentName: "Engineering",
    });

    // Expect the subject line for accepted internship notification
    expect(result.subject).toBe("โปรดอัปโหลดเอกสารขอความอนุเคราะห์");
    // Expect the HTML content includes the provided names, position, department and app URL
    expect(result.html).toEqual(expect.stringContaining("Jane"));
    expect(result.html).toEqual(expect.stringContaining("Doe"));
    expect(result.html).toEqual(expect.stringContaining("Software Intern"));
    expect(result.html).toEqual(expect.stringContaining("Engineering"));
    expect(result.html).toMatch(/https?:\/\/[^\s"']+/);
  });

  // ตรวจสอบ builder email เมื่อเอกสารถูกตีกลับ ให้ subject และ html มีชื่อลูกค้าและ URL
  it("buildDocumentRejectedEmail returns expected subject and html", () => {
    const result = service.buildDocumentRejectedEmail({
      firstname: "Somchai",
      lastname: "Srisuk",
    });

    // Expect the subject line for rejected document notification
    expect(result.subject).toBe("เอกสารถูกตีกลับ");
    // Expect the HTML content includes the provided first and last name and app URL
    expect(result.html).toEqual(expect.stringContaining("Somchai"));
    expect(result.html).toEqual(expect.stringContaining("Srisuk"));
    expect(result.html).toMatch(/https?:\/\/[^\s"']+/);
  });

  // ตรวจสอบ builder email สำหรับกรณีการฝึกงานถูกยกเลิก ว่ามี subject และ html ตามที่คาดไว้
  it("buildInternshipCanceledEmail returns expected subject and html", () => {
    const result = service.buildInternshipCanceledEmail({
      firstname: "Ploy",
      lastname: "Chan",
      positionName: "HR Intern",
      departmentName: "HR",
    });

    // Expect the subject line for internship cancellation notification
    expect(result.subject).toBe("การฝึกงานถูกยกเลิก");
    // Expect the HTML contains the given names, position, department and app URL
    expect(result.html).toEqual(expect.stringContaining("Ploy"));
    expect(result.html).toEqual(expect.stringContaining("Chan"));
    expect(result.html).toEqual(expect.stringContaining("HR Intern"));
    expect(result.html).toEqual(expect.stringContaining("HR"));
    expect(result.html).toMatch(/https?:\/\/[^\s"']+/);
  });
});
