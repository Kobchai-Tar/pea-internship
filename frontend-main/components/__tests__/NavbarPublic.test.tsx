import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import NavbarPublic from "../ui/NavbarPublic"; // Adjust the import path as necessary
import { usePathname, useRouter } from "next/navigation";
import { authApi, authStorage } from "@/services/api";

jest.mock("next/navigation", () => ({
    usePathname: jest.fn(),
    useRouter: jest.fn(),
}));

jest.mock("@/services/api", () => ({
    authApi: {
        signInKeycloak: jest.fn(),
        signOut: jest.fn(),
    },
    authStorage: {
        clearAuth: jest.fn(),
    },
}));

describe("NavbarPublic Component", () => {
    const mockPush = jest.fn();
    const mockReplace = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (usePathname as jest.Mock).mockReturnValue("/");
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            replace: mockReplace,
        });
        (authApi.signInKeycloak as jest.Mock).mockReturnValue(
            "https://keycloak.example.com/auth"
        );
    });

    describe("Guest mode (ยังไม่ล็อกอิน)", () => {
        // กรณี: ไม่ส่ง prop isLoggedIn มา (ค่า default = false)
        // คาดหวัง: ต้องเห็นลิงก์นำทางปกติ + ปุ่มล็อกอินทั้ง 2 ปุ่ม แต่ต้องไม่เห็นกระดิ่งแจ้งเตือน/โปรไฟล์
        it("renders guest navigation links and login buttons", () => {
            render(<NavbarPublic />);

            expect(screen.getByText("ตำแหน่งฝึกงาน")).toBeInTheDocument();
            expect(screen.getByText("ข้อมูลกฟภ.")).toBeInTheDocument();
            expect(screen.getByText("เข้าสู่ระบบผู้สมัคร")).toBeInTheDocument();
            expect(screen.getByText("เข้าสู่ระบบพนักงาน PEA")).toBeInTheDocument();
            expect(screen.queryByText("รายการโปรด")).not.toBeInTheDocument();
        });

        // กรณี: กดเมนู "ช่วยเหลือ"
        // คาดหวัง: ต้องเปิด dropdown แสดง 3 ลิงก์ย่อยครบ: คู่มือการใช้งาน, FAQs, ผู้จัดทำ
        it("opens the help dropdown showing all 3 sub-links", () => {
            render(<NavbarPublic />);

            fireEvent.click(screen.getByText("ช่วยเหลือ"));

            expect(screen.getByText("คู่มือการใช้งาน")).toBeInTheDocument();
            expect(screen.getByText("FAQs")).toBeInTheDocument();
            expect(screen.getByText("ผู้จัดทำ")).toBeInTheDocument();
        });

        // กรณี: help dropdown เปิดอยู่ แล้วผู้ใช้คลิกที่อื่นนอก dropdown
        // คาดหวัง: dropdown ต้องปิดตัวเองอัตโนมัติ
        it("closes the help dropdown when clicking outside of it", () => {
            render(<NavbarPublic />);

            fireEvent.click(screen.getByText("ช่วยเหลือ"));
            expect(screen.getByText("FAQs")).toBeInTheDocument();

            fireEvent.mouseDown(document.body);

            expect(screen.queryByText("FAQs")).not.toBeInTheDocument();
        });

        // กรณี: กดปุ่ม "เข้าสู่ระบบพนักงาน PEA"
        // คาดหวัง: ต้องเรียก authApi.signInKeycloak() เพื่อสร้าง URL สำหรับ redirect ไประบบ SSO ของ กฟภ.
        // (ไม่เช็ค window.location.href ตรงๆ เพราะ jsdom ไม่รองรับการ navigate จริง และไม่ใช่ส่วนที่ควรเทส
        //  แค่ต้องพิสูจน์ว่า business logic เรียกฟังก์ชันสร้างลิงก์ถูกต้อง)
        it("calls authApi.signInKeycloak when clicking 'เข้าสู่ระบบพนักงาน PEA'", () => {
            render(<NavbarPublic />);

            fireEvent.click(screen.getByText("เข้าสู่ระบบพนักงาน PEA"));

            expect(authApi.signInKeycloak).toHaveBeenCalledTimes(1);
        });

        // กรณี: กดปุ่มแฮมเบอร์เกอร์ (มุมขวาบนฝั่งจอเล็ก)
        // คาดหวัง: ต้องเปิด sidebar เมนูมือถือขึ้นมา
        // หมายเหตุ: ปุ่ม/ลิงก์เดิมบน desktop nav ยังอยู่ใน DOM เสมอ (ซ่อนด้วย CSS class "hidden lg:block"
        // ซึ่ง jsdom ไม่ประมวลผลจริง) จึงต้องใช้ getAllByText แทน getByText เพื่อรับได้ว่าจะเจอ 2 element
        it("opens the mobile sidebar menu when the hamburger icon is clicked", () => {
            render(<NavbarPublic />);

            fireEvent.click(screen.getByLabelText("Open menu"));

            // sidebar มือถือแสดงลิงก์ครบชุดของตัวเอง (คนละ element กับ nav แถบบน)
            expect(screen.getAllByText("ตำแหน่งฝึกงาน").length).toBeGreaterThan(1);
            expect(screen.getAllByText("เข้าสู่ระบบผู้สมัคร").length).toBe(2);
        });

        // กรณี: sidebar มือถือเปิดอยู่ แล้วผู้ใช้กดปุ่มปิด (X)
        // คาดหวัง: sidebar ต้องปิดลง เหลือแค่ลิงก์บน nav แถบบนจุดเดียว
        it("closes the mobile sidebar menu when the close button is clicked", () => {
            render(<NavbarPublic />);

            fireEvent.click(screen.getByLabelText("Open menu"));
            fireEvent.click(screen.getByLabelText("Close menu"));

            expect(screen.getAllByText("ตำแหน่งฝึกงาน").length).toBe(1);
        });

        // กรณี: sidebar มือถือเปิดอยู่ แล้วผู้ใช้คลิกที่พื้นหลังสีดำโปร่งแสง (backdrop)
        // คาดหวัง: sidebar ต้องปิดลงเหมือนกดปุ่ม X
        it("closes the mobile sidebar menu when the backdrop is clicked", () => {
            const { container } = render(<NavbarPublic />);

            fireEvent.click(screen.getByLabelText("Open menu"));
            const backdrop = container.querySelector(".fixed.inset-0.bg-black\\/30");
            fireEvent.click(backdrop!);

            expect(screen.getAllByText("ตำแหน่งฝึกงาน").length).toBe(1);
        });

        // กรณี: เปิด sidebar มือถือ แล้วกดปุ่ม "เข้าสู่ระบบพนักงาน PEA" จากในนั้น
        // คาดหวัง: ต้องเรียก authApi.signInKeycloak() เหมือนปุ่มบน desktop nav ทุกประการ
        // หมายเหตุ: มีปุ่มข้อความเดียวกัน 2 ปุ่มใน DOM (desktop + sidebar มือถือ) จึงต้องระบุให้ชัดว่ากดตัวที่ 2
        // (ตัวที่ render อยู่ใน sidebar ซึ่งจะมาทีหลังตัวบน desktop nav เสมอ)
        it("calls authApi.signInKeycloak from the mobile sidebar's PEA login button too", () => {
            render(<NavbarPublic />);

            fireEvent.click(screen.getByLabelText("Open menu"));
            const keycloakButtons = screen.getAllByText("เข้าสู่ระบบพนักงาน PEA");
            fireEvent.click(keycloakButtons[1]);

            expect(authApi.signInKeycloak).toHaveBeenCalledTimes(1);
        });
    });

    describe("Logged-in intern mode (isLoggedIn=true, userRole='intern')", () => {
        // กรณี: ล็อกอินเป็น intern แล้ว
        // คาดหวัง: ต้องเห็นลิงก์ "รายการโปรด" เพิ่มมา และต้องไม่เห็นปุ่มล็อกอินทั้งสองปุ่มอีกต่อไป
        // (หมายเหตุ: โหมดนี้ไม่มีปุ่มแฮมเบอร์เกอร์ในโค้ดเลย เมนูมือถือจึงเปิดไม่ได้ — น่าจะเป็นจุดที่ควรแจ้ง dev)
        it("renders intern nav links and hides the login buttons", () => {
            render(<NavbarPublic isLoggedIn userRole="intern" />);

            expect(screen.getByText("รายการโปรด")).toBeInTheDocument();
            expect(screen.queryByText("เข้าสู่ระบบผู้สมัคร")).not.toBeInTheDocument();
            expect(
                screen.queryByText("เข้าสู่ระบบพนักงาน PEA")
            ).not.toBeInTheDocument();
        });

        // กรณี: กดกระดิ่งแจ้งเตือน
        // คาดหวัง: ต้องเปิด panel แสดงข้อความ "ไม่มีการแจ้งเตือนใหม่" (เวอร์ชันนี้ยังไม่ได้ต่อ API แจ้งเตือนจริง)
        it("opens the notification dropdown showing the empty-state message", () => {
            render(<NavbarPublic isLoggedIn userRole="intern" />);

            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[0]); // ปุ่มกระดิ่งเป็นปุ่มแรกสุดในโหมด intern

            expect(screen.getByText("ไม่มีการแจ้งเตือนใหม่")).toBeInTheDocument();
        });

        // กรณี: notification dropdown เปิดอยู่ แล้วคลิกนอก dropdown
        // คาดหวัง: ต้องปิดตัวเองอัตโนมัติ
        it("closes the notification dropdown when clicking outside of it", () => {
            render(<NavbarPublic isLoggedIn userRole="intern" />);

            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[0]);
            expect(screen.getByText("ไม่มีการแจ้งเตือนใหม่")).toBeInTheDocument();

            fireEvent.mouseDown(document.body);

            expect(screen.queryByText("ไม่มีการแจ้งเตือนใหม่")).not.toBeInTheDocument();
        });

        // กรณี: กดไอคอนโปรไฟล์
        // คาดหวัง: ต้องเปิด dropdown แสดงเมนูครบ 3 ลิงก์ พร้อม href ที่ถูกต้อง
        it("opens the profile dropdown showing menu links with correct hrefs", () => {
            render(<NavbarPublic isLoggedIn userRole="intern" />);

            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[1]); // ปุ่มโปรไฟล์เป็นปุ่มที่สองในโหมด intern

            expect(screen.getByText("ข้อมูลผู้สมัคร").closest("a")).toHaveAttribute(
                "href",
                "/intern-info"
            );
            expect(screen.getByText("ประวัติการสมัคร").closest("a")).toHaveAttribute(
                "href",
                "/application-history"
            );
            expect(
                screen.getByText("ติดตามสถานะการสมัคร").closest("a")
            ).toHaveAttribute("href", "/application-status");
        });

        // กรณี: profile dropdown เปิดอยู่ แล้วกด "ออกจากระบบ"
        // คาดหวัง: ต้องเรียก authApi.signOut, ล้าง auth storage, แล้ว redirect ไปหน้าแรกด้วย router.replace("/")
        it("logs out correctly: calls signOut, clears storage, and redirects to '/'", async () => {
            render(<NavbarPublic isLoggedIn userRole="intern" />);

            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[1]);
            fireEvent.click(screen.getByText("ออกจากระบบ"));

            await waitFor(() => {
                expect(authApi.signOut).toHaveBeenCalledTimes(1);
            });
            expect(authStorage.clearAuth).toHaveBeenCalledTimes(1);
            expect(mockReplace).toHaveBeenCalledWith("/");
        });

        // กรณี: authApi.signOut ล้มเหลว (เช่น network error)
        // คาดหวัง: ต้อง fallback ไปล้าง storage และ redirect เหมือนเดิม ไม่ปล่อยผู้ใช้ค้างอยู่หน้าเดิม
        it("still clears storage and redirects even if the signOut API call fails", async () => {
            (authApi.signOut as jest.Mock).mockRejectedValue(new Error("network error"));
            render(<NavbarPublic isLoggedIn userRole="intern" />);

            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[1]);
            fireEvent.click(screen.getByText("ออกจากระบบ"));

            await waitFor(() => {
                expect(authStorage.clearAuth).toHaveBeenCalledTimes(1);
            });
            expect(mockReplace).toHaveBeenCalledWith("/");
        });
    });

    describe("Edge case: logged in but not an intern", () => {
        // กรณี: isLoggedIn = true แต่ userRole เป็น "admin" (ไม่ใช่ "intern")
        // คาดหวัง: ต้อง fallback ไปแสดง nav แบบ guest เหมือนคนยังไม่ล็อกอิน (เงื่อนไขเช็คทั้ง isLoggedIn และ userRole==="intern" คู่กัน)
        it("falls back to the guest navigation when userRole is not 'intern'", () => {
            render(<NavbarPublic isLoggedIn userRole="admin" />);

            expect(screen.getByText("เข้าสู่ระบบผู้สมัคร")).toBeInTheDocument();
            expect(screen.getByText("เข้าสู่ระบบพนักงาน PEA")).toBeInTheDocument();
            expect(screen.queryByText("รายการโปรด")).not.toBeInTheDocument();
        });
    });
});