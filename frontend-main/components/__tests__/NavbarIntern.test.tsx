import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import NavbarIntern from "../ui/NavbarIntern"; // Adjust the import path as necessary
import { usePathname, useRouter } from "next/navigation";
import {
    authApi,
    authStorage,
    favoriteApi,
    notificationApi,
    userApi,
    extractStudentProfile,
} from "@/services/api";

// Mock Next.js navigation (เหมือนไฟล์ทดสอบอื่นๆ)
jest.mock("next/navigation", () => ({
    usePathname: jest.fn(),
    useRouter: jest.fn(),
}));

// Mock ทุก API ที่ NavbarIntern เรียกใช้ ป้องกันไม่ให้ยิง network request จริง
jest.mock("@/services/api", () => ({
    authApi: { signOut: jest.fn() },
    authStorage: { clearAuth: jest.fn() },
    favoriteApi: { getFavorites: jest.fn() },
    notificationApi: {
        getMyNotifications: jest.fn(),
        markAllAsRead: jest.fn(),
        markAsRead: jest.fn(),
        deleteNotification: jest.fn(),
    },
    userApi: { getUserProfile: jest.fn() },
    extractStudentProfile: jest.fn(),
}));

// Mock component ลูกที่ NavbarIntern ใช้ ให้เป็นเวอร์ชันง่ายๆ ที่ควบคุมได้ในเทส
// เพื่อแยก (isolate) การทดสอบ NavbarIntern ออกจาก implementation จริงของ component เหล่านี้
jest.mock("@/components/ui/Toast", () => {
    return function MockToast({
        isVisible,
        message,
    }: {
        isVisible: boolean;
        message: string;
    }) {
        return isVisible ? <div data-testid="toast">{message}</div> : null;
    };
});

jest.mock("@/components/ui/ConfirmModal", () => {
    return function MockConfirmModal({
        isOpen,
        title,
        confirmText,
        cancelText,
        onConfirm,
        onCancel,
    }: {
        isOpen: boolean;
        title: string;
        confirmText: string;
        cancelText: string;
        onConfirm: () => void;
        onCancel: () => void;
    }) {
        if (!isOpen) return null;
        return (
            <div data-testid="confirm-modal">
                <p>{title}</p>
                <button onClick={onConfirm}>{confirmText}</button>
                <button onClick={onCancel}>{cancelText}</button>
            </div>
        );
    };
});

jest.mock("@/components/ui/NotificationStatusIcon", () => ({
    __esModule: true,
    default: () => <svg data-testid="notification-icon" />,
    detectNotificationTone: jest.fn(() => "info"),
}));

describe("NavbarIntern Component", () => {
    const mockPush = jest.fn();
    const mockReplace = jest.fn();

    // helper สร้าง mock notification แบบย่อ ลดโค้ดซ้ำ
    const makeNotification = (overrides = {}) => ({
        id: 1,
        title: "ผลการสมัครฝึกงาน",
        message: "การสมัครของคุณได้รับการอนุมัติ",
        createdAt: new Date().toISOString(),
        isRead: false,
        ...overrides,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        (usePathname as jest.Mock).mockReturnValue("/intern-home");
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            replace: mockReplace,
        });

        // ค่า default ที่ปลอดภัย ไม่ทำให้เทสอื่นพัง (แต่ละ test case override ได้ตามต้องการ)
        (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([]);
        (notificationApi.markAllAsRead as jest.Mock).mockResolvedValue(undefined);
        (notificationApi.markAsRead as jest.Mock).mockResolvedValue(undefined);
        (notificationApi.deleteNotification as jest.Mock).mockResolvedValue(undefined);
        (favoriteApi.getFavorites as jest.Mock).mockResolvedValue({ data: [] });
        (userApi.getUserProfile as jest.Mock).mockResolvedValue({ profile: {} });
        (extractStudentProfile as jest.Mock).mockReturnValue(null);
    });

    describe("Initial data loading", () => {
        // กรณี: component ถูก render ครั้งแรก (mount)
        // คาดหวัง: ต้องเรียก API โหลดข้อมูลแจ้งเตือน, จำนวนรายการโปรด, และสถานะการฝึกงาน ทันทีโดยไม่ต้องรอ action ใดๆ
        it("loads notifications, favorites count, and internship status on mount", async () => {
            render(<NavbarIntern />);

            await waitFor(() => {
                expect(notificationApi.getMyNotifications).toHaveBeenCalledTimes(1);
            });
            expect(favoriteApi.getFavorites).toHaveBeenCalledTimes(1);
            expect(userApi.getUserProfile).toHaveBeenCalledTimes(1);
        });

        // กรณี: เวลาผ่านไป 30 วินาทีหลัง mount (polling interval)
        // คาดหวัง: ต้องเรียก getMyNotifications ซ้ำอีกครั้งโดยอัตโนมัติ (ระบบ poll แจ้งเตือนใหม่เรื่อยๆ)
        it("polls for new notifications every 30 seconds", async () => {
            jest.useFakeTimers();
            render(<NavbarIntern />);

            await act(async () => {
                await Promise.resolve();
            });
            expect(notificationApi.getMyNotifications).toHaveBeenCalledTimes(1);

            await act(async () => {
                jest.advanceTimersByTime(30000);
                await Promise.resolve();
            });
            expect(notificationApi.getMyNotifications).toHaveBeenCalledTimes(2);

            jest.useRealTimers();
        });
    });

    describe("Favorites badge", () => {
        // กรณี: API รายการโปรดคืนค่ามากกว่า 0 รายการ
        // คาดหวัง: ต้องแสดงจุดสีแดง/badge บอกว่ามีรายการโปรดอยู่ (แสดงผ่านคลาส animate-pulse บน span)
        it("shows a badge dot next to 'รายการโปรด' when favoritesCount is greater than 0", async () => {
            (favoriteApi.getFavorites as jest.Mock).mockResolvedValue({
                data: [{ id: 1 }, { id: 2 }],
            });

            const { container } = render(<NavbarIntern />);

            await waitFor(() => {
                expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
            });
        });

        // กรณี: ส่ง prop favoritesCount เข้ามาตรงๆ (ใช้ตอนหน้าอื่นอยากอัปเดตแบบ real-time)
        // คาดหวัง: ค่าที่ได้จาก prop ต้อง override ค่าที่โหลดจาก API
        it("uses the favoritesCount prop to override the value loaded from the API", async () => {
            (favoriteApi.getFavorites as jest.Mock).mockResolvedValue({ data: [] });
            const { container } = render(<NavbarIntern favoritesCount={5} />);

            await waitFor(() => {
                expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
            });
        });
    });

    describe("iTT link visibility", () => {
        // กรณี: internshipStatus เป็น "AWAITING" (รอเริ่มฝึกงาน)
        // คาดหวัง: ต้องแสดงลิงก์ "iTT" ในเมนู
        it("shows the iTT link when internship status is AWAITING", async () => {
            (extractStudentProfile as jest.Mock).mockReturnValue({
                internshipStatus: "AWAITING",
            });
            render(<NavbarIntern />);

            expect(await screen.findByText("iTT")).toBeInTheDocument();
        });

        // กรณี: internshipStatus เป็น "ACTIVE" (กำลังฝึกงานอยู่)
        // คาดหวัง: ต้องแสดงลิงก์ "iTT" เช่นกัน
        it("shows the iTT link when internship status is ACTIVE", async () => {
            (extractStudentProfile as jest.Mock).mockReturnValue({
                internshipStatus: "ACTIVE",
            });
            render(<NavbarIntern />);

            expect(await screen.findByText("iTT")).toBeInTheDocument();
        });

        // กรณี: ไม่มีสถานะการฝึกงาน (ยังไม่ได้ตำแหน่ง หรือ API คืนค่า null)
        // คาดหวัง: ต้องไม่แสดงลิงก์ "iTT" เพื่อไม่ให้สับสน
        it("hides the iTT link when there is no internship status", async () => {
            render(<NavbarIntern />);

            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());
            expect(screen.queryByText("iTT")).not.toBeInTheDocument();
        });
    });

    describe("Desktop notification dropdown", () => {
        // กรณี: มีแจ้งเตือนที่ยังไม่ได้อ่าน 3 รายการ
        // คาดหวัง: กระดิ่งแจ้งเตือนต้องแสดงตัวเลข badge "3"
        // หมายเหตุ: component render กระดิ่งไว้ 2 ชุด (desktop + mobile) ซ่อน/โชว์ด้วย CSS class
        // (hidden md:block / md:hidden) แต่ jsdom ไม่ประมวลผล CSS จริง ทั้งสองอันเลย "มองเห็น" พร้อมกัน
        // จึงต้องใช้ findAllByText แทน findByText เพื่อรับได้ว่าจะเจอมากกว่า 1 element
        it("shows the unread count badge on the bell icon", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 1, isRead: false }),
                makeNotification({ id: 2, isRead: false }),
                makeNotification({ id: 3, isRead: false }),
            ]);
            render(<NavbarIntern />);

            const badges = await screen.findAllByText("3");
            expect(badges.length).toBeGreaterThan(0);
        });

        // กรณี: มีแจ้งเตือนที่ยังไม่อ่านเกิน 99 รายการ
        // คาดหวัง: badge ต้องแสดง "99+" แทนตัวเลขจริง เพื่อไม่ให้ล้นปุ่ม
        it("caps the unread badge at '99+' when there are more than 99 unread notifications", async () => {
            const many = Array.from({ length: 120 }, (_, i) =>
                makeNotification({ id: i + 1, isRead: false })
            );
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue(many);
            render(<NavbarIntern />);

            const badges = await screen.findAllByText("99+");
            expect(badges.length).toBeGreaterThan(0);
        });

        // กรณี: ผู้ใช้กดกระดิ่งแจ้งเตือน (desktop) ตอนที่ยังไม่มี panel เปิดอยู่
        // คาดหวัง: panel ต้องเปิดขึ้นมาและแสดงข้อความ "ไม่มีการแจ้งเตือน" เมื่อไม่มีรายการเลย
        it("opens the notification dropdown and shows the empty state when there are no notifications", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            // ปุ่มกระดิ่งแจ้งเตือนฝั่ง desktop คือปุ่มลำดับที่ 2 ใน DOM (index 1)
            // เพราะปุ่ม "ช่วยเหลือ" ถูก render มาก่อนหน้ามันในโค้ดจริง: [ช่วยเหลือ, กระดิ่ง desktop, ...]
            const bellButtons = screen.getAllByRole("button");
            fireEvent.click(bellButtons[1]);

            expect(await screen.findByText("ไม่มีการแจ้งเตือน")).toBeInTheDocument();
        });

        // กรณี: มีแจ้งเตือนที่ยังไม่อ่านอยู่ แล้วผู้ใช้เปิด panel แจ้งเตือน
        // คาดหวัง: ต้องเรียก markAllAsRead อัตโนมัติทันทีที่เปิด panel (ระบบอ่านให้ทั้งหมดเมื่อผู้ใช้เห็นแล้ว)
        it("marks all notifications as read when opening the panel with unread items", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 1, isRead: false }),
            ]);
            render(<NavbarIntern />);
            await screen.findAllByText("1"); // รอ unread badge ปรากฏก่อน (มี 2 ชุด desktop+mobile)

            const bellButtons = screen.getAllByRole("button");
            fireEvent.click(bellButtons[1]);

            await waitFor(() => {
                expect(notificationApi.markAllAsRead).toHaveBeenCalledTimes(1);
            });
        });

        // กรณี: มีแจ้งเตือน 1 รายการที่หัวข้อเป็น "การฝึกงานถูกยกเลิก" แล้วผู้ใช้คลิกที่รายการนั้น
        // คาดหวัง: ต้องนำทางไปหน้า "/application-history" (ไม่ใช่หน้า status ปกติ)
        it("navigates to /application-history when clicking a cancellation notification", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({
                    id: 1,
                    title: "การฝึกงานถูกยกเลิก",
                    message: "รายละเอียดการยกเลิก",
                }),
            ]);
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[1]);

            const notificationText = await screen.findByText("การฝึกงานถูกยกเลิก");
            fireEvent.click(notificationText);

            expect(mockPush).toHaveBeenCalledWith("/application-history");
        });

        // กรณี: แจ้งเตือนทั่วไปที่ไม่ใช่กรณีถูกยกเลิก แล้วผู้ใช้คลิกที่รายการ
        // คาดหวัง: ต้องนำทางไปหน้า "/application-status" (หน้าติดตามสถานะปกติ) และ mark เป็นอ่านแล้ว
        it("navigates to /application-status and marks it as read for a normal notification", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 7, title: "ผลการสมัครฝึกงาน", message: "อัปเดตสถานะ" }),
            ]);
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[1]);

            const notificationText = await screen.findByText("ผลการสมัครฝึกงาน");
            fireEvent.click(notificationText);

            expect(mockPush).toHaveBeenCalledWith("/application-status");
            await waitFor(() => {
                expect(notificationApi.markAsRead).toHaveBeenCalledWith(7, true);
            });
        });
    });

    describe("Deleting notifications", () => {
        // กรณี: ผู้ใช้กดปุ่ม X บนแจ้งเตือนรายการหนึ่ง แล้วกดยืนยันใน modal
        // คาดหวัง: ต้องเรียก API ลบแจ้งเตือนด้วย id ที่ถูกต้อง และแสดง Toast ข้อความ "ลบการแจ้งเตือนสำเร็จ"
        it("deletes a single notification after confirming, and shows a success toast", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 42 }),
            ]);
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[1]);

            const deleteBtn = (await screen.findAllByLabelText("ลบการแจ้งเตือน"))[0];
            fireEvent.click(deleteBtn);

            // Modal ยืนยันต้องเปิดขึ้นมาก่อน
            expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();

            fireEvent.click(screen.getByText("ลบ"));

            await waitFor(() => {
                expect(notificationApi.deleteNotification).toHaveBeenCalledWith(42);
            });
            expect(await screen.findByTestId("toast")).toHaveTextContent(
                "ลบการแจ้งเตือนสำเร็จ"
            );
        });

        // กรณี: ผู้ใช้กดปุ่ม X แล้วกดยกเลิกใน modal (ไม่ยืนยัน)
        // คาดหวัง: ต้องไม่เรียก API ลบ และ modal ต้องปิดไป
        it("does not delete the notification when the confirm modal is cancelled", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 42 }),
            ]);
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[1]);

            const deleteBtn = (await screen.findAllByLabelText("ลบการแจ้งเตือน"))[0];
            fireEvent.click(deleteBtn);
            fireEvent.click(screen.getByText("ยกเลิก"));

            expect(notificationApi.deleteNotification).not.toHaveBeenCalled();
            expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
        });

        // กรณี: มีแจ้งเตือนอยู่ แล้วผู้ใช้กด "ลบทั้งหมด" แล้วยืนยัน
        // คาดหวัง: ต้องเรียก deleteNotification ครบทุก id และแสดง toast ข้อความ "ลบการแจ้งเตือนทั้งหมดสำเร็จ"
        it("clears all notifications after confirming 'ลบทั้งหมด'", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 1 }),
                makeNotification({ id: 2 }),
            ]);
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[1]);

            fireEvent.click(await screen.findByText("ลบทั้งหมด"));

            // ปุ่มยืนยันใน mock ConfirmModal ใช้ confirmText เดียวกัน ("ลบทั้งหมด")
            // จึง query เฉพาะภายใน confirm-modal เพื่อไม่ให้ชนกับปุ่ม trigger เดิม
            const confirmModal = screen.getByTestId("confirm-modal");
            fireEvent.click(within(confirmModal).getByText("ลบทั้งหมด"));

            await waitFor(() => {
                expect(notificationApi.deleteNotification).toHaveBeenCalledWith(1);
                expect(notificationApi.deleteNotification).toHaveBeenCalledWith(2);
            });
            expect(await screen.findByTestId("toast")).toHaveTextContent(
                "ลบการแจ้งเตือนทั้งหมดสำเร็จ"
            );
        });
    });

    describe("Profile dropdown & logout (desktop)", () => {
        // ปุ่มโปรไฟล์ desktop คือปุ่มที่ไม่มีคลาส "md:hidden" (ตัวที่ถูกซ่อนบนมือถือ) และอยู่ลำดับสุดท้าย
        // ในกลุ่มนั้น เพราะถูก render หลังปุ่มช่วยเหลือ/แจ้งเตือน desktop แต่ก่อนปุ่มแฮมเบอร์เกอร์ (ซึ่งมี md:hidden)
        const openProfileDropdown = () => {
            const profileButtons = screen
                .getAllByRole("button")
                .filter((btn) => !btn.className.includes("md:hidden"));
            fireEvent.click(profileButtons[profileButtons.length - 1]);
        };

        // กรณี: ผู้ใช้กดปุ่มโปรไฟล์ (desktop)
        // คาดหวัง: dropdown ต้องเปิดขึ้นมาแสดงเมนู "ออกจากระบบ"
        it("opens the profile dropdown when the profile icon is clicked", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            openProfileDropdown();

            expect(await screen.findByText("ออกจากระบบ")).toBeInTheDocument();
        });

        // กรณี: เปิด dropdown แล้วกด "ออกจากระบบ"
        // คาดหวัง: ต้องเรียก authApi.signOut, ล้างข้อมูล auth ด้วย authStorage.clearAuth,
        //           แล้ว redirect ไปหน้าแรกด้วย router.replace("/") (ใช้ replace ไม่ใช่ push เพื่อกันกดย้อนกลับ)
        it("calls signOut, clears auth storage, and redirects to '/' on logout", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            openProfileDropdown();
            const logoutText = await screen.findByText("ออกจากระบบ");
            fireEvent.click(logoutText.closest("button")!);

            await waitFor(() => {
                expect(authApi.signOut).toHaveBeenCalledTimes(1);
            });
            expect(authStorage.clearAuth).toHaveBeenCalledTimes(1);
            expect(mockReplace).toHaveBeenCalledWith("/");
        });

        // กรณี: authApi.signOut ล้มเหลว (เช่น network error ตอนแจ้ง server ว่า logout)
        // คาดหวัง: ต้อง fallback ไปล้าง auth storage และ redirect เหมือนเดิม ไม่ปล่อยให้ผู้ใช้ค้างอยู่หน้าเดิม
        it("still clears auth storage and redirects even if the signOut API call fails", async () => {
            (authApi.signOut as jest.Mock).mockRejectedValue(new Error("network error"));
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            openProfileDropdown();
            const logoutText = await screen.findByText("ออกจากระบบ");
            fireEvent.click(logoutText.closest("button")!);

            await waitFor(() => {
                expect(authStorage.clearAuth).toHaveBeenCalledTimes(1);
            });
            expect(mockReplace).toHaveBeenCalledWith("/");
        });

        // กรณี: dropdown เปิดอยู่ เช็คว่าแต่ละลิงก์เมนูมี href ไปหน้าที่ถูกต้อง
        // คาดหวัง: "ข้อมูลผู้สมัคร" -> /intern-profile, "ประวัติการสมัคร" -> /application-history,
        //           "ติดตามสถานะการสมัคร" -> /application-status
        it("renders the correct href for each menu link in the desktop dropdown", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            openProfileDropdown();

            expect(await screen.findByText("ข้อมูลผู้สมัคร")).toBeInTheDocument();
            expect(screen.getByText("ข้อมูลผู้สมัคร").closest("a")).toHaveAttribute(
                "href",
                "/intern-profile"
            );
            expect(screen.getByText("ประวัติการสมัคร").closest("a")).toHaveAttribute(
                "href",
                "/application-history"
            );
            expect(screen.getByText("ติดตามสถานะการสมัคร").closest("a")).toHaveAttribute(
                "href",
                "/application-status"
            );
        });
    });

    describe("Help dropdown", () => {
        // กรณี: ผู้ใช้กดเมนู "ช่วยเหลือ"
        // คาดหวัง: ต้องแสดงลิงก์ย่อย "คู่มือการใช้งาน" และ "FAQs"
        it("opens the help dropdown showing 'คู่มือการใช้งาน' and 'FAQs'", () => {
            render(<NavbarIntern />);

            fireEvent.click(screen.getByText("ช่วยเหลือ"));

            expect(screen.getByText("คู่มือการใช้งาน")).toBeInTheDocument();
            expect(screen.getByText("FAQs")).toBeInTheDocument();
        });
    });

    describe("Mobile hamburger menu", () => {
        // กรณี: ผู้ใช้กดปุ่มแฮมเบอร์เกอร์ (มุมขวาบนฝั่งมือถือ)
        // คาดหวัง: ต้อง render sidebar เมนูฝั่งมือถือ พร้อมลิงก์ "ตำแหน่งฝึกงาน"
        it("opens the mobile sidebar menu when the hamburger icon is clicked", () => {
            render(<NavbarIntern />);

            fireEvent.click(screen.getByLabelText("Open menu"));

            // ข้อความ "ตำแหน่งฝึกงาน" ปรากฏทั้งใน desktop nav และ mobile sidebar เมื่อเปิดแล้ว
            expect(screen.getAllByText("ตำแหน่งฝึกงาน").length).toBeGreaterThan(1);
        });

        // กรณี: sidebar มือถือเปิดอยู่ แล้วผู้ใช้กดปุ่มปิด (X)
        // คาดหวัง: sidebar ต้องปิดลง กลับเหลือ "ตำแหน่งฝึกงาน" แค่จุดเดียว (desktop nav)
        it("closes the mobile sidebar menu when the close button is clicked", () => {
            render(<NavbarIntern />);

            fireEvent.click(screen.getByLabelText("Open menu"));
            fireEvent.click(screen.getByLabelText("Close menu"));

            expect(screen.getAllByText("ตำแหน่งฝึกงาน").length).toBe(1);
        });
    });

    describe("Mobile notification screen (เวอร์ชันเต็มจอบนมือถือ)", () => {
        // ปุ่มกระดิ่งแจ้งเตือนฝั่ง mobile คือปุ่มลำดับที่ 3 ใน DOM (index 2)
        // ลำดับเต็ม: [ช่วยเหลือ(0), กระดิ่ง desktop(1), กระดิ่ง mobile(2), โปรไฟล์ mobile(3), โปรไฟล์ desktop(4), แฮมเบอร์เกอร์(5)]
        const openMobileNotifications = async () => {
            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[2]);
        };

        // กรณี: ผู้ใช้กดกระดิ่งแจ้งเตือนฝั่งมือถือ
        // คาดหวัง: ต้องเปิดหน้าจอเต็มแสดงรายการแจ้งเตือน (คนละ state กับ dropdown ฝั่ง desktop)
        it("opens the mobile notification full-screen panel and shows notifications", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 10, title: "ผลการสมัครฝึกงาน", message: "ข้อความทดสอบมือถือ" }),
            ]);
            render(<NavbarIntern />);

            await openMobileNotifications();

            expect(await screen.findByText("ข้อความทดสอบมือถือ")).toBeInTheDocument();
        });

        // กรณี: ไม่มีแจ้งเตือนเลย เปิดหน้าจอมือถือขึ้นมา
        // คาดหวัง: ต้องแสดง "ไม่มีการแจ้งเตือน" และไม่มีปุ่ม "ลบทั้งหมด" ให้กด (เพราะไม่มีอะไรให้ลบ)
        it("shows the empty state and hides the clear-all button when there are no notifications", async () => {
            render(<NavbarIntern />);

            await openMobileNotifications();

            expect(await screen.findByText("ไม่มีการแจ้งเตือน")).toBeInTheDocument();
            expect(screen.queryByText("ลบทั้งหมด")).not.toBeInTheDocument();
        });

        // กรณี: คลิกที่รายการแจ้งเตือนในหน้าจอมือถือ
        // คาดหวัง: ต้อง navigate ไปหน้าที่ถูกต้องเหมือนฝั่ง desktop
        it("navigates when a notification item is clicked from the mobile screen", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 11, title: "ผลการสมัครฝึกงาน", message: "แจ้งเตือนมือถือ" }),
            ]);
            render(<NavbarIntern />);

            await openMobileNotifications();
            fireEvent.click(await screen.findByText("แจ้งเตือนมือถือ"));

            expect(mockPush).toHaveBeenCalledWith("/application-status");
        });

        // กรณี: กดปุ่ม X ลบแจ้งเตือนรายการเดียวจากหน้าจอมือถือ แล้วยืนยัน
        // คาดหวัง: ต้องเรียก API ลบด้วย id ที่ถูกต้อง เหมือนฝั่ง desktop
        it("deletes a notification from the mobile screen after confirming", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 12 }),
            ]);
            render(<NavbarIntern />);

            await openMobileNotifications();
            const deleteBtn = (await screen.findAllByLabelText("ลบการแจ้งเตือน"))[0];
            fireEvent.click(deleteBtn);
            fireEvent.click(screen.getByText("ลบ"));

            await waitFor(() => {
                expect(notificationApi.deleteNotification).toHaveBeenCalledWith(12);
            });
        });
    });

    describe("Mobile profile screen (เวอร์ชันเต็มจอบนมือถือ)", () => {
        // ปุ่มโปรไฟล์ฝั่ง mobile คือปุ่มลำดับที่ 4 ใน DOM (index 3) ตามลำดับเดียวกับที่อธิบายไว้ด้านบน
        const openMobileProfile = async () => {
            const profileButtons = await screen.findAllByRole("button");
            fireEvent.click(profileButtons[3]);
        };

        // กรณี: ผู้ใช้กดไอคอนโปรไฟล์ฝั่งมือถือ
        // คาดหวัง: ต้องเปิดหน้าจอเต็มแสดงเมนู "ข้อมูลผู้สมัคร", "ประวัติการสมัคร", "ติดตามสถานะการสมัคร"
        it("opens the mobile profile full-screen panel showing menu links", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            await openMobileProfile();

            expect(await screen.findByText("ข้อมูลผู้สมัคร")).toBeInTheDocument();
            expect(screen.getByText("ประวัติการสมัคร")).toBeInTheDocument();
            expect(screen.getByText("ติดตามสถานะการสมัคร")).toBeInTheDocument();
        });

        // กรณี: ผู้ใช้กด "ออกจากระบบ" จากหน้าจอโปรไฟล์มือถือ (คนละปุ่มกับ desktop dropdown)
        // คาดหวัง: ต้อง logout ได้เหมือนกันทุกประการ (เรียก API, ล้าง storage, redirect)
        it("logs out from the mobile profile screen", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            await openMobileProfile();
            fireEvent.click(await screen.findByText("ออกจากระบบ"));

            await waitFor(() => {
                expect(authApi.signOut).toHaveBeenCalledTimes(1);
            });
            expect(authStorage.clearAuth).toHaveBeenCalledTimes(1);
            expect(mockReplace).toHaveBeenCalledWith("/");
        });

        // กรณี: หน้าจอโปรไฟล์มือถือเปิดอยู่ เช็คลิงก์ "แจ้งปัญหาการใช้งาน"
        // คาดหวัง: ต้องเป็นลิงก์ภายนอกไป Google Form เปิดแท็บใหม่ (target="_blank")
        it("renders the correct external href for 'แจ้งปัญหาการใช้งาน' in the mobile profile screen", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            await openMobileProfile();
            const reportLink = (await screen.findByText("แจ้งปัญหาการใช้งาน")).closest("a");

            expect(reportLink).toHaveAttribute(
                "href",
                "https://forms.gle/EFAqAP1F3JUeN7wF6"
            );
            expect(reportLink).toHaveAttribute("target", "_blank");
        });

        // กรณี: path ปัจจุบันตรงกับ "/application-status" แล้วเปิดหน้าจอโปรไฟล์มือถือ
        // คาดหวัง: เมนู "ติดตามสถานะการสมัคร" ต้องถูกไฮไลต์ (มีคลาสสี active ติดอยู่)
        it("highlights the active menu item in the mobile profile screen based on the current path", async () => {
            (usePathname as jest.Mock).mockReturnValue("/application-status");
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            await openMobileProfile();
            const statusLink = (
                await screen.findByText("ติดตามสถานะการสมัคร")
            ).closest("a");

            expect(statusLink?.className).toContain("bg-primary-50");
        });
    });

    describe("Mobile notification screen header buttons", () => {
        // กรณี: หน้าจอแจ้งเตือนมือถือเปิดอยู่ แล้วผู้ใช้กดไอคอนกระดิ่งใน header ของหน้าจอนั้นเอง (ปุ่มปิด)
        // คาดหวัง: หน้าจอแจ้งเตือนต้องปิดลง (ข้อความ "การแจ้งเตือน" หายไป)
        it("closes the mobile notification screen via its own header bell icon", async () => {
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[2]); // เปิดหน้าจอแจ้งเตือนมือถือ
            expect(await screen.findByText("การแจ้งเตือน")).toBeInTheDocument();

            // ปุ่ม 3 ปุ่มสุดท้ายที่เพิ่มเข้ามาคือปุ่มใน header ของหน้าจอเต็มจอ: [กระดิ่ง(ปิด), โปรไฟล์, แฮมเบอร์เกอร์]
            const allButtons = screen.getAllByRole("button");
            fireEvent.click(allButtons[allButtons.length - 3]);

            expect(screen.queryByText("การแจ้งเตือน")).not.toBeInTheDocument();
        });

        // กรณี: หน้าจอแจ้งเตือนมือถือเปิดอยู่ แล้วผู้ใช้กดไอคอนโปรไฟล์ใน header ของหน้าจอนั้น
        // คาดหวัง: ต้องสลับไปเปิดหน้าจอโปรไฟล์มือถือแทน (ปิดหน้าจอแจ้งเตือนไปด้วย)
        it("switches to the mobile profile screen via the header profile icon", async () => {
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[2]);
            await screen.findByText("การแจ้งเตือน");

            const allButtons = screen.getAllByRole("button");
            fireEvent.click(allButtons[allButtons.length - 2]);

            expect(await screen.findByText("ข้อมูลผู้สมัคร")).toBeInTheDocument();
        });

        // กรณี: หน้าจอแจ้งเตือนมือถือเปิดอยู่ แล้วผู้ใช้กดไอคอนแฮมเบอร์เกอร์ใน header ของหน้าจอนั้น
        // คาดหวัง: ต้องสลับไปเปิด sidebar เมนูมือถือแทน
        it("switches to the mobile sidebar menu via the header hamburger icon", async () => {
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[2]);
            await screen.findByText("การแจ้งเตือน");

            const allButtons = screen.getAllByRole("button");
            fireEvent.click(allButtons[allButtons.length - 1]);

            expect(screen.getAllByText("ตำแหน่งฝึกงาน").length).toBeGreaterThan(1);
        });
    });

    describe("iTT link in mobile sidebar", () => {
        // กรณี: internshipStatus เป็น AWAITING แล้วเปิด sidebar เมนูมือถือ
        // คาดหวัง: ต้องมีลิงก์ "iTT" ปรากฏ 2 จุด (desktop nav ที่ซ่อนด้วย CSS + mobile sidebar ที่เพิ่งเปิด)
        it("shows the iTT link in the mobile sidebar when internship status is AWAITING", async () => {
            (extractStudentProfile as jest.Mock).mockReturnValue({
                internshipStatus: "AWAITING",
            });
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            fireEvent.click(screen.getByLabelText("Open menu"));

            const ittLinks = await screen.findAllByText("iTT");
            expect(ittLinks.length).toBe(2);
        });
    });

    describe("Click outside closes dropdowns", () => {
        // กรณี: dropdown "ช่วยเหลือ" เปิดอยู่ แล้วผู้ใช้คลิกที่อื่นนอก dropdown
        // คาดหวัง: dropdown ต้องปิดตัวเองอัตโนมัติ (useEffect ที่ฟัง mousedown นอก ref)
        it("closes the help dropdown when clicking outside of it", () => {
            render(<NavbarIntern />);

            fireEvent.click(screen.getByText("ช่วยเหลือ"));
            expect(screen.getByText("FAQs")).toBeInTheDocument();

            fireEvent.mouseDown(document.body);

            expect(screen.queryByText("FAQs")).not.toBeInTheDocument();
        });

        // กรณี: profile dropdown (desktop) เปิดอยู่ แล้วผู้ใช้คลิกที่อื่นนอก dropdown
        // คาดหวัง: dropdown ต้องปิดตัวเองเช่นเดียวกัน
        it("closes the desktop profile dropdown when clicking outside of it", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            const profileButtons = screen
                .getAllByRole("button")
                .filter((btn) => !btn.className.includes("md:hidden"));
            fireEvent.click(profileButtons[profileButtons.length - 1]);
            expect(await screen.findByText("ออกจากระบบ")).toBeInTheDocument();

            fireEvent.mouseDown(document.body);

            expect(screen.queryByText("ออกจากระบบ")).not.toBeInTheDocument();
        });
    });
});