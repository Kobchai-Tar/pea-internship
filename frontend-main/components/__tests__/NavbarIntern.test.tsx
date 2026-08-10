import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import NavbarIntern from "../ui/NavbarIntern"; 
import { usePathname, useRouter } from "next/navigation";
import {
    authApi,
    authStorage,
    favoriteApi,
    notificationApi,
    userApi,
    extractStudentProfile,
} from "@/services/api";

jest.mock("next/navigation", () => ({
    usePathname: jest.fn(),
    useRouter: jest.fn(),
}));

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

        (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([]);
        (notificationApi.markAllAsRead as jest.Mock).mockResolvedValue(undefined);
        (notificationApi.markAsRead as jest.Mock).mockResolvedValue(undefined);
        (notificationApi.deleteNotification as jest.Mock).mockResolvedValue(undefined);
        (favoriteApi.getFavorites as jest.Mock).mockResolvedValue({ data: [] });
        (userApi.getUserProfile as jest.Mock).mockResolvedValue({ profile: {} });
        (extractStudentProfile as jest.Mock).mockReturnValue(null);
    });

    describe("Initial data loading", () => {
        it("loads notifications, favorites count, and internship status on mount", async () => {
            render(<NavbarIntern />);

            await waitFor(() => {
                expect(notificationApi.getMyNotifications).toHaveBeenCalledTimes(1);
            });
            expect(favoriteApi.getFavorites).toHaveBeenCalledTimes(1);
            expect(userApi.getUserProfile).toHaveBeenCalledTimes(1);
        });

        it("handles API errors gracefully on mount without crashing", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockRejectedValueOnce(new Error("Network Error"));
            (favoriteApi.getFavorites as jest.Mock).mockRejectedValueOnce(new Error("Network Error"));
            (userApi.getUserProfile as jest.Mock).mockRejectedValueOnce(new Error("Network Error"));

            expect(() => render(<NavbarIntern />)).not.toThrow();

            await waitFor(() => {
                expect(notificationApi.getMyNotifications).toHaveBeenCalledTimes(1);
            });
        });

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
        it("shows a badge dot next to 'รายการโปรด' when favoritesCount is greater than 0", async () => {
            (favoriteApi.getFavorites as jest.Mock).mockResolvedValue({
                data: [{ id: 1 }, { id: 2 }],
            });

            const { container } = render(<NavbarIntern />);

            await waitFor(() => {
                expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
            });
        });

        it("uses the favoritesCount prop to override the value loaded from the API", async () => {
            (favoriteApi.getFavorites as jest.Mock).mockResolvedValue({ data: [] });
            const { container } = render(<NavbarIntern favoritesCount={5} />);

            await waitFor(() => {
                expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
            });
        });
    });

    describe("iTT link visibility", () => {
        it("shows the iTT link when internship status is AWAITING", async () => {
            (extractStudentProfile as jest.Mock).mockReturnValue({
                internshipStatus: "AWAITING",
            });
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            expect(await screen.findByText("iTT")).toBeInTheDocument();
        });

        it("shows the iTT link when internship status is ACTIVE", async () => {
            (extractStudentProfile as jest.Mock).mockReturnValue({
                internshipStatus: "ACTIVE",
            });
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            expect(await screen.findByText("iTT")).toBeInTheDocument();
        });

        it("hides the iTT link when there is no internship status", async () => {
            render(<NavbarIntern />);

            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());
            expect(screen.queryByText("iTT")).not.toBeInTheDocument();
        });
    });

    describe("Desktop notification dropdown", () => {
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

        it("caps the unread badge at '99+' when there are more than 99 unread notifications", async () => {
            const many = Array.from({ length: 120 }, (_, i) =>
                makeNotification({ id: i + 1, isRead: false })
            );
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue(many);
            render(<NavbarIntern />);

            const badges = await screen.findAllByText("99+");
            expect(badges.length).toBeGreaterThan(0);
        });

        it("handles errors gracefully when marking all as read fails", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 1, isRead: false }),
            ]);
            (notificationApi.markAllAsRead as jest.Mock).mockRejectedValueOnce(new Error("Failed to mark read"));

            render(<NavbarIntern />);
            await screen.findAllByText("1");

            const bellButtons = screen.getAllByRole("button");
            fireEvent.click(bellButtons[1]);

            await waitFor(() => {
                expect(notificationApi.markAllAsRead).toHaveBeenCalled();
            });
            expect(await screen.findByText("ผลการสมัครฝึกงาน")).toBeInTheDocument();
        });

        it("opens the notification dropdown and shows the empty state when there are no notifications", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            const bellButtons = screen.getAllByRole("button");
            fireEvent.click(bellButtons[1]);

            expect(await screen.findByText("ไม่มีการแจ้งเตือน")).toBeInTheDocument();
        });

        it("marks all notifications as read when opening the panel with unread items", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 1, isRead: false }),
            ]);
            render(<NavbarIntern />);
            await screen.findAllByText("1"); 

            const bellButtons = screen.getAllByRole("button");
            fireEvent.click(bellButtons[1]);

            await waitFor(() => {
                expect(notificationApi.markAllAsRead).toHaveBeenCalledTimes(1);
            });
        });

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
        it("deletes a single notification after confirming, and shows a success toast", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 42 }),
            ]);
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[1]);

            const deleteBtn = (await screen.findAllByLabelText("ลบการแจ้งเตือน"))[0];
            fireEvent.click(deleteBtn);

            expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();

            fireEvent.click(screen.getByText("ลบ"));

            await waitFor(() => {
                expect(notificationApi.deleteNotification).toHaveBeenCalledWith(42);
            });
            expect(await screen.findByTestId("toast")).toHaveTextContent(
                "ลบการแจ้งเตือนสำเร็จ"
            );
        });

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

        it("clears all notifications after confirming 'ลบทั้งหมด'", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 1 }),
                makeNotification({ id: 2 }),
            ]);
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[1]);

            fireEvent.click(await screen.findByText("ลบทั้งหมด"));

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
        const openProfileDropdown = () => {
            const profileButtons = screen
                .getAllByRole("button")
                .filter((btn) => !btn.className.includes("md:hidden"));
            fireEvent.click(profileButtons[profileButtons.length - 1]);
        };

        it("opens the profile dropdown when the profile icon is clicked", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            openProfileDropdown();

            expect(await screen.findByText("ออกจากระบบ")).toBeInTheDocument();
        });

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
        it("opens the help dropdown showing 'คู่มือการใช้งาน' and 'FAQs'", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            fireEvent.click(screen.getByText("ช่วยเหลือ"));

            expect(screen.getByText("คู่มือการใช้งาน")).toBeInTheDocument();
            expect(screen.getByText("FAQs")).toBeInTheDocument();
        });
    });

    describe("Mobile hamburger menu", () => {
        it("opens the mobile sidebar menu when the hamburger icon is clicked", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            fireEvent.click(screen.getByLabelText("Open menu"));

            expect(screen.getAllByText("ตำแหน่งฝึกงาน").length).toBeGreaterThan(1);
        });

        it("closes the mobile sidebar menu when the close button is clicked", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            fireEvent.click(screen.getByLabelText("Open menu"));
            fireEvent.click(screen.getByLabelText("Close menu"));

            expect(screen.getAllByText("ตำแหน่งฝึกงาน").length).toBe(1);
        });
    });

    describe("Mobile notification screen (เวอร์ชันเต็มจอบนมือถือ)", () => {
        const openMobileNotifications = async () => {
            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[2]);
        };

        it("opens the mobile notification full-screen panel and shows notifications", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 10, title: "ผลการสมัครฝึกงาน", message: "ข้อความทดสอบมือถือ" }),
            ]);
            render(<NavbarIntern />);

            await openMobileNotifications();

            expect(await screen.findByText("ข้อความทดสอบมือถือ")).toBeInTheDocument();
        });

        it("shows the empty state and hides the clear-all button when there are no notifications", async () => {
            render(<NavbarIntern />);

            await openMobileNotifications();

            expect(await screen.findByText("ไม่มีการแจ้งเตือน")).toBeInTheDocument();
            expect(screen.queryByText("ลบทั้งหมด")).not.toBeInTheDocument();
        });

        it("navigates when a notification item is clicked from the mobile screen", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 11, title: "ผลการสมัครฝึกงาน", message: "แจ้งเตือนมือถือ" }),
            ]);
            render(<NavbarIntern />);

            await openMobileNotifications();
            fireEvent.click(await screen.findByText("แจ้งเตือนมือถือ"));

            expect(mockPush).toHaveBeenCalledWith("/application-status");
        });

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
        const openMobileProfile = async () => {
            const profileButtons = await screen.findAllByRole("button");
            fireEvent.click(profileButtons[3]);
        };

        it("opens the mobile profile full-screen panel showing menu links", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            await openMobileProfile();

            expect(await screen.findByText("ข้อมูลผู้สมัคร")).toBeInTheDocument();
            expect(screen.getByText("ประวัติการสมัคร")).toBeInTheDocument();
            expect(screen.getByText("ติดตามสถานะการสมัคร")).toBeInTheDocument();
        });

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
        it("closes the mobile notification screen via its own header bell icon", async () => {
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[2]); 
            expect(await screen.findByText("การแจ้งเตือน")).toBeInTheDocument();

            const allButtons = screen.getAllByRole("button");
            fireEvent.click(allButtons[allButtons.length - 3]);

            expect(screen.queryByText("การแจ้งเตือน")).not.toBeInTheDocument();
        });

        it("switches to the mobile profile screen via the header profile icon", async () => {
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[2]);
            await screen.findByText("การแจ้งเตือน");

            const allButtons = screen.getAllByRole("button");
            fireEvent.click(allButtons[allButtons.length - 2]);

            expect(await screen.findByText("ข้อมูลผู้สมัคร")).toBeInTheDocument();
        });

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
        it("closes the help dropdown when clicking outside of it", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            fireEvent.click(screen.getByText("ช่วยเหลือ"));
            expect(screen.getByText("FAQs")).toBeInTheDocument();

            fireEvent.mouseDown(document.body);

            expect(screen.queryByText("FAQs")).not.toBeInTheDocument();
        });

        it("closes the desktop notification dropdown when clicking outside of it", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([]);
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            const bellButtons = screen.getAllByRole("button");
            fireEvent.click(bellButtons[1]); 

            expect(await screen.findByText("ไม่มีการแจ้งเตือน")).toBeInTheDocument();

            fireEvent.mouseDown(document.body);

            await waitFor(() => {
                expect(screen.queryByText("ไม่มีการแจ้งเตือน")).not.toBeInTheDocument();
            });
        });

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

        describe("Toggle dropdowns and mobile menus (Open and Close on re-click)", () => {
            it("toggles desktop notification dropdown on repeated clicks", async () => {
                render(<NavbarIntern />);
                await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

                const bellButtons = screen.getAllByRole("button");
                fireEvent.click(bellButtons[1]);
                expect(await screen.findByText("ไม่มีการแจ้งเตือน")).toBeInTheDocument();

                fireEvent.click(bellButtons[1]);
                await waitFor(() => {
                    expect(screen.queryByText("ไม่มีการแจ้งเตือน")).not.toBeInTheDocument();
                });
            });

            it("toggles help dropdown on repeated clicks", async () => {
                render(<NavbarIntern />);
                await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

                const helpBtn = screen.getByText("ช่วยเหลือ");
                fireEvent.click(helpBtn);
                expect(screen.getByText("FAQs")).toBeInTheDocument();

                fireEvent.click(helpBtn);
                expect(screen.queryByText("FAQs")).not.toBeInTheDocument();
            });

            it("toggles desktop profile dropdown on repeated clicks", async () => {
                render(<NavbarIntern />);
                await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

                const profileButtons = screen
                    .getAllByRole("button")
                    .filter((btn) => !btn.className.includes("md:hidden"));
                const targetBtn = profileButtons[profileButtons.length - 1];

                fireEvent.click(targetBtn);
                expect(await screen.findByText("ออกจากระบบ")).toBeInTheDocument();

                fireEvent.click(targetBtn);
                expect(screen.queryByText("ออกจากระบบ")).not.toBeInTheDocument();
            });
        });

        describe("Mobile Profile & Menu Button Actions", () => {
            it("opens mobile notification screen when mobile bell is clicked", async () => {
                render(<NavbarIntern />);
                await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

                const buttons = screen.getAllByRole("button");
                fireEvent.click(buttons[2]); 

                expect(await screen.findByText("ไม่มีการแจ้งเตือน")).toBeInTheDocument();
            });

            it("opens mobile profile screen when mobile profile icon is clicked", async () => {
                render(<NavbarIntern />);
                await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

                const buttons = screen.getAllByRole("button");
                fireEvent.click(buttons[3]); 

                expect(await screen.findByText("ออกจากระบบ")).toBeInTheDocument();
            });

            it("opens mobile sidebar menu when hamburger icon is clicked", async () => {
                render(<NavbarIntern />);
                await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

                const hamburgerBtn = screen.getByLabelText("Open menu");
                fireEvent.click(hamburgerBtn);

                await waitFor(() => {
                    expect(screen.getAllByText("ตำแหน่งฝึกงาน").length).toBeGreaterThan(1);
                });
            });
        });

        describe("Error Handling Edge Cases & Mobile Operations", () => {
            it("handles failure when marking a single notification as read", async () => {
                (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                    { id: 88, title: "ผลการสมัครฝึกงาน", message: "ทดสอบ", type: "NORMAL", isRead: false, createdAt: new Date().toISOString() },
                ]);
                (notificationApi.markAsRead as jest.Mock).mockRejectedValueOnce(new Error("Update failed"));

                render(<NavbarIntern />);
                const bellButtons = await screen.findAllByRole("button");
                fireEvent.click(bellButtons[1]);

                const item = await screen.findByText("ผลการสมัครฝึกงาน");
                fireEvent.click(item);

                await waitFor(() => {
                    expect(notificationApi.markAsRead).toHaveBeenCalledWith(88, true);
                });
                expect(mockPush).toHaveBeenCalledWith("/application-status");
            });

            it("handles failure when clearing all notifications", async () => {
                (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                    { id: 101, title: "แจ้งเตือนระบบ", message: "ทดสอบ", type: "NORMAL", isRead: true, createdAt: new Date().toISOString() },
                ]);
                (notificationApi.deleteNotification as jest.Mock).mockRejectedValueOnce(new Error("Clear failed"));

                render(<NavbarIntern />);
                const bellButtons = await screen.findAllByRole("button");
                fireEvent.click(bellButtons[1]);

                fireEvent.click(await screen.findByText("ลบทั้งหมด"));
                const confirmModal = screen.getByTestId("confirm-modal");
                fireEvent.click(within(confirmModal).getByText("ลบทั้งหมด"));

                await waitFor(() => {
                    expect(notificationApi.deleteNotification).toHaveBeenCalledWith(101);
                });
            });

            it("handles deletion failure in mobile notification view", async () => {
                (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                    { id: 202, title: "แจ้งเตือนมือถือ", message: "ทดสอบ", type: "NORMAL", isRead: true, createdAt: new Date().toISOString() },
                ]);
                (notificationApi.deleteNotification as jest.Mock).mockRejectedValueOnce(new Error("Mobile delete failed"));

                render(<NavbarIntern />);
                const bellButtons = await screen.findAllByRole("button");
                fireEvent.click(bellButtons[2]); 

                const deleteBtn = (await screen.findAllByLabelText("ลบการแจ้งเตือน"))[0];
                fireEvent.click(deleteBtn);

                const confirmBtn = await screen.findByText("ลบ");
                fireEvent.click(confirmBtn);

                await waitFor(() => {
                    expect(notificationApi.deleteNotification).toHaveBeenCalledWith(202);
                });
            });
        });

        describe("Active Route Highlighting & Additional Conditionals", () => {
            it("applies active styles based on current pathname", async () => {
                (usePathname as jest.Mock).mockReturnValue("/intern-home");
                render(<NavbarIntern />);
                await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

                const homeLink = screen.getAllByText("ตำแหน่งฝึกงาน")[0].closest("a");
                expect(homeLink).toHaveAttribute("href", "/intern-home");
            });

            it("does not display pulse badge when favoritesCount is 0", async () => {
                (favoriteApi.getFavorites as jest.Mock).mockResolvedValue({ data: [] });
                const { container } = render(<NavbarIntern favoritesCount={0} />);

                await waitFor(() => {
                    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
                });
            });

            it("hides iTT link for statuses other than AWAITING or ACTIVE", async () => {
                (extractStudentProfile as jest.Mock).mockReturnValue({
                    internshipStatus: "REJECTED",
                });
                render(<NavbarIntern />);

                await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());
                expect(screen.queryByText("iTT")).not.toBeInTheDocument();
            });

            it("cleans up timer on unmount", async () => {
                jest.useFakeTimers();
                const clearIntervalSpy = jest.spyOn(window, "clearInterval");

                const { unmount } = render(<NavbarIntern />);

                await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());
                unmount();

                expect(clearIntervalSpy).toHaveBeenCalled();
                jest.useRealTimers();
            });
        });
    });

    describe("Active link highlighting (desktop nav)", () => {
        it("highlights 'ข้อมูลกฟภ.' when pathname is '/intern-pea-info'", async () => {
            (usePathname as jest.Mock).mockReturnValue("/intern-pea-info");
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            const activeLink = screen.getAllByText("ข้อมูลกฟภ.")[0];
            expect(activeLink.className).toContain("text-primary-600 hover:text-primary-700");
        });

        it("highlights 'รายการโปรด' when pathname is '/favorites'", async () => {
            (usePathname as jest.Mock).mockReturnValue("/favorites");
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            const activeLink = screen.getAllByText("รายการโปรด")[0];
            expect(activeLink.className).toContain("text-primary-600 hover:text-primary-700");
        });

        it("highlights the 'ช่วยเหลือ' toggle button when pathname is '/faqs'", async () => {
            (usePathname as jest.Mock).mockReturnValue("/faqs");
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            expect(screen.getByText("ช่วยเหลือ").className).toContain("text-primary-600");
        });

        it("highlights the guide link using startsWith when on a guide sub-page", async () => {
            (usePathname as jest.Mock).mockReturnValue("/guide/step-1");
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            expect(screen.getByText("ช่วยเหลือ").className).toContain("text-primary-600");

            fireEvent.click(screen.getByText("ช่วยเหลือ"));
            expect(screen.getByText("คู่มือการใช้งาน").className).toContain(
                "text-primary-600 font-medium bg-primary-50"
            );
        });

        it("highlights 'FAQs' inside the help dropdown when pathname is exactly '/faqs'", async () => {
            (usePathname as jest.Mock).mockReturnValue("/faqs");
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            fireEvent.click(screen.getByText("ช่วยเหลือ"));
            expect(screen.getByText("FAQs").className).toContain(
                "text-primary-600 font-medium bg-primary-50"
            );
        });
    });

    describe("Active link highlighting (desktop profile dropdown)", () => {
        const openProfileDropdown = () => {
            const profileButtons = screen
                .getAllByRole("button")
                .filter((btn) => !btn.className.includes("md:hidden"));
            fireEvent.click(profileButtons[profileButtons.length - 1]);
        };

        it("highlights 'ข้อมูลผู้สมัคร' when pathname is '/intern-profile/edit'", async () => {
            (usePathname as jest.Mock).mockReturnValue("/intern-profile/edit");
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            openProfileDropdown();
            expect((await screen.findByText("ข้อมูลผู้สมัคร")).closest("a")).toHaveClass(
                "bg-primary-100",
                "text-primary-600"
            );
        });

        it("highlights 'ประวัติการสมัคร' when pathname starts with '/application-history/'", async () => {
            (usePathname as jest.Mock).mockReturnValue("/application-history/123");
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            openProfileDropdown();
            expect((await screen.findByText("ประวัติการสมัคร")).closest("a")).toHaveClass(
                "bg-primary-100",
                "text-primary-600"
            );
        });

        it("highlights 'ติดตามสถานะการสมัคร' when pathname starts with '/application-status/'", async () => {
            (usePathname as jest.Mock).mockReturnValue("/application-status/456");
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            openProfileDropdown();
            expect((await screen.findByText("ติดตามสถานะการสมัคร")).closest("a")).toHaveClass(
                "bg-primary-100",
                "text-primary-600"
            );
        });

        it("renders the correct external href for 'แจ้งปัญหาการใช้งาน' in the desktop dropdown", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(userApi.getUserProfile).toHaveBeenCalled());

            openProfileDropdown();
            const reportLink = (
                await screen.findByText("แจ้งปัญหาการใช้งาน")
            ).closest("a");

            expect(reportLink).toHaveAttribute(
                "href",
                "https://forms.gle/EFAqAP1F3JUeN7wF6"
            );
            expect(reportLink).toHaveAttribute("target", "_blank");
        });
    });

    describe("Mobile sidebar additional links", () => {
        it("renders the correct external href for 'แจ้งปัญหาการใช้งาน' in the mobile sidebar", async () => {
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            fireEvent.click(screen.getByLabelText("Open menu"));
            const reportLink = screen.getByText("แจ้งปัญหาการใช้งาน").closest("a");

            expect(reportLink).toHaveAttribute(
                "href",
                "https://forms.gle/EFAqAP1F3JUeN7wF6"
            );
            expect(reportLink).toHaveAttribute("target", "_blank");
        });

        it("highlights 'FAQs' in the mobile sidebar when pathname is '/faqs'", async () => {
            (usePathname as jest.Mock).mockReturnValue("/faqs");
            render(<NavbarIntern />);
            await waitFor(() => expect(notificationApi.getMyNotifications).toHaveBeenCalled());

            fireEvent.click(screen.getByLabelText("Open menu"));
            expect(screen.getByText("FAQs").closest("a")?.className).toContain(
                "bg-primary-50 text-primary-600"
            );
        });
    });

    describe("Notification routing edge cases", () => {
        it("routes to /application-history when the message mentions the position being fully filled", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({
                    id: 99,
                    title: "แจ้งเตือนทั่วไป",
                    message: "ตำแหน่งนี้มีผู้ได้รับคัดเลือกครบจำนวนแล้ว",
                }),
            ]);
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[1]);

            fireEvent.click(await screen.findByText("แจ้งเตือนทั่วไป"));

            expect(mockPush).toHaveBeenCalledWith("/application-history");
        });

        it("routes to /application-history when the title itself is 'การฝึกงานถูกยกเลิก'", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({
                    id: 100,
                    title: "การฝึกงานถูกยกเลิก",
                    message: "รายละเอียดการยกเลิก",
                }),
            ]);
            render(<NavbarIntern />);

            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[1]);

            fireEvent.click(await screen.findByText("การฝึกงานถูกยกเลิก"));

            expect(mockPush).toHaveBeenCalledWith("/application-history");
        });
    });

    describe("Delete notification failure handling", () => {
        it("shows an error toast when deleting a single notification fails", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 55 }),
            ]);
            (notificationApi.deleteNotification as jest.Mock).mockRejectedValueOnce(
                new Error("delete failed")
            );

            render(<NavbarIntern />);
            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[1]);

            const deleteBtn = (await screen.findAllByLabelText("ลบการแจ้งเตือน"))[0];
            fireEvent.click(deleteBtn);
            fireEvent.click(screen.getByText("ลบ"));

            expect(await screen.findByTestId("toast")).toHaveTextContent(
                "ลบการแจ้งเตือนไม่สำเร็จ"
            );
            expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
        });

        it("shows a partial-success toast when clearing all notifications partially fails", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 1 }),
                makeNotification({ id: 2 }),
            ]);
            (notificationApi.deleteNotification as jest.Mock)
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error("failed"));

            render(<NavbarIntern />);
            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[1]);

            fireEvent.click(await screen.findByText("ลบทั้งหมด"));
            const confirmModal = screen.getByTestId("confirm-modal");
            fireEvent.click(within(confirmModal).getByText("ลบทั้งหมด"));

            expect(await screen.findByTestId("toast")).toHaveTextContent(
                "ลบบางรายการสำเร็จ แต่บางรายการไม่สำเร็จ"
            );
        });

        it("shows a full-failure toast when every item fails to delete during clear-all", async () => {
            (notificationApi.getMyNotifications as jest.Mock).mockResolvedValue([
                makeNotification({ id: 1 }),
            ]);
            (notificationApi.deleteNotification as jest.Mock).mockRejectedValueOnce(
                new Error("failed")
            );

            render(<NavbarIntern />);
            const bellButtons = await screen.findAllByRole("button");
            fireEvent.click(bellButtons[1]);

            fireEvent.click(await screen.findByText("ลบทั้งหมด"));
            const confirmModal = screen.getByTestId("confirm-modal");
            fireEvent.click(within(confirmModal).getByText("ลบทั้งหมด"));

            expect(await screen.findByTestId("toast")).toHaveTextContent(
                "ลบการแจ้งเตือนทั้งหมดไม่สำเร็จ"
            );
        });
    });
});
