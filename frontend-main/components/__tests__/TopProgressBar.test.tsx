import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// TopProgressBar เป็นตัวที่ซับซ้อนที่สุดในบรรดาไฟล์ที่เทสมาทั้งหมด เพราะ:
//   1) ใช้ usePathname จาก next/navigation -> ต้อง mock และต้อง "เปลี่ยนค่า" ได้ระหว่างเทส
//   2) มี useEffect 2 ตัวทำงานคนละหน้าที่ (ตัวหนึ่งจับ pathname เปลี่ยน, อีกตัวดัก click ทั้งหน้า)
//   3) มี setTimeout ซ้อนกันหลายตัว (t1-t4) -> ต้องใช้ fake timers คุมเวลา
//   4) ใช้ document.addEventListener แบบ capture phase ("click" ที่ document ไม่ใช่ตัว component เอง)
//      -> ต้องจำลอง click จริงบน DOM แล้วปล่อยให้ event bubble ขึ้นไปโดน listener ที่ document
//
// จุดที่ต้องไล่ให้ครบเพื่อ coverage 100%:
//   - if (!visible && width === 0) return null;                -> ทั้งเคส null และเคสแสดงผล
//   - useEffect [pathname]: ทำงานทุกครั้งที่ pathname เปลี่ยน     -> ต้องเทสตอน mount และตอนเปลี่ยนหน้า
//   - handleClick: ทุกเงื่อนไข guard clause (!anchor, !href, #, http, mailto) -> ต้องมีครบทุกเคส
//   - handleClick: เคส href ปกติที่ผ่านทุกเงื่อนไข -> เริ่มแถบโหลด
//   - cleanup ของ useEffect (removeEventListener)                -> ต้องเทสตอน unmount
//   - transitionDuration: width === 100 ? ... : ...              -> ต้องมีทั้ง 2 ค่า
//
// สำคัญมาก: ทุกครั้งที่เรียก jest.advanceTimersByTime(...) ต้องห่อด้วย act(() => { ... })
// เพราะ setTimeout ข้างในไปเรียก setState (setWidth/setVisible) ถ้าไม่ห่อ act ไว้
// React จะยังอัปเดต DOM ไม่เสร็จตอนที่เราเช็คผลลัพธ์ทันที ทำให้เจอค่าเก่าค้างอยู่
// (ต่างจาก render() และ fireEvent.click() ที่ Testing Library ห่อ act() ให้อัตโนมัติอยู่แล้ว
// แต่ jest.advanceTimersByTime() เป็นฟังก์ชันของ Jest ไม่ใช่ของ Testing Library จึงไม่ได้ห่อให้)
// ---------------------------------------------------------------------------

const mockUsePathname = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

import TopProgressBar from "../ui/TopProgressBar"; // แก้ path ให้ตรงกับตำแหน่งไฟล์จริงของคุณ

// selector ช่วยหา progress bar ในหน้าเทส (ไม่มี text/role ให้จับ เพราะเป็นแค่แถบสี)
const getBar = (container: HTMLElement) =>
  container.querySelector(".fixed.top-0.left-0") as HTMLElement | null;

beforeEach(() => {
  jest.useFakeTimers();
  mockUsePathname.mockReturnValue("/หน้าแรก");
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe("TopProgressBar", () => {
  it("ตอน mount แถบจะวิ่งไป 100% ทันที (แต่โปร่งใสเพราะ visible ยังเป็น false)", () => {
    const { container } = render(<TopProgressBar />);

    const bar = getBar(container);
    expect(bar).not.toBeNull();
    expect(bar).toHaveStyle({ width: "100%", opacity: "0" });
  });

  it("ใช้ transitionDuration แบบเร็ว (0.2s, 0.3s) เมื่อ width เป็น 100 พอดี", () => {
    const { container } = render(<TopProgressBar />);

    const bar = getBar(container);
    expect(bar).toHaveStyle({ transitionDuration: "0.2s, 0.3s" });
  });

  it("หลังจากผ่านไป 350ms แถบจะซ่อนตัวเอง (visible=false, width=0) และไม่ render อะไรเลย", async () => {
    const { container } = render(<TopProgressBar />);

    act(() => { jest.advanceTimersByTime(350); });

    await waitFor(() => expect(getBar(container)).toBeNull());
  });

  it("เมื่อ pathname เปลี่ยน จะรีเซ็ตแถบกลับไปที่ 100% อีกครั้ง (จำลองการเปลี่ยนหน้าเสร็จ)", async () => {
    const { container, rerender } = render(<TopProgressBar />);

    // ปล่อยให้แถบซ่อนตัวไปก่อน (จบรอบแรก)
    act(() => { jest.advanceTimersByTime(350); });
    await waitFor(() => expect(getBar(container)).toBeNull());

    // จำลองว่าผู้ใช้เปลี่ยนไปหน้าใหม่ (usePathname คืนค่าใหม่)
    mockUsePathname.mockReturnValue("/หน้าที่สอง");
    rerender(<TopProgressBar />);

    expect(getBar(container)).toHaveStyle({ width: "100%", opacity: "0" });
  });

  it("คลิกลิงก์ภายใน (href ปกติ) จะเริ่มแถบโหลดด้วย width 15% และ visible=true", () => {
    const { container } = render(
      <div>
        <TopProgressBar />
        <a href="/สมัครงาน">ไปหน้าสมัครงาน</a>
      </div>,
    );

    fireEvent.click(document.querySelector("a")!);

    const bar = getBar(container);
    expect(bar).toHaveStyle({ width: "15%", opacity: "1" });
  });

  it("ใช้ transitionDuration แบบช้า (0.4s, 0.1s) เมื่อ width ไม่ใช่ 100 (เช่นตอนกำลังโหลด)", () => {
    const { container } = render(
      <div>
        <TopProgressBar />
        <a href="/สมัครงาน">ไปหน้าสมัครงาน</a>
      </div>,
    );

    fireEvent.click(document.querySelector("a")!);

    expect(getBar(container)).toHaveStyle({ transitionDuration: "0.4s, 0.1s" });
  });

  it("แถบโหลดขยับความกว้างขึ้นเรื่อยๆ ตามลำดับเวลา 100ms/300ms/600ms/1000ms หลังคลิก", () => {
    const { container } = render(
      <div>
        <TopProgressBar />
        <a href="/สมัครงาน">ไปหน้าสมัครงาน</a>
      </div>,
    );

    fireEvent.click(document.querySelector("a")!);
    expect(getBar(container)).toHaveStyle({ width: "15%" });

    act(() => { jest.advanceTimersByTime(100); });
    expect(getBar(container)).toHaveStyle({ width: "40%" });

    act(() => { jest.advanceTimersByTime(200); }); // รวม 300ms
    expect(getBar(container)).toHaveStyle({ width: "65%" });

    act(() => { jest.advanceTimersByTime(300); }); // รวม 600ms
    expect(getBar(container)).toHaveStyle({ width: "80%" });

    act(() => { jest.advanceTimersByTime(400); }); // รวม 1000ms
    expect(getBar(container)).toHaveStyle({ width: "90%" });
  });

  it("คลิกที่ element ซึ่งไม่ได้อยู่ใน <a> เลย จะไม่ทำอะไร (ไม่มี anchor ให้เจอ)", () => {
    const { container } = render(
      <div>
        <TopProgressBar />
        <button>ปุ่มธรรมดา ไม่ใช่ลิงก์</button>
      </div>,
    );

    // รอให้แถบตอน mount ซ่อนตัวไปก่อน จะได้เช็คสถานะ "ไม่มีอะไรเกิดขึ้น" ได้ชัดเจน
    act(() => { jest.advanceTimersByTime(350); });

    fireEvent.click(document.querySelector("button")!);

    expect(getBar(container)).toBeNull();
  });

  it("คลิกที่ <a> ซึ่งไม่มี attribute href เลย จะไม่ทำอะไร", () => {
    const { container } = render(
      <div>
        <TopProgressBar />
        <a>ลิงก์ที่ไม่มี href</a>
      </div>,
    );

    act(() => { jest.advanceTimersByTime(350); });

    fireEvent.click(document.querySelector("a")!);

    expect(getBar(container)).toBeNull();
  });

  it("คลิกลิงก์ที่เป็น anchor ภายในหน้าเดียวกัน (href ขึ้นต้นด้วย #) จะไม่ทำอะไร", () => {
    const { container } = render(
      <div>
        <TopProgressBar />
        <a href="#section-2">ไปยังหัวข้อ 2</a>
      </div>,
    );

    act(() => { jest.advanceTimersByTime(350); });

    fireEvent.click(document.querySelector("a")!);

    expect(getBar(container)).toBeNull();
  });

  it("คลิกลิงก์ภายนอก (href ขึ้นต้นด้วย http) จะไม่ทำอะไร", () => {
    const { container } = render(
      <div>
        <TopProgressBar />
        <a href="https://example.com">ลิงก์ภายนอก</a>
      </div>,
    );

    act(() => { jest.advanceTimersByTime(350); });

    fireEvent.click(document.querySelector("a")!);

    expect(getBar(container)).toBeNull();
  });

  it("คลิกลิงก์อีเมล (href ขึ้นต้นด้วย mailto) จะไม่ทำอะไร", () => {
    const { container } = render(
      <div>
        <TopProgressBar />
        <a href="mailto:test@example.com">ส่งอีเมล</a>
      </div>,
    );

    act(() => { jest.advanceTimersByTime(350); });

    fireEvent.click(document.querySelector("a")!);

    expect(getBar(container)).toBeNull();
  });

  it("คลิกที่ element ลูกข้างในลิงก์ (เช่น <span> ใน <a>) ยังคงหาเจอ anchor ที่ห่อไว้ได้ (closest)", () => {
    const { container } = render(
      <div>
        <TopProgressBar />
        <a href="/สมัครงาน">
          <span>ข้อความข้างในลิงก์</span>
        </a>
      </div>,
    );

    fireEvent.click(document.querySelector("span")!);

    expect(getBar(container)).toHaveStyle({ width: "15%", opacity: "1" });
  });

  it("ถอด event listener ออกจาก document ตอน component unmount", () => {
    const removeSpy = jest.spyOn(document, "removeEventListener");

    const { unmount } = render(<TopProgressBar />);
    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      "click",
      expect.any(Function),
      true,
    );
  });

  it("คลิกลิงก์ใหม่ระหว่างที่แถบเก่ากำลังวิ่งอยู่ จะล้าง timer เก่าและเริ่มใหม่ (clearTimers ทำงาน)", () => {
    const { container } = render(
      <div>
        <TopProgressBar />
        <a href="/หน้าแรก">ลิงก์ที่ 1</a>
        <a href="/หน้าที่สอง">ลิงก์ที่ 2</a>
      </div>,
    );

    const [link1, link2] = document.querySelectorAll("a");

    fireEvent.click(link1);
    act(() => { jest.advanceTimersByTime(100); }); // width ควรขยับไป 40% แล้ว

    // คลิกลิงก์ที่สองก่อนที่ตัวแรกจะวิ่งจบ ต้องรีเซ็ตกลับไปเริ่มที่ 15% ใหม่
    fireEvent.click(link2);
    expect(getBar(container)).toHaveStyle({ width: "15%" });

    // ถ้า timer เก่าไม่ถูกล้างจริง width อาจกระโดดผิดจังหวะ (เช่นค้างที่ 40% จาก timer เก่า)
    // เร่งเวลาต่ออีกหน่อยเพื่อยืนยันว่าลำดับเวลาชุดใหม่ทำงานถูกต้องตามรอบใหม่
    act(() => { jest.advanceTimersByTime(100); });
    expect(getBar(container)).toHaveStyle({ width: "40%" });
  });
});
