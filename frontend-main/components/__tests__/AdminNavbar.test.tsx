import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// 1) Mock ของทุกอย่างที่ AdminNavbar "import" มาจากภายนอก
// ---------------------------------------------------------------------------

const pushMock = jest.fn();
const replaceMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/admin/applications"),
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("@/components/ui/Toast", () => ({
  __esModule: true,
  default: ({ message, isVisible, type, onClose }: any) =>
    isVisible ? (
      <div data-testid="toast" data-type={type}>
        {message}
        <button onClick={onClose}>close-toast</button>
      </div>
    ) : null,
}));

jest.mock("@/components/ui/ConfirmModal", () => ({
  __esModule: true,
  default: ({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel }: any) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        <p>{title}</p>
        <p>{message}</p>
        <button onClick={onConfirm}>{confirmText}</button>
        <button onClick={onCancel}>{cancelText}</button>
      </div>
    ) : null,
}));

jest.mock("@/components/ui/NotificationStatusIcon", () => ({
  __esModule: true,
  default: () => <span data-testid="notif-icon" />,
  detectNotificationTone: jest.fn(() => "info"),
}));

jest.mock("@/components/ui/VideoLoading", () => ({
  __esModule: true,
  default: ({ message }: any) => <div data-testid="video-loading">{message}</div>,
}));

jest.mock("@/services/api", () => ({
  authApi: {
    signOut: jest.fn(),
  },
  authStorage: {
    getUser: jest.fn(),
    clearAuth: jest.fn(),
  },
  userApi: {
    getUserProfile: jest.fn(),
  },
  notificationApi: {
    getMyNotifications: jest.fn(),
    markAllAsRead: jest.fn(),
    markAsRead: jest.fn(),
    deleteNotification: jest.fn(),
  },
}));

import AdminNavbar from "../ui/AdminNavbar"; // แก้ path ให้ตรงกับตำแหน่งไฟล์จริงของคุณ
import {
  authApi,
  authStorage,
  userApi,
  notificationApi,
} from "@/services/api";
import { usePathname } from "next/navigation";

// ---------------------------------------------------------------------------
// 2) ข้อมูลตัวอย่างที่ใช้ซ้ำหลาย test
// ---------------------------------------------------------------------------
const mockUser = {
  fname: "สมชาย",
  lname: "ใจดี",
  username: "somchai",
  email: "somchai@example.com",
  roleId: 2,
};

const mockNotifications = [
  {
    id: 1,
    title: "แจ้งเตือนที่ 1",
    message: "รายละเอียด 1",
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: "แจ้งเตือนที่ 2",
    message: "รายละเอียด 2",
    isRead: true,
    createdAt: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// 3) ตั้งค่าก่อนแต่ละ test
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ advanceTimers: true });

  (authStorage.getUser as jest.Mock).mockReturnValue(mockUser);
  (userApi.getUserProfile as jest.Mock).mockResolvedValue(mockUser);
  (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue(
    mockNotifications,
  );
  (notificationApi.markAllAsRead as jest.Mock).mockResolvedValue(undefined);
  (notificationApi.markAsRead as jest.Mock).mockResolvedValue(undefined);
  (notificationApi.deleteNotification as jest.Mock).mockResolvedValue(
    undefined,
  );
  (authApi.signOut as jest.Mock).mockResolvedValue(undefined);
  (usePathname as jest.Mock).mockReturnValue("/admin/applications");
});

afterEach(() => {
  jest.useRealTimers();
});

function setupUser() {
  return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
}

// ---------------------------------------------------------------------------
// 4) เริ่ม test จริง
// ---------------------------------------------------------------------------
describe("AdminNavbar", () => {
  it("แสดงโลโก้และลิงก์เมนูหลักครบถ้วน", async () => {
    render(<AdminNavbar />);

    expect(screen.getByAltText("PEA Internship Logo")).toBeInTheDocument();
    expect(screen.getByText("ลิสต์รายการสมัคร")).toBeInTheDocument();
    expect(screen.getByText("แดชบอร์ด")).toBeInTheDocument();
    expect(screen.getByText("คู่มือการใช้งาน")).toBeInTheDocument();

    await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());
  });

  it("ไฮไลต์ลิงก์ที่ตรงกับ path ปัจจุบันด้วยสี primary", async () => {
    (usePathname as jest.Mock).mockReturnValue("/admin/dashboard");
    render(<AdminNavbar />);

    const dashboardLink = screen.getByText("แดชบอร์ด");
    expect(dashboardLink.className).toContain("text-primary-600");

    const applicationsLink = screen.getByText("ลิสต์รายการสมัคร");
    expect(applicationsLink.className).toContain("text-gray-600");
  });

  it("โหลดโปรไฟล์ผู้ใช้จาก API แล้วแสดงชื่อ-อีเมลใน dropdown โปรไฟล์", async () => {
    const user = setupUser();
    render(<AdminNavbar />);

    await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

    const buttons = screen.getAllByRole("button");
    const profileButton = buttons[buttons.length - 1];
    await user.click(profileButton);

    expect(await screen.findByText("สมชาย ใจดี")).toBeInTheDocument();
    expect(screen.getByText("somchai@example.com")).toBeInTheDocument();
  });

  it("ถ้าดึงโปรไฟล์จาก API ไม่สำเร็จ จะ fallback ไปใช้ข้อมูลจาก authStorage", async () => {
    (userApi.getUserProfile as jest.Mock).mockRejectedValue(
      new Error("network error"),
    );
    render(<AdminNavbar />);

    await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());
    expect(screen.getByAltText("PEA Internship Logo")).toBeInTheDocument();
  });

  it("แสดงปุ่มสลับไป Owner เฉพาะเมื่อ roleId เป็น 1 เท่านั้น", async () => {
    (userApi.getUserProfile as jest.Mock).mockResolvedValue({
      ...mockUser,
      roleId: 1,
    });
    render(<AdminNavbar />);

    expect(await screen.findByText("Admin")).toBeInTheDocument();
  });

  it("ไม่แสดงปุ่มสลับไป Owner เมื่อ roleId ไม่ใช่ 1", async () => {
    render(<AdminNavbar />);

    await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("คลิกปุ่มสลับ role แล้วแสดง loading overlay จากนั้น router.push ไปหน้า owner", async () => {
    (userApi.getUserProfile as jest.Mock).mockResolvedValue({
      ...mockUser,
      roleId: 1,
    });
    const user = setupUser();
    render(<AdminNavbar />);

    const switchButton = await screen.findByText("Admin");
    await user.click(switchButton);

    expect(screen.getByTestId("video-loading")).toBeInTheDocument();

    jest.advanceTimersByTime(1000);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/owner/announcements"),
    );
  });

  it("ดึงรายการแจ้งเตือนตอนโหลดหน้า และแสดงจำนวนที่ยังไม่อ่านบนกระดิ่ง", async () => {
    render(<AdminNavbar />);

    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("ถ้าดึงรายการแจ้งเตือนไม่สำเร็จ จะไม่ทำให้หน้าพัง (log error เงียบๆ)", async () => {
    (notificationApi.getMyNotifications as jest.Mock).mockRejectedValue(
      new Error("fail"),
    );
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<AdminNavbar />);

    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to load notifications:",
      expect.any(Error),
    );
    // ไม่มี badge ตัวเลขใดๆ เพราะโหลดไม่สำเร็จ ไม่มีข้อมูลให้แสดง
    expect(screen.queryByText("1")).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("เปิด dropdown แจ้งเตือน แสดงรายการ และ mark-all-as-read เมื่อมีของยังไม่อ่าน", async () => {
    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = (await screen.findByText("1")).closest("button")!;
    await user.click(bellButton);

    expect(screen.getByText("การแจ้งเตือน")).toBeInTheDocument();
    expect(screen.getByText("แจ้งเตือนที่ 1")).toBeInTheDocument();
    expect(screen.getByText("แจ้งเตือนที่ 2")).toBeInTheDocument();

    await waitFor(() =>
      expect(notificationApi.markAllAsRead).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(screen.queryByText("1")).not.toBeInTheDocument(),
    );
  });

  it("ถ้า markAsRead รายการเดียวล้มเหลว จะไม่ throw error (log เงียบๆ แล้วยังพาไปหน้า applications)", async () => {
    // บังคับให้ markAllAsRead ล้มเหลวก่อน เพื่อรักษาสถานะ isRead:false ของรายการไว้แน่นอน
    // (กันไม่ให้แข่งกับ mark-all-as-read จนรายการกลายเป็นอ่านแล้วก่อนที่จะคลิก)
    (notificationApi.markAllAsRead as jest.Mock).mockRejectedValue(
      new Error("mark all failed"),
    );
    (notificationApi.markAsRead as jest.Mock).mockRejectedValue(
      new Error("fail"),
    );
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = (await screen.findByText("1")).closest("button")!;
    await user.click(bellButton);

    // รอให้ mark-all-as-read ล้มเหลวเสร็จสมบูรณ์ก่อน เพื่อการันตีว่า isRead ยังเป็น false อยู่แน่นอน
    await waitFor(() =>
      expect(notificationApi.markAllAsRead).toHaveBeenCalledTimes(1),
    );

    const item = await screen.findByText("แจ้งเตือนที่ 1");
    await user.click(item);

    await waitFor(() =>
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to mark as read:",
        expect.any(Error),
      ),
    );
    expect(pushMock).toHaveBeenCalledWith("/admin/applications");

    consoleSpy.mockRestore();
  });

  it("กดปุ่ม X ที่รายการแจ้งเตือน จะเปิด modal ยืนยันก่อนลบ แล้วลบเมื่อกดยืนยัน", async () => {
    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = (await screen.findByText("1")).closest("button")!;
    await user.click(bellButton);

    const deleteButtons = screen.getAllByLabelText("ลบการแจ้งเตือน");
    await user.click(deleteButtons[0]);

    const modal = screen.getByTestId("confirm-modal");
    expect(within(modal).getByText("ยืนยันการลบการแจ้งเตือน")).toBeInTheDocument();

    await user.click(within(modal).getByText("ลบ"));

    expect(await screen.findByTestId("toast")).toHaveTextContent(
      "ลบการแจ้งเตือนสำเร็จ",
    );
    expect(notificationApi.deleteNotification).toHaveBeenCalledWith(1);
  });

  it("ถ้าลบรายการเดียวล้มเหลว จะแจ้งเตือนว่าลบไม่สำเร็จ", async () => {
    (notificationApi.deleteNotification as jest.Mock).mockRejectedValue(
      new Error("fail"),
    );

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = (await screen.findByText("1")).closest("button")!;
    await user.click(bellButton);

    const deleteButtons = screen.getAllByLabelText("ลบการแจ้งเตือน");
    await user.click(deleteButtons[0]);
    await user.click(
      within(screen.getByTestId("confirm-modal")).getByText("ลบ"),
    );

    expect(await screen.findByTestId("toast")).toHaveTextContent(
      "ลบการแจ้งเตือนไม่สำเร็จ",
    );
  });

  it("กด 'ลบทั้งหมด' แล้วยืนยัน จะลบการแจ้งเตือนทุกรายการ", async () => {
    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = (await screen.findByText("1")).closest("button")!;
    await user.click(bellButton);

    await user.click(screen.getByText("ลบทั้งหมด"));
    const modal = screen.getByTestId("confirm-modal");
    expect(within(modal).getByText("ยืนยันการลบทั้งหมด")).toBeInTheDocument();

    await user.click(within(modal).getByText("Clear all"));

    expect(await screen.findByTestId("toast")).toHaveTextContent(
      "ลบการแจ้งเตือนทั้งหมดสำเร็จ",
    );
    expect(notificationApi.deleteNotification).toHaveBeenCalledTimes(2);
  });

  it("ถ้าลบทั้งหมดบางรายการล้มเหลว จะแจ้งเตือนแบบ 'บางส่วนสำเร็จ'", async () => {
    (notificationApi.deleteNotification as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("fail"));

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = (await screen.findByText("1")).closest("button")!;
    await user.click(bellButton);
    await user.click(screen.getByText("ลบทั้งหมด"));
    await user.click(
      within(screen.getByTestId("confirm-modal")).getByText("Clear all"),
    );

    expect(await screen.findByTestId("toast")).toHaveTextContent(
      "ลบบางรายการสำเร็จ แต่บางรายการไม่สำเร็จ",
    );
  });

  it("ถ้าลบทั้งหมดล้มเหลวทุกรายการ จะแจ้งเตือนว่าลบทั้งหมดไม่สำเร็จ", async () => {
    (notificationApi.deleteNotification as jest.Mock).mockRejectedValue(
      new Error("fail"),
    );

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = (await screen.findByText("1")).closest("button")!;
    await user.click(bellButton);
    await user.click(screen.getByText("ลบทั้งหมด"));
    await user.click(
      within(screen.getByTestId("confirm-modal")).getByText("Clear all"),
    );

    expect(await screen.findByTestId("toast")).toHaveTextContent(
      "ลบการแจ้งเตือนทั้งหมดไม่สำเร็จ",
    );
  });

  it("กดออกจากระบบ: เรียก signOut, เคลียร์ auth, แล้ว redirect ไปหน้าแรก", async () => {
    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

    const buttons = screen.getAllByRole("button");
    const profileButton = buttons[buttons.length - 1];
    await user.click(profileButton);

    await user.click(screen.getByText("ออกจากระบบ"));

    await waitFor(() => expect(authApi.signOut).toHaveBeenCalledTimes(1));
    expect(authStorage.clearAuth).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/");
  });

  it("แม้ signOut API จะ error ก็ยังต้องเคลียร์ auth และ redirect เสมอ (finally block)", async () => {
    (authApi.signOut as jest.Mock).mockRejectedValue(new Error("network"));
    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);
    await user.click(screen.getByText("ออกจากระบบ"));

    await waitFor(() => expect(authStorage.clearAuth).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith("/");
  });

  it("โพลรายการแจ้งเตือนซ้ำทุก 30 วินาที", async () => {
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalledTimes(1),
    );

    jest.advanceTimersByTime(30000);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalledTimes(2),
    );

    jest.advanceTimersByTime(30000);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalledTimes(3),
    );
  });

  it("แสดงเวลาแบบสัมพัทธ์ (relativeTime) ถูกต้องครบทุกช่วงเวลา (นาที/ชั่วโมง/วัน/เดือน)", async () => {
    const now = Date.now();
    // หมายเหตุ: ตั้งชื่อ title ให้ไม่ซ้ำกับข้อความที่ relativeTime คำนวณออกมาเอง
    // (เช่นห้ามตั้ง title ว่า "เมื่อสักครู่" เพราะจะไปชนกับข้อความเวลาจริงที่แสดงด้านล่าง)
    const timeVariedNotifications = [
      {
        id: 101,
        title: "แจ้งเตือน A",
        message: "ข้อความ",
        isRead: true,
        createdAt: new Date(now - 30 * 1000).toISOString(), // diffMin < 1
      },
      {
        id: 102,
        title: "แจ้งเตือน B",
        message: "ข้อความ",
        isRead: true,
        createdAt: new Date(now - 5 * 60 * 1000).toISOString(), // 5 นาที
      },
      {
        id: 103,
        title: "แจ้งเตือน C",
        message: "ข้อความ",
        isRead: true,
        createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3 ชั่วโมง
      },
      {
        id: 104,
        title: "แจ้งเตือน D",
        message: "ข้อความ",
        isRead: true,
        createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 วัน
      },
      {
        id: 105,
        title: "แจ้งเตือน E",
        message: "ข้อความ",
        isRead: true,
        createdAt: new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString(), // ~3 เดือน
      },
    ];
    (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue(
      timeVariedNotifications,
    );

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    // ทุกรายการ isRead:true อยู่แล้ว จึงไม่มี badge ตัวเลขบนกระดิ่ง ต้องหาไอคอนกระดิ่งด้วยลำดับปุ่มแทน
    const bellButton = screen.getAllByRole("button")[0];
    await user.click(bellButton);

    expect(await screen.findByText("เมื่อสักครู่")).toBeInTheDocument();
    expect(screen.getByText("5 นาทีที่แล้ว")).toBeInTheDocument();
    expect(screen.getByText("3 ชั่วโมงที่แล้ว")).toBeInTheDocument();
    expect(screen.getByText("5 วันที่แล้ว")).toBeInTheDocument();
    expect(screen.getByText("3 เดือนที่แล้ว")).toBeInTheDocument();
  });

  it("ไม่อัปเดตชื่อ/อีเมล เมื่อ getUserProfile คืนค่า falsy (null)", async () => {
    (authStorage.getUser as jest.Mock).mockReturnValue({
      fname: "เริ่มต้น",
      lname: "ค่า",
      username: "initial",
      email: "initial@example.com",
      roleId: 5,
    });
    (userApi.getUserProfile as jest.Mock).mockResolvedValue(null);

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);

    expect(await screen.findByText("เริ่มต้น ค่า")).toBeInTheDocument();
  });

  it("ไม่ throw error เมื่อ getUserProfile ล้มเหลว และ authStorage.getUser() คืนค่า null พร้อมกัน", async () => {
    (userApi.getUserProfile as jest.Mock).mockRejectedValue(
      new Error("network"),
    );
    (authStorage.getUser as jest.Mock).mockReturnValue(null);

    render(<AdminNavbar />);

    await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());
    expect(screen.getByAltText("PEA Internship Logo")).toBeInTheDocument();
  });

  it("ลบการแจ้งเตือนที่ 'อ่านแล้ว' (isRead: true) ได้ตามปกติ", async () => {
    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = (await screen.findByText("1")).closest("button")!;
    await user.click(bellButton);

    const deleteButtons = screen.getAllByLabelText("ลบการแจ้งเตือน");
    await user.click(deleteButtons[1]); // id=2, isRead: true
    await user.click(
      within(screen.getByTestId("confirm-modal")).getByText("ลบ"),
    );

    expect(await screen.findByTestId("toast")).toHaveTextContent(
      "ลบการแจ้งเตือนสำเร็จ",
    );
    expect(notificationApi.deleteNotification).toHaveBeenCalledWith(2);
    expect(screen.queryByText("แจ้งเตือนที่ 2")).not.toBeInTheDocument();
  });

  it("คลิกกระดิ่งเมื่อไม่มีแจ้งเตือนค้างอ่านเลย จะไม่เรียก markAllAsRead", async () => {
    (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue(
      mockNotifications.map((n) => ({ ...n, isRead: true })),
    );

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = screen.getAllByRole("button")[0];
    await user.click(bellButton);

    expect(notificationApi.markAllAsRead).not.toHaveBeenCalled();
  });

  it("ถ้า mark-all-as-read ล้มเหลว รายการยังเป็นสถานะยังไม่อ่าน คลิกรายการนั้นจะเรียก markAsRead เฉพาะตัว", async () => {
    (notificationApi.markAllAsRead as jest.Mock).mockRejectedValue(
      new Error("fail"),
    );
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = (await screen.findByText("1")).closest("button")!;
    await user.click(bellButton);

    await waitFor(() =>
      expect(notificationApi.markAllAsRead).toHaveBeenCalledTimes(1),
    );

    const item = await screen.findByText("แจ้งเตือนที่ 1");
    await user.click(item);

    await waitFor(() =>
      expect(notificationApi.markAsRead).toHaveBeenCalledWith(1, true),
    );
    // ต้องรอให้ setUnreadCount((prev) => Math.max(0, prev - 1)) ถูก React
    // เรียกจริงและอัปเดต DOM เสร็จก่อน ไม่งั้น coverage ของฟังก์ชันข้างในจะไม่นับ
    // (แค่ "เรียก setUnreadCount" ไม่พอ ต้องรอผลลัพธ์ปรากฏบนจอจริงๆ)
    await waitFor(() =>
      expect(screen.queryByText("1")).not.toBeInTheDocument(),
    );
    expect(pushMock).toHaveBeenCalledWith("/admin/applications");

    consoleSpy.mockRestore();
  });

  it("คลิกรายการแจ้งเตือนที่ถูก mark ว่าอ่านแล้วสมบูรณ์ (isRead:true) จะไม่เรียก markAsRead ซ้ำอีก", async () => {
    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = (await screen.findByText("1")).closest("button")!;
    await user.click(bellButton);

    await waitFor(() =>
      expect(notificationApi.markAllAsRead).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(screen.queryByText("1")).not.toBeInTheDocument(),
    );

    const item = await screen.findByText("แจ้งเตือนที่ 1");
    await user.click(item);

    expect(notificationApi.markAsRead).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/admin/applications");
  });

  it("ลบการแจ้งเตือนที่ 'ยังไม่ได้อ่าน' จะลดตัวนับ unreadCount ลงหนึ่ง", async () => {
    (notificationApi.markAllAsRead as jest.Mock).mockRejectedValue(
      new Error("fail"),
    );
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = (await screen.findByText("1")).closest("button")!;
    await user.click(bellButton);
    await waitFor(() =>
      expect(notificationApi.markAllAsRead).toHaveBeenCalledTimes(1),
    );

    // เพราะ markAllAsRead ล้มเหลว รายการที่ 1 (id=1) ยังคงเป็น isRead:false เหมือนเดิม
    const deleteButtons = screen.getAllByLabelText("ลบการแจ้งเตือน");
    await user.click(deleteButtons[0]);
    await user.click(
      within(screen.getByTestId("confirm-modal")).getByText("ลบ"),
    );

    // ใช้ toast เป็นจุดซิงค์ (sync point) แทน waitFor(toHaveBeenCalledWith) เพราะ
    // toast กับ unreadCount ถูกอัปเดตพร้อมกันในสเตตเดียวกัน รอ toast ขึ้นเท่ากับรอ
    // state ทั้งหมดอัปเดตเสร็จเรียบร้อยแล้วจริง ๆ ก่อนเช็ค badge
    expect(await screen.findByTestId("toast")).toHaveTextContent(
      "ลบการแจ้งเตือนสำเร็จ",
    );
    expect(notificationApi.deleteNotification).toHaveBeenCalledWith(1);

    // unreadCount ต้องลดจาก 1 เหลือ 0 พอดี (มีแค่รายการเดียวที่ยังไม่อ่าน) badge จึงหายไป
    expect(screen.queryByText("1")).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("แสดงข้อความ 'ไม่มีการแจ้งเตือน' เมื่อรายการว่างเปล่า", async () => {
    (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([]);

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = screen.getAllByRole("button")[0];
    await user.click(bellButton);

    expect(await screen.findByText("ไม่มีการแจ้งเตือน")).toBeInTheDocument();
    // ปุ่ม "ลบทั้งหมด" ต้องไม่แสดงเลยเมื่อไม่มีรายการ
    expect(screen.queryByText("ลบทั้งหมด")).not.toBeInTheDocument();
  });

  it("กดปิด Toast (onClose) แล้ว Toast ต้องหายไปจากหน้าจอ", async () => {
    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = (await screen.findByText("1")).closest("button")!;
    await user.click(bellButton);

    const deleteButtons = screen.getAllByLabelText("ลบการแจ้งเตือน");
    await user.click(deleteButtons[0]);
    await user.click(
      within(screen.getByTestId("confirm-modal")).getByText("ลบ"),
    );

    const toast = await screen.findByTestId("toast");
    await user.click(within(toast).getByText("close-toast"));

    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
  });

  it("กด 'ยกเลิก' ใน ConfirmModal จะปิด modal โดยไม่ลบอะไรเลย", async () => {
    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() =>
      expect(notificationApi.getMyNotifications).toHaveBeenCalled(),
    );

    const bellButton = (await screen.findByText("1")).closest("button")!;
    await user.click(bellButton);

    const deleteButtons = screen.getAllByLabelText("ลบการแจ้งเตือน");
    await user.click(deleteButtons[0]);

    const modal = screen.getByTestId("confirm-modal");
    await user.click(within(modal).getByText("ยกเลิก"));

    expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
    expect(notificationApi.deleteNotification).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------
  // เทสเพิ่มเติมไล่ branch coverage ของบรรทัดสร้างชื่อ/อีเมลผู้ใช้ ซึ่งมีเงื่อนไข
  // ซ่อนอยู่หลายจุดในบรรทัดเดียว (fname/lname/username/email แต่ละตัวมี || fallback)
  // ---------------------------------------------------------------------

  it("ใช้ username แทน เมื่อ fname/lname ว่างเปล่าทั้งคู่ (จาก authStorage ตอน mount)", async () => {
    (authStorage.getUser as jest.Mock).mockReturnValue({
      fname: "",
      lname: "",
      username: "onlyusername",
      email: "",
      roleId: 2,
    });
    (userApi.getUserProfile as jest.Mock).mockRejectedValue(
      new Error("fail"),
    );

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);

    expect(await screen.findByText("onlyusername")).toBeInTheDocument();
  });

  it("ใช้ username แทน เมื่อ fname/lname ว่างเปล่าทั้งคู่ (จาก getUserProfile สำเร็จ)", async () => {
    (userApi.getUserProfile as jest.Mock).mockResolvedValue({
      fname: "",
      lname: "",
      username: "profileusername",
      email: "",
      roleId: 2,
    });

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);

    expect(await screen.findByText("profileusername")).toBeInTheDocument();
    // email ว่างเปล่า ต้อง fallback ไปที่ "-"
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("แสดง '-' เมื่อ fname/lname/username ว่างเปล่าหมดทุกตัว (จาก authStorage)", async () => {
    (authStorage.getUser as jest.Mock).mockReturnValue({
      fname: "",
      lname: "",
      username: "",
      email: "",
      roleId: 2,
    });
    (userApi.getUserProfile as jest.Mock).mockRejectedValue(
      new Error("fail"),
    );

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);

    // ทั้งชื่อและอีเมลว่างเปล่าพร้อมกัน จึงมีข้อความ "-" ปรากฏ 2 ที่ (ชื่อ + อีเมล)
    const dashes = await screen.findAllByText("-");
    expect(dashes.length).toBe(2);
  });

  it("แสดงข้อความ fallback 'แอดมิน' และอีเมล default เมื่อ displayName/displayEmail ว่างเปล่าตั้งแต่ต้น", async () => {
    (authStorage.getUser as jest.Mock).mockReturnValue(null);
    (userApi.getUserProfile as jest.Mock).mockRejectedValue(
      new Error("fail"),
    );

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);

    expect(await screen.findByText("แอดมิน")).toBeInTheDocument();
    expect(screen.getByText("admin@pea.co.th")).toBeInTheDocument();
  });

  it("แสดง '99+' บน badge เมื่อมีแจ้งเตือนที่ยังไม่อ่านมากกว่า 99 รายการ", async () => {
    const manyNotifications = Array.from({ length: 150 }, (_, i) => ({
      id: i + 1,
      title: `แจ้งเตือนที่ ${i + 1}`,
      message: "ข้อความ",
      isRead: false,
      createdAt: new Date().toISOString(),
    }));
    (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue(
      manyNotifications,
    );

    render(<AdminNavbar />);

    expect(await screen.findByText("99+")).toBeInTheDocument();
  });

  it("ไฮไลต์ลิงก์ 'คู่มือการใช้งาน' ด้วยสี primary เมื่ออยู่หน้า /guide/admin", async () => {
    (usePathname as jest.Mock).mockReturnValue("/guide/admin");
    render(<AdminNavbar />);

    const guideLink = screen.getByText("คู่มือการใช้งาน");
    expect(guideLink.className).toContain("text-primary-600");

    const applicationsLink = screen.getByText("ลิสต์รายการสมัคร");
    expect(applicationsLink.className).toContain("text-gray-600");
  });

  it("แสดง '-' เมื่อ fname/lname/username ว่างเปล่าหมดทุกตัว (จาก getUserProfile สำเร็จ)", async () => {
    (userApi.getUserProfile as jest.Mock).mockResolvedValue({
      fname: "",
      lname: "",
      username: "",
      email: "",
      roleId: 2,
    });

    const user = setupUser();
    render(<AdminNavbar />);
    await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);

    const dashes = await screen.findAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
