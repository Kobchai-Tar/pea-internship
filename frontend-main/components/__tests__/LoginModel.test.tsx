import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import LoginModal from "../ui/LoginModal"; // Adjust the import path as necessary
import { useRouter } from "next/navigation";
import { authApi, authStorage } from "@/services/api";

// Mock Next.js router เหมือนไฟล์ทดสอบอื่นๆ ในโปรเจกต์
jest.mock("next/navigation", () => ({
    useRouter: jest.fn(),
}));

// Mock authApi/authStorage เพราะ component นี้เรียก API จริงตอน submit
// ถ้าไม่ mock ตัว test จะพยายามยิง network request จริงและ fail/ช้ามาก
jest.mock("@/services/api", () => ({
    authApi: {
        loginIntern: jest.fn(),
        getSession: jest.fn(),
    },
    authStorage: {
        setUser: jest.fn(),
    },
}));

describe("LoginModal Component", () => {
    const mockPush = jest.fn();
    const mockOnClose = jest.fn();
    const mockOnLoginSuccess = jest.fn();

    // ฟังก์ชัน helper กรอกฟอร์มด้วยเบอร์โทร/รหัสผ่านที่ถูกต้อง เพื่อลดโค้ดซ้ำในเทสที่ต้อง submit สำเร็จ
    const fillValidForm = () => {
        fireEvent.change(screen.getByPlaceholderText("เบอร์โทรศัพท์"), {
            target: { value: "0812345678" },
        });
        fireEvent.change(screen.getByPlaceholderText("รหัสผ่าน"), {
            target: { value: "mypassword" },
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    });

    describe("Visibility", () => {
        // กรณี: isOpen = false
        // คาดหวัง: component ต้องไม่ render อะไรออกมาเลย (return null)
        it("renders nothing when isOpen is false", () => {
            const { container } = render(
                <LoginModal isOpen={false} onClose={mockOnClose} />
            );
            expect(container).toBeEmptyDOMElement();
        });

        // กรณี: isOpen = true
        // คาดหวัง: ต้องแสดง header, ช่องกรอกเบอร์โทร/รหัสผ่าน และปุ่มเข้าสู่ระบบ
        it("renders the modal content when isOpen is true", () => {
            render(<LoginModal isOpen={true} onClose={mockOnClose} />);

            expect(screen.getByText("เข้าสู่ระบบผู้สมัคร")).toBeInTheDocument();
            expect(screen.getByPlaceholderText("เบอร์โทรศัพท์")).toBeInTheDocument();
            expect(screen.getByPlaceholderText("รหัสผ่าน")).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: "เข้าสู่ระบบ" })
            ).toBeInTheDocument();
        });
    });

    describe("Closing interactions", () => {
        // กรณี: ผู้ใช้กดปุ่มปิด (ไอคอน X มุมขวาบน)
        // คาดหวัง: ต้องเรียก onClose
        it("calls onClose when the close (X) button is clicked", () => {
            render(<LoginModal isOpen={true} onClose={mockOnClose} />);

            // ปุ่มปิดคือปุ่มแรกสุดใน DOM (อยู่ก่อน form ทั้งหมด)
            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[0]);

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        // กรณี: ผู้ใช้คลิกที่พื้นหลังสีดำโปร่งแสง (overlay) นอกกล่อง modal
        // คาดหวัง: ต้องเรียก onClose เหมือนกดปุ่มปิด
        it("calls onClose when the overlay is clicked", () => {
            const { container } = render(
                <LoginModal isOpen={true} onClose={mockOnClose} />
            );

            const overlay = container.querySelector(".absolute.inset-0.bg-black\\/50");
            fireEvent.click(overlay!);

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        // กรณี: ผู้ใช้คลิกภายในตัวฟอร์ม (เช่น พิมพ์ในช่อง input)
        // คาดหวัง: ไม่ควรเรียก onClose เพราะไม่ได้คลิกโดน overlay หรือปุ่มปิด
        it("does not call onClose when clicking inside the form", () => {
            render(<LoginModal isOpen={true} onClose={mockOnClose} />);

            fireEvent.click(screen.getByPlaceholderText("เบอร์โทรศัพท์"));

            expect(mockOnClose).not.toHaveBeenCalled();
        });
    });

    describe("Phone validation", () => {
        // กรณี: เบอร์โทรว่าง แล้วผู้ใช้คลิกออกจากช่อง (blur)
        // คาดหวัง: แสดงข้อความ error "ระบุเบอร์โทรศัพท์"
        it("shows an error when phone is empty on blur", () => {
            render(<LoginModal isOpen={true} onClose={mockOnClose} />);

            const phoneInput = screen.getByPlaceholderText("เบอร์โทรศัพท์");
            fireEvent.blur(phoneInput);

            expect(screen.getByText("ระบุเบอร์โทรศัพท์")).toBeInTheDocument();
        });

        // กรณี: กรอกเบอร์โทรไม่ครบ 10 หลัก แล้ว blur
        // คาดหวัง: แสดงข้อความ error "กรุณาระบุเบอร์โทร 10 หลัก"
        it("shows an error when phone is not exactly 10 digits on blur", () => {
            render(<LoginModal isOpen={true} onClose={mockOnClose} />);

            const phoneInput = screen.getByPlaceholderText("เบอร์โทรศัพท์");
            fireEvent.change(phoneInput, { target: { value: "0812345" } });
            fireEvent.blur(phoneInput);

            expect(screen.getByText("กรุณาระบุเบอร์โทร 10 หลัก")).toBeInTheDocument();
        });

        // กรณี: ยังไม่ได้ blur ช่องเบอร์โทรเลย (touched = false)
        // คาดหวัง: แม้เบอร์โทรจะว่าง ก็ยังไม่ควรแสดง error ให้เห็น (โชว์ error เฉพาะหลัง blur เท่านั้น)
        it("does not show phone error before the field is touched", () => {
            render(<LoginModal isOpen={true} onClose={mockOnClose} />);
            expect(screen.queryByText("ระบุเบอร์โทรศัพท์")).not.toBeInTheDocument();
        });

        // กรณี: พิมพ์ตัวอักษรและสัญลักษณ์ปนกับตัวเลข เช่น "081-234-5678abc"
        // คาดหวัง: component ต้องกรองเหลือเฉพาะตัวเลข และตัดให้เหลือไม่เกิน 10 หลัก
        it("strips non-digit characters and limits input to 10 digits", () => {
            render(<LoginModal isOpen={true} onClose={mockOnClose} />);

            const phoneInput = screen.getByPlaceholderText(
                "เบอร์โทรศัพท์"
            ) as HTMLInputElement;
            fireEvent.change(phoneInput, { target: { value: "081-234-5678abc" } });

            expect(phoneInput.value).toBe("0812345678");
        });

        // กรณี: กรอกเบอร์โทรผิด, blur จนเกิด error, แล้วแก้ไขให้ถูกต้อง
        // คาดหวัง: error ต้องหายไปทันทีที่พิมพ์ค่าที่ถูกต้อง (re-validate ระหว่างพิมพ์หลัง touched แล้ว)
        it("clears the phone error once a valid value is typed after being touched", () => {
            render(<LoginModal isOpen={true} onClose={mockOnClose} />);

            const phoneInput = screen.getByPlaceholderText("เบอร์โทรศัพท์");
            fireEvent.blur(phoneInput); // touch ก่อนเพื่อให้เกิด error
            expect(screen.getByText("ระบุเบอร์โทรศัพท์")).toBeInTheDocument();

            fireEvent.change(phoneInput, { target: { value: "0812345678" } });
            expect(screen.queryByText("ระบุเบอร์โทรศัพท์")).not.toBeInTheDocument();
        });
    });

    describe("Password validation", () => {
        // กรณี: รหัสผ่านว่าง แล้ว blur
        // คาดหวัง: แสดงข้อความ error "ระบุรหัสผ่าน"
        it("shows an error when password is empty on blur", () => {
            render(<LoginModal isOpen={true} onClose={mockOnClose} />);

            const passwordInput = screen.getByPlaceholderText("รหัสผ่าน");
            fireEvent.blur(passwordInput);

            expect(screen.getByText("ระบุรหัสผ่าน")).toBeInTheDocument();
        });

        // กรณี: ผู้ใช้กดไอคอนรูปตา (toggle) ข้างช่องรหัสผ่าน
        // คาดหวัง: type ของ input ต้องสลับจาก "password" เป็น "text" (และสลับกลับได้เมื่อกดซ้ำ)
        it("toggles password visibility when the eye icon button is clicked", () => {
            render(<LoginModal isOpen={true} onClose={mockOnClose} />);

            const passwordInput = screen.getByPlaceholderText(
                "รหัสผ่าน"
            ) as HTMLInputElement;
            expect(passwordInput.type).toBe("password");

            // ปุ่ม toggle รหัสผ่านคือปุ่มลำดับที่ 2 ใน DOM (index 1): [close, toggle, ...]
            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[1]);
            expect(passwordInput.type).toBe("text");

            fireEvent.click(buttons[1]);
            expect(passwordInput.type).toBe("password");
        });
    });

    describe("Submit - validation blocking", () => {
        // กรณี: กดปุ่ม "เข้าสู่ระบบ" ทั้งที่ยังไม่ได้กรอกอะไรเลย
        // คาดหวัง: ต้องแสดง error ทั้งสองช่อง และห้ามยิง API loginIntern ออกไปเด็ดขาด
        it("shows both field errors and does not call loginIntern when form is empty", async () => {
            render(<LoginModal isOpen={true} onClose={mockOnClose} />);

            fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

            expect(await screen.findByText("ระบุเบอร์โทรศัพท์")).toBeInTheDocument();
            expect(screen.getByText("ระบุรหัสผ่าน")).toBeInTheDocument();
            expect(authApi.loginIntern).not.toHaveBeenCalled();
        });
    });

    describe("Submit - loading state", () => {
        // กรณี: ข้อมูลถูกต้องครบ และกำลังรอผล API loginIntern อยู่ (ยังไม่ resolve)
        // คาดหวัง: ปุ่มต้องเปลี่ยนข้อความเป็น "กำลังเข้าสู่ระบบ..." และถูก disable ไว้ระหว่างรอ
        it("shows loading text and disables the submit button while the request is pending", async () => {
            let resolveLogin: () => void = () => {};
            (authApi.loginIntern as jest.Mock).mockReturnValue(
                new Promise<void>((resolve) => {
                    resolveLogin = resolve;
                })
            );
            (authApi.getSession as jest.Mock).mockResolvedValue({ user: null });

            render(<LoginModal isOpen={true} onClose={mockOnClose} />);
            fillValidForm();
            fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

            const loadingBtn = await screen.findByText("กำลังเข้าสู่ระบบ...");
            expect(loadingBtn).toBeDisabled();

            // ปล่อยให้ promise resolve เพื่อไม่ให้ค้าง/รบกวน test ถัดไป
            resolveLogin();
            await waitFor(() => expect(mockOnClose).toHaveBeenCalled());
        });
    });

    describe("Submit - success flow", () => {
        // กรณี: login สำเร็จ และ getSession คืนค่า user มาให้
        // คาดหวัง: ต้องเรียก loginIntern ด้วยเบอร์โทร/รหัสผ่านที่กรอก, เก็บ user ด้วย authStorage.setUser,
        //           ปิด modal (onClose) และเรียก onLoginSuccess แทนการ router.push (เพราะส่ง prop นี้มา)
        it("logs in successfully, stores the session user, and calls onLoginSuccess when provided", async () => {
            (authApi.loginIntern as jest.Mock).mockResolvedValue({});
            (authApi.getSession as jest.Mock).mockResolvedValue({
                user: { id: "u1", phoneNumber: "0812345678" },
            });

            render(
                <LoginModal
                    isOpen={true}
                    onClose={mockOnClose}
                    onLoginSuccess={mockOnLoginSuccess}
                />
            );
            fillValidForm();
            fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

            await waitFor(() => {
                expect(authApi.loginIntern).toHaveBeenCalledWith({
                    phoneNumber: "0812345678",
                    password: "mypassword",
                });
            });
            expect(authStorage.setUser).toHaveBeenCalledWith({
                id: "u1",
                phoneNumber: "0812345678",
            });
            expect(mockOnClose).toHaveBeenCalledTimes(1);
            expect(mockOnLoginSuccess).toHaveBeenCalledTimes(1);
            expect(mockPush).not.toHaveBeenCalled();
        });

        // กรณี: login สำเร็จ แต่ไม่ได้ส่ง onLoginSuccess prop มา (ไม่มีการ redirect แบบกำหนดเอง)
        // คาดหวัง: ต้อง fallback ไปใช้ router.push ไปที่ redirectTo แทน
        it("redirects using router.push(redirectTo) when onLoginSuccess is not provided", async () => {
            (authApi.loginIntern as jest.Mock).mockResolvedValue({});
            (authApi.getSession as jest.Mock).mockResolvedValue({
                user: { id: "u1", phoneNumber: "0812345678" },
            });

            render(
                <LoginModal
                    isOpen={true}
                    onClose={mockOnClose}
                    redirectTo="/intern-home"
                />
            );
            fillValidForm();
            fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

            await waitFor(() => {
                expect(mockPush).toHaveBeenCalledWith("/intern-home");
            });
        });

        // กรณี: login สำเร็จ แต่ getSession ไม่คืน user กลับมา (session ว่างหรือ API พัง)
        // คาดหวัง: ต้อง fallback ไปเก็บข้อมูล user ชั่วคราว (id: "temp", roleId: 3) แทนการปล่อยว่าง
        it("stores a temporary user when getSession returns no user", async () => {
            (authApi.loginIntern as jest.Mock).mockResolvedValue({});
            (authApi.getSession as jest.Mock).mockResolvedValue({ user: null });

            render(<LoginModal isOpen={true} onClose={mockOnClose} />);
            fillValidForm();
            fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

            await waitFor(() => {
                expect(authStorage.setUser).toHaveBeenCalledWith(
                    expect.objectContaining({ id: "temp", roleId: 3 })
                );
            });
        });

        // กรณี: login สำเร็จ แต่ getSession โยน exception ออกมา (เช่น network error ตอนดึง session)
        // คาดหวัง: ต้อง fallback ไปเก็บข้อมูล user ชั่วคราวเหมือนกัน และห้าม throw ทำให้ flow ทั้งหมดพัง
        it("stores a temporary user when getSession throws", async () => {
            (authApi.loginIntern as jest.Mock).mockResolvedValue({});
            (authApi.getSession as jest.Mock).mockRejectedValue(new Error("network error"));

            render(<LoginModal isOpen={true} onClose={mockOnClose} />);
            fillValidForm();
            fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

            await waitFor(() => {
                expect(authStorage.setUser).toHaveBeenCalledWith(
                    expect.objectContaining({ id: "temp", roleId: 3 })
                );
            });
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });
    });

    describe("Submit - error flow", () => {
        // กรณี: loginIntern ล้มเหลว และ error object มี response.data.message มาจาก backend (เช่น axios error)
        // คาดหวัง: ต้องแสดงข้อความ error ตามที่ backend ส่งมาเป๊ะๆ และห้ามปิด modal
        it("shows the API error message when login fails with a response message", async () => {
            (authApi.loginIntern as jest.Mock).mockRejectedValue({
                response: { data: { message: "บัญชีผู้ใช้ถูกระงับ" } },
            });

            render(<LoginModal isOpen={true} onClose={mockOnClose} />);
            fillValidForm();
            fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

            expect(await screen.findByText("บัญชีผู้ใช้ถูกระงับ")).toBeInTheDocument();
            expect(mockOnClose).not.toHaveBeenCalled();
        });

        // กรณี: loginIntern ล้มเหลวแบบมี response แต่ไม่มี message ระบุมา
        // คาดหวัง: ต้องแสดงข้อความ default "เบอร์โทรศัพท์หรือรหัสผ่าน ไม่ถูกต้อง กรุณาระบุข้อมูลอีกครั้ง"
        it("shows the default invalid-credentials message when the API gives no message", async () => {
            (authApi.loginIntern as jest.Mock).mockRejectedValue({
                response: { data: {} },
            });

            render(<LoginModal isOpen={true} onClose={mockOnClose} />);
            fillValidForm();
            fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

            expect(
                await screen.findByText(
                    "เบอร์โทรศัพท์หรือรหัสผ่าน ไม่ถูกต้อง กรุณาระบุข้อมูลอีกครั้ง"
                )
            ).toBeInTheDocument();
        });

        // กรณี: loginIntern โยน error ที่ไม่ใช่รูปแบบ axios เลย (เช่น เป็นแค่ Error ธรรมดา/ปัญหาเครือข่าย)
        // คาดหวัง: ต้องแสดงข้อความ error ทั่วไป "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
        it("shows a generic error message when the thrown error has no response field", async () => {
            (authApi.loginIntern as jest.Mock).mockRejectedValue(new Error("network down"));

            render(<LoginModal isOpen={true} onClose={mockOnClose} />);
            fillValidForm();
            fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

            expect(
                await screen.findByText("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง")
            ).toBeInTheDocument();
        });

        // กรณี: login fail จนมี error message โชว์อยู่ แล้วผู้ใช้เริ่มพิมพ์เบอร์โทรใหม่
        // คาดหวัง: ข้อความ error จากการ login ต้องหายไปทันที (ไม่ค้างอยู่ให้สับสน)
        it("clears the login error message once the user starts typing again", async () => {
            (authApi.loginIntern as jest.Mock).mockRejectedValue(new Error("fail"));

            render(<LoginModal isOpen={true} onClose={mockOnClose} />);
            fillValidForm();
            fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

            expect(
                await screen.findByText("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง")
            ).toBeInTheDocument();

            fireEvent.change(screen.getByPlaceholderText("เบอร์โทรศัพท์"), {
                target: { value: "0898765432" },
            });

            expect(
                screen.queryByText("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง")
            ).not.toBeInTheDocument();
        });
    });

    describe("Navigation links", () => {
        // กรณี: ผู้ใช้กดลิงก์ "ลืมรหัสผ่าน"
        // คาดหวัง: ต้องปิด modal (onClose) และ redirect ไปหน้า /forgot-password
        it("closes the modal and navigates to /forgot-password", () => {
            render(<LoginModal isOpen={true} onClose={mockOnClose} />);

            fireEvent.click(screen.getByRole("button", { name: "ลืมรหัสผ่าน" }));

            expect(mockOnClose).toHaveBeenCalledTimes(1);
            expect(mockPush).toHaveBeenCalledWith("/forgot-password");
        });

        // กรณี: ผู้ใช้กดลิงก์ "ลงทะเบียนที่นี่"
        // คาดหวัง: ต้องปิด modal (onClose) และ redirect ไปหน้า /register
        it("closes the modal and navigates to /register", () => {
            render(<LoginModal isOpen={true} onClose={mockOnClose} />);

            fireEvent.click(screen.getByRole("button", { name: "ลงทะเบียนที่นี่" }));

            expect(mockOnClose).toHaveBeenCalledTimes(1);
            expect(mockPush).toHaveBeenCalledWith("/register");
        });
    });
});