import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// เป้าหมาย: coverage 100% ของ Toast.tsx
// จุดที่ต้องไล่ให้ครบ:
//   1) if (!isVisible) return null;              -> เคส true และ false
//   2) useEffect ตั้ง setTimeout แล้วเรียก onClose -> ต้องเทสว่าเวลาผ่านไปครบแล้วเรียกจริง
//   3) useEffect cleanup (clearTimeout)            -> ต้องเทสว่า unmount ก่อนครบเวลาแล้ว onClose ไม่ถูกเรียก
//   4) bgColor ternary ซ้อน 3 ทาง (success/error/info) -> ต้องมีครบทั้ง 3 ค่า
//   5) icon ternary ซ้อน 3 ทาง (เหมือนกับข้อ 4)     -> คลุมไปพร้อมกันอัตโนมัติ
//   6) bottomOffset default ("bottom-6") vs กำหนดเอง -> ต้องมีทั้ง 2 เคส
//   7) ปุ่มปิด (X) เรียก onClose ทันทีเมื่อคลิก      -> ไม่ต้องรอ timer
// ---------------------------------------------------------------------------

import Toast from "../ui/Toast"; // แก้ path ให้ตรงกับตำแหน่งไฟล์จริงของคุณ

// เพราะ component นี้ใช้ setTimeout จริง เราจึงต้องคุมเวลาเอง (fake timers)
// ไม่งั้นเทสต้องรอ 3 วินาทีจริงทุกครั้งที่รัน ซึ่งช้ามากและไม่แน่นอน
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("Toast", () => {
  it("ไม่ render อะไรเลยเมื่อ isVisible={false}", () => {
    const { container } = render(
      <Toast message="ทดสอบ" isVisible={false} onClose={jest.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("แสดงข้อความที่ส่งมาเมื่อ isVisible={true}", () => {
    render(
      <Toast message="บันทึกสำเร็จ" isVisible={true} onClose={jest.fn()} />,
    );

    expect(screen.getByText("บันทึกสำเร็จ")).toBeInTheDocument();
  });

  it("ใช้สีเขียวเป็นค่าเริ่มต้นเมื่อไม่ได้กำหนด type (type='success' โดย default)", () => {
    const { container } = render(
      <Toast message="ข้อความ" isVisible={true} onClose={jest.fn()} />,
    );

    expect(container.querySelector(".bg-green-600")).toBeInTheDocument();
  });

  it("ใช้สีแดงเมื่อ type='error'", () => {
    const { container } = render(
      <Toast
        message="ผิดพลาด"
        isVisible={true}
        onClose={jest.fn()}
        type="error"
      />,
    );

    expect(container.querySelector(".bg-red-600")).toBeInTheDocument();
  });

  it("ใช้สี primary เมื่อ type='info'", () => {
    const { container } = render(
      <Toast
        message="แจ้งให้ทราบ"
        isVisible={true}
        onClose={jest.fn()}
        type="info"
      />,
    );

    expect(container.querySelector(".bg-primary-600")).toBeInTheDocument();
  });

  it("ใช้ตำแหน่ง bottom-6 เป็นค่าเริ่มต้นเมื่อไม่ได้กำหนด bottomOffset", () => {
    const { container } = render(
      <Toast message="ข้อความ" isVisible={true} onClose={jest.fn()} />,
    );

    expect(container.querySelector(".bottom-6")).toBeInTheDocument();
  });

  it("ใช้ตำแหน่งที่กำหนดเองเมื่อส่ง bottomOffset เข้ามา", () => {
    const { container } = render(
      <Toast
        message="ข้อความ"
        isVisible={true}
        onClose={jest.fn()}
        bottomOffset="bottom-24 lg:bottom-6"
      />,
    );

    expect(container.querySelector(".bottom-24")).toBeInTheDocument();
    // ต้องไม่ใช้ค่า default "bottom-6" เดี่ยวๆ ปนมาด้วย เพราะถูกแทนที่ทั้งสตริงแล้ว
    expect(container.querySelector(".bottom-6")).not.toBeInTheDocument();
  });

  it("คลิกปุ่มปิด (X) จะเรียก onClose ทันที โดยไม่ต้องรอครบเวลา", async () => {
    // ต้องสลับไปใช้ user event แบบ real timer เพราะ userEvent ภายในใช้ setTimeout ของตัวเองในการหน่วงจังหวะคลิก
    jest.useRealTimers();
    const user = userEvent.setup();
    const onClose = jest.fn();

    render(<Toast message="ข้อความ" isVisible={true} onClose={onClose} />);

    // ปุ่มปิดเป็นปุ่มเดียวในหน้านี้
    await user.click(screen.getByRole("button"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("เรียก onClose อัตโนมัติเมื่อเวลาผ่านไปครบตาม duration ที่กำหนด", () => {
    const onClose = jest.fn();

    render(
      <Toast
        message="ข้อความ"
        isVisible={true}
        onClose={onClose}
        duration={2000}
      />,
    );

    expect(onClose).not.toHaveBeenCalled();

    // เร่งเวลาให้ผ่านไป 2000ms ตามที่กำหนดไว้ใน duration
    jest.advanceTimersByTime(2000);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ใช้ duration ค่าเริ่มต้น 3000ms เมื่อไม่ได้กำหนด duration มา", () => {
    const onClose = jest.fn();

    render(<Toast message="ข้อความ" isVisible={true} onClose={onClose} />);

    // เวลาผ่านไปแค่ 2999ms ยังไม่ครบ ต้องยังไม่ถูกเรียก
    jest.advanceTimersByTime(2999);
    expect(onClose).not.toHaveBeenCalled();

    // ผ่านไปอีก 1ms รวมเป็น 3000ms พอดี ต้องถูกเรียกแล้ว
    jest.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ยกเลิก timer (clearTimeout) เมื่อ unmount ก่อนครบเวลา เพื่อไม่ให้เรียก onClose ซ้อนหลัง unmount", () => {
    const onClose = jest.fn();

    const { unmount } = render(
      <Toast
        message="ข้อความ"
        isVisible={true}
        onClose={onClose}
        duration={3000}
      />,
    );

    // unmount ก่อนที่เวลาจะครบ (ผ่านไปแค่ 1000ms จาก 3000ms)
    jest.advanceTimersByTime(1000);
    unmount();

    // เร่งเวลาต่อจนเกิน duration เดิมไปมาก ถ้า cleanup ทำงานถูกต้อง onClose ต้องไม่ถูกเรียกเลย
    jest.advanceTimersByTime(5000);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("ไม่ตั้ง timer เมื่อ isVisible={false} (ผ่านไปนานแค่ไหน onClose ก็ไม่ถูกเรียก)", () => {
    const onClose = jest.fn();

    render(
      <Toast message="ข้อความ" isVisible={false} onClose={onClose} />,
    );

    jest.advanceTimersByTime(10000);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("ตั้ง timer ใหม่เมื่อ isVisible เปลี่ยนจาก false เป็น true", () => {
    const onClose = jest.fn();

    const { rerender } = render(
      <Toast
        message="ข้อความ"
        isVisible={false}
        onClose={onClose}
        duration={1000}
      />,
    );

    jest.advanceTimersByTime(5000);
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Toast
        message="ข้อความ"
        isVisible={true}
        onClose={onClose}
        duration={1000}
      />,
    );

    jest.advanceTimersByTime(1000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
