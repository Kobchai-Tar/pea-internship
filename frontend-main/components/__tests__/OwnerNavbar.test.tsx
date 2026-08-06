import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import OwnerNavbar from "../ui/OwnerNavbar";
import { usePathname, useRouter } from "next/navigation";
import { authApi, authStorage, userApi, notificationApi } from "@/services/api";

// --- Mocking Dependencies ---
jest.mock("next/navigation", () => ({
    usePathname: jest.fn(),
    useRouter: jest.fn(),
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

// Mock child components to simplify testing if needed, though testing them integrated is fine.
// We'll let them render normally unless they cause issues, but for VideoLoading we mock it to easily assert its presence.
jest.mock("@/components/ui/VideoLoading", () => {
    return function DummyVideoLoading({ message }: { message: string }) {
        return <div data-testid="video-loading">{message}</div>;
    };
});

describe("OwnerNavbar Component", () => {
    const mockPush = jest.fn();
    const mockReplace = jest.fn();

    const mockUser = {
        fname: "สมชาย",
        lname: "ใจดี",
        email: "somchai@example.com",
        roleId: 2, // เจ้าของสถานประกอบการทั่วไป
    };

    const mockAdminUser = {
        fname: "แอดมิน",
        lname: "ระบบ",
        email: "admin@example.com",
        roleId: 1, // แอดมิน (มีสิทธิ์สลับ Role)
    };

    const mockNotifications = [
        {
            id: 1,
            title: "ใบสมัครใหม่",
            message: "มีผู้สมัครใหม่เข้าสู่ระบบ",
            isRead: false,
            createdAt: new Date().toISOString(), // เมื่อสักครู่
        },
        {
            id: 2,
            title: "อัปเดตระบบ",
            message: "ระบบอัปเดตเสร็จสิ้น",
            isRead: true,
            createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 ชั่วโมงที่แล้ว
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers(); // เพื่อควบคุม setTimeout / setInterval ในคอมโพเนนต์

        (usePathname as jest.Mock).mockReturnValue("/owner/dashboard");
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            replace: mockReplace,
        });

        // Default API Mocks
        (authStorage.getUser as jest.Mock).mockReturnValue(mockUser);
        (userApi.getUserProfile as jest.Mock).mockResolvedValue(mockUser);
        (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue(
            mockNotifications
        );
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    describe("Initialization & Profile Loading", () => {
        // กรณี: เปิดหน้าเว็บมาครั้งแรก
        // คาดหวัง: ต้องเรียก API ดึงข้อมูล User Profile และ Notifications ทันที และแสดงชื่อผู้ใช้ถูกต้อง
        it("loads user profile and notifications on mount", async () => {
            render(<OwnerNavbar />);

            await waitFor(() => {
                expect(userApi.getUserProfile).toHaveBeenCalledTimes(1);
                expect(notificationApi.getMyNotifications).toHaveBeenCalledTimes(1);
            });

            // ทดสอบคลิกโปรไฟล์เพื่อดูว่าชื่อที่ดึงมาแสดงถูกต้องไหม
            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[2]); // คลิกปุ่ม Profile (ปุ่มที่ 3)

            expect(screen.getByText("สมชาย ใจดี")).toBeInTheDocument();
            expect(screen.getByText("somchai@example.com")).toBeInTheDocument();
        });

        // กรณี: API getMyNotifications พัง
        // คาดหวัง: ระบบไม่แครช และยังคงเรนเดอร์ Navbar ต่อไปได้
        it("handles getMyNotifications API failure gracefully", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockRejectedValueOnce(new Error("Network Error"));
            render(<OwnerNavbar />);

            await waitFor(() => {
                expect(notificationApi.getMyNotifications).toHaveBeenCalled();
            });

            // ยืนยันว่า Navbar ยังคงแสดงผลได้ (หาโลโก้เจอ)
            expect(screen.getByAltText("PEA Internship Logo")).toBeInTheDocument();
        });


        // กรณี: API getUserProfile พัง (เช่น network error)
        // คาดหวัง: ระบบต้อง Fallback ไปดึงข้อมูลจาก authStorage มาแสดงผลแทน
        it("falls back to authStorage if getUserProfile fails", async () => {
            (userApi.getUserProfile as jest.Mock).mockRejectedValue(new Error("API Error"));
            render(<OwnerNavbar />);

            await waitFor(() => {
                expect(authStorage.getUser).toHaveBeenCalled();
            });

            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[2]); // คลิกปุ่ม Profile (ปุ่มที่ 3)

            expect(await screen.findByText("สมชาย ใจดี")).toBeInTheDocument();

        });
    });

    describe("Help Menu (เมนูช่วยเหลือ)", () => {
        // กรณี: กดปุ่มช่วยเหลือ
        // คาดหวัง: Dropdown ต้องเปิดออกและแสดงเมนูย่อย FAQs กับ คู่มือการใช้งาน
        it("toggles the help dropdown", () => {
            render(<OwnerNavbar />);

            const helpButton = screen.getByText("ช่วยเหลือ");
            fireEvent.click(helpButton);

            expect(screen.getByText("FAQs")).toBeInTheDocument();
            expect(screen.getByText("คู่มือการใช้งาน")).toBeInTheDocument();
        });
    });

    describe("Role Switching (การสลับบทบาท)", () => {
        // กรณี: ผู้ใช้เป็น Admin (roleId = 1)
        // คาดหวัง: ต้องเห็นปุ่ม "Owner" สำหรับสลับ Role และเมื่อกดต้องขึ้น Loading ชั่วคราว 1 วิ แล้ว redirect
        it("allows admin users to switch role with a loading state", async () => {
            (userApi.getUserProfile as jest.Mock).mockResolvedValue(mockAdminUser);
            render(<OwnerNavbar />);

            await waitFor(() => {
                expect(screen.getByText("Owner")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText("Owner"));

            // ต้องแสดง VideoLoading
            expect(screen.getByTestId("video-loading")).toHaveTextContent("กำลังสลับบทบาท...");

            // ข้ามเวลาไป 1 วินาที (1000ms)
            act(() => {
                jest.advanceTimersByTime(1000);
            });

            expect(mockPush).toHaveBeenCalledWith("/admin/applications");
        });

        // กรณี: ผู้ใช้ทั่วไป (roleId != 1)
        // คาดหวัง: ต้องไม่เห็นปุ่มสลับ Role 
        it("hides the role switch button for non-admin users", async () => {
            render(<OwnerNavbar />);

            await waitFor(() => {
                expect(screen.queryByText("Owner")).not.toBeInTheDocument();
            });
        });
    });

    describe("Notifications (การแจ้งเตือน)", () => {
        // กรณี: กดปุ่มกระดิ่งแจ้งเตือนเมื่อมีรายการที่ยังไม่อ่าน
        // คาดหวัง: ต้องเปิด Dropdown และเรียก API markAllAsRead อัตโนมัติ พร้อมลบตัวเลข badge
        it("opens notifications and marks all as read if unreadCount > 0", async () => {
            render(<OwnerNavbar />);

            await waitFor(() => {
                // มี badge สีแดงขึ้นเลข 1 (เพราะข้อมูล mock มี isRead: false 1 รายการ)
                expect(screen.getByText("1")).toBeInTheDocument();
            });

            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[1]); // คลิกปุ่มกระดิ่ง

            // เปลี่ยนจาก getByText เป็น await findByText เพื่อรอให้ข้อความปรากฏ
            expect(await screen.findByText("ใบสมัครใหม่")).toBeInTheDocument();


            await waitFor(() => {
                expect(notificationApi.markAllAsRead).toHaveBeenCalledTimes(1);
            });
        });

        // กรณี: คลิกลิสต์การแจ้งเตือน 1 รายการ
        // คาดหวัง: ต้องเรียก API markAsRead ของรายการนั้น ปิด Dropdown และ Redirect ไปหน้าประกาศ
        it("marks single notification as read and redirects when clicked", async () => {
            render(<OwnerNavbar />);

            await waitFor(() => {
                expect(screen.queryByText("ใบสมัครใหม่")).not.toBeInTheDocument();
            });

            const buttons = screen.getAllByRole("button");
            const bellButton = buttons[1]; // ปุ่มที่ 2 ใน Navbar คือปุ่มกระดิ่ง
            fireEvent.click(bellButton);

            const notifItem = screen.getByText("ใบสมัครใหม่");
            fireEvent.click(notifItem);

            await waitFor(() => {
                expect(notificationApi.markAsRead).toHaveBeenCalledWith(1, true); // id=1
                expect(mockPush).toHaveBeenCalledWith("/owner/announcements");
            });
        });

        // กรณี: มีการ Polling ทุก 30 วินาที
        // คาดหวัง: ทุกๆ 30 วิ ต้องมีการยิง API getMyNotifications ซ้ำ
        it("polls for notifications every 30 seconds", async () => {
            render(<OwnerNavbar />);

            await waitFor(() => {
                expect(notificationApi.getMyNotifications).toHaveBeenCalledTimes(1);
            });

            act(() => {
                jest.advanceTimersByTime(30000);
            });

            expect(notificationApi.getMyNotifications).toHaveBeenCalledTimes(2);
        });
    });

    // กรณี: ไม่มีรายการแจ้งเตือนเลย
    // คาดหวัง: ต้องไม่แสดง Badge ตัวเลข และแสดงข้อความว่าไม่มีการแจ้งเตือน
    it("shows empty state when there are no notifications", async () => {
        (notificationApi.getMyNotifications as jest.Mock).mockResolvedValueOnce([]);
        render(<OwnerNavbar />);

        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[1]); // คลิกปุ่มกระดิ่ง

        // ปรับคำว่า "ไม่มีการแจ้งเตือน" ตามข้อความที่คุณเขียนไว้ในคอมโพเนนต์จริงๆ
        expect(await screen.findByText(/ไม่มี/i)).toBeInTheDocument();
    });

    // กรณี: คลิกลิสต์การแจ้งเตือนที่อ่านไปแล้ว (isRead: true)
    // คาดหวัง: ไม่ต้องเรียก API markAsRead ซ้ำ แต่ให้ Redirect ไปเลย
    it("redirects without calling markAsRead if notification is already read", async () => {
        render(<OwnerNavbar />);

        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[1]);

        // คลิกรายการที่ 2 ซึ่งจำลองไว้ว่า isRead: true ("อัปเดตระบบ")
        const readNotifItem = await screen.findByText("อัปเดตระบบ");
        fireEvent.click(readNotifItem);

        await waitFor(() => {
            expect(notificationApi.markAsRead).not.toHaveBeenCalledWith(2, true);
            expect(mockPush).toHaveBeenCalledWith("/owner/announcements");
        });
    });

    describe("Delete Notifications (การลบการแจ้งเตือน)", () => {
        // กรณี: กดปุ่ม X ลบการแจ้งเตือน 1 รายการ แล้วกดยืนยันใน Modal
        // คาดหวัง: ต้องเรียก API ลบ, แจ้งเตือนสำเร็จ (Toast), และรายการนั้นต้องหายไปจากหน้าจอ
        it("deletes a single notification when confirmed", async () => {
            render(<OwnerNavbar />);

            // เปิด dropdown
            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[1]); // คลิกปุ่มกระดิ่ง

            await waitFor(() => {
                expect(screen.getByText("ใบสมัครใหม่")).toBeInTheDocument();
            });

            // กดปุ่ม X ที่รายการแรก
            const deleteButtons = screen.getAllByLabelText("ลบการแจ้งเตือน");
            fireEvent.click(deleteButtons[0]);

            // ตรวจสอบว่า Modal ยืนยันขึ้นมา
            expect(screen.getByText("ยืนยันการลบการแจ้งเตือน")).toBeInTheDocument();

            // กดยืนยันการลบ
            fireEvent.click(screen.getByText("ลบ"));

            await waitFor(() => {
                expect(notificationApi.deleteNotification).toHaveBeenCalledWith(1);
            });
        });

        // กรณี: กดปุ่ม "ลบทั้งหมด" แล้วกดยืนยัน
        // คาดหวัง: ต้องวนลูปเรียก API ลบทุก ID และจัดการ state อย่างถูกต้อง
        it("clears all notifications when confirmed", async () => {
            render(<OwnerNavbar />);

            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[1]); // คลิกปุ่มกระดิ่ง


            await waitFor(() => {
                expect(screen.getByText("ลบทั้งหมด")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText("ลบทั้งหมด"));

            expect(screen.getByText("ยืนยันการลบทั้งหมด")).toBeInTheDocument();

            fireEvent.click(screen.getByText("Clear all"));

            await waitFor(() => {
                // เนื่องจาก mockNotifications มี 2 รายการ ต้องเรียก API 2 ครั้ง
                expect(notificationApi.deleteNotification).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe("Profile & Logout (โปรไฟล์และออกจากระบบ)", () => {
        // กรณี: เปิดเมนู Profile แล้วกด "ออกจากระบบ"
        // คาดหวัง: ต้องเรียก API signOut, ล้าง Storage, และ Redirect ไปหน้า "/"
        it("logs out the user correctly", async () => {
            render(<OwnerNavbar />);

            await waitFor(() => {
                expect(userApi.getUserProfile).toHaveBeenCalled();
            });

            const buttons = screen.getAllByRole("button");
            const profileButton = buttons[2]; // ปุ่มที่ 3 ใน Navbar คือปุ่มโปรไฟล์
            fireEvent.click(profileButton);

            const logoutButton = screen.getByText("ออกจากระบบ");
            fireEvent.click(logoutButton);

            await waitFor(() => {
                expect(authApi.signOut).toHaveBeenCalledTimes(1);
                expect(authStorage.clearAuth).toHaveBeenCalledTimes(1);
                expect(mockReplace).toHaveBeenCalledWith("/");
            });
        });
    });

    // กรณี: กดปุ่ม X เพื่อลบ แต่กด "ยกเลิก" ใน Modal
    // คาดหวัง: API deleteNotification ต้องไม่ถูกเรียก
    it("cancels deletion when cancel button is clicked", async () => {
        render(<OwnerNavbar />);

        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[1]); // คลิกปุ่มกระดิ่ง

        await waitFor(() => {
            expect(screen.getByText("ใบสมัครใหม่")).toBeInTheDocument();
        });

        // กดปุ่ม X
        const deleteButtons = screen.getAllByLabelText("ลบการแจ้งเตือน");
        fireEvent.click(deleteButtons[0]);

        // หาปุ่ม "ยกเลิก" ใน Modal แล้วคลิก (ถ้าในโค้ดคุณใช้คำอื่น ให้เปลี่ยนตามนั้นครับ เช่น Cancel)
        const cancelButton = screen.getByText("ยกเลิก");
        fireEvent.click(cancelButton);

        expect(notificationApi.deleteNotification).not.toHaveBeenCalled();
    });

    describe("Clicking Outside (การคลิกพื้นที่ว่าง)", () => {
        // กรณี: เปิด Dropdown (Help, Notification, Profile) ทิ้งไว้ แล้วคลิกพื้นหลัง
        // คาดหวัง: Dropdown เหล่านั้นต้องปิดตัวเองอัตโนมัติ
        it("closes dropdowns when clicking outside", async () => {
            render(<OwnerNavbar />);

            // เปิด Help
            fireEvent.click(screen.getByText("ช่วยเหลือ"));
            expect(screen.getByText("FAQs")).toBeInTheDocument();

            // จำลองการคลิกที่ document body (พื้นที่ว่าง)
            fireEvent.mouseDown(document.body);

            expect(screen.queryByText("FAQs")).not.toBeInTheDocument();
        });
    });
});
