import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// เป้าหมาย: ให้ coverage ครบ 100% ของ ThaiDateInput.tsx
// สิ่งที่ต้องไล่ให้ครบทุกเส้นทาง (branch) ในโค้ดจริง:
//
//   formatToThaiDisplay(dateStr):
//     1) if (!dateStr) return "";                     -> ต้องมีเคส value ว่าง
//     2) if (parts.length !== 3) return dateStr;       -> ต้องมีเคสรูปแบบวันที่ผิด
//     3) แปลงปี ค.ศ. -> พ.ศ. ปกติ                       -> ต้องมีเคสวันที่ถูกต้อง
//
//   JSX: `value ? formatToThaiDisplay(value) : ""`      -> ครอบคลุมด้วยเคสข้างบนอยู่แล้ว
//
//   handleClick:
//     dateInputRef.current?.showPicker?.();             -> ต้องมีทั้งเคส showPicker มีอยู่จริง
//                                                          และเคส browser ไม่รองรับ (undefined)
//     dateInputRef.current?.focus();                    -> ต้องเช็คว่าถูกเรียก
//
//   props ที่มีค่า default (placeholder, className):     -> ต้องมีเคสใช้ default และเคสส่งเองมา
//   prop min (optional):                                 -> ต้องมีเคสมีและไม่มี
// ---------------------------------------------------------------------------

import ThaiDateInput from "../ui/ThaiDateInput"; // แก้ path ให้ตรงกับตำแหน่งไฟล์จริงของคุณ

// jsdom (สภาพแวดล้อมจำลอง browser ของ Jest) ไม่รู้จักเมธอด showPicker() ของ <input type="date">
// เพราะเป็น API ใหม่ที่ browser จริงบางตัวเท่านั้นที่รองรับ เราจึงต้องเติมมันเข้าไปเองก่อนเทส
beforeEach(() => {
  // ใช้ `as any` แทน @ts-expect-error เพราะบางเวอร์ชันของไทป์ DOM มี showPicker
  // อยู่แล้ว (ทำให้ @ts-expect-error กลายเป็น error ซ้อน error) การ cast แบบนี้
  // ปลอดภัยกว่า เพราะใช้ได้ไม่ว่าไทป์ของ TypeScript เวอร์ชันไหนจะรู้จัก showPicker หรือไม่
  (HTMLInputElement.prototype as any).showPicker = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ThaiDateInput", () => {
  it("แสดงค่าว่างและ placeholder เริ่มต้นเมื่อ value เป็นสตริงว่าง", () => {
    render(<ThaiDateInput value="" onChange={jest.fn()} />);

    const visibleInput = screen.getByPlaceholderText(
      "วว/ดด/ปปปป",
    ) as HTMLInputElement;
    // ครอบคลุม branch: if (!dateStr) return "";
    expect(visibleInput.value).toBe("");
  });

  it("แปลงวันที่รูปแบบ YYYY-MM-DD เป็น DD/MM/พ.ศ. ได้ถูกต้อง", () => {
    render(<ThaiDateInput value="2024-01-15" onChange={jest.fn()} />);

    // ปี ค.ศ. 2024 + 543 = พ.ศ. 2567
    const visibleInput = screen.getByDisplayValue(
      "15/01/2567",
    ) as HTMLInputElement;
    expect(visibleInput).toBeInTheDocument();
    expect(visibleInput).toHaveAttribute("readonly");
  });

  it("แสดงค่าดิบตามเดิมโดยไม่แปลง เมื่อรูปแบบวันที่ผิดปกติ (ไม่ครบ 3 ส่วน)", () => {
    // ครอบคลุม branch: if (parts.length !== 3) return dateStr;
    render(<ThaiDateInput value="2024-01" onChange={jest.fn()} />);

    const visibleInput = screen.getByDisplayValue(
      "2024-01",
    ) as HTMLInputElement;
    expect(visibleInput).toBeInTheDocument();
  });

  it("ใช้ placeholder ที่กำหนดเองแทนค่า default เมื่อส่งเข้ามา", () => {
    render(
      <ThaiDateInput
        value=""
        onChange={jest.fn()}
        placeholder="เลือกวันที่"
      />,
    );

    expect(screen.getByPlaceholderText("เลือกวันที่")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("วว/ดด/ปปปป"),
    ).not.toBeInTheDocument();
  });

  it("ใส่ className ที่กำหนดเองให้กับ input ที่มองเห็นได้", () => {
    render(
      <ThaiDateInput value="" onChange={jest.fn()} className="my-custom-class" />,
    );

    const visibleInput = screen.getByPlaceholderText("วว/ดด/ปปปป");
    expect(visibleInput).toHaveClass("my-custom-class");
    // ต้องมี base class "cursor-pointer" ติดมาด้วยเสมอไม่ว่าจะส่ง className มาหรือไม่
    expect(visibleInput).toHaveClass("cursor-pointer");
  });

  it("ส่ง min ไปยัง native date input เมื่อกำหนดค่ามา", () => {
    const { container } = render(
      <ThaiDateInput value="" onChange={jest.fn()} min="2024-01-01" />,
    );

    const hiddenDateInput = container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    expect(hiddenDateInput).toHaveAttribute("min", "2024-01-01");
  });

  it("ไม่มี attribute min เมื่อไม่ได้กำหนด prop min มา", () => {
    const { container } = render(
      <ThaiDateInput value="" onChange={jest.fn()} />,
    );

    const hiddenDateInput = container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    expect(hiddenDateInput).not.toHaveAttribute("min");
  });

  it("native date input ซ่อนอยู่ (opacity-0) และ tabIndex เป็น -1 เพื่อไม่ให้ Tab โฟกัสไปเจอ", () => {
    const { container } = render(
      <ThaiDateInput value="" onChange={jest.fn()} />,
    );

    const hiddenDateInput = container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    expect(hiddenDateInput).toHaveClass("opacity-0");
    expect(hiddenDateInput).toHaveAttribute("tabindex", "-1");
  });

  it("เรียก onChange พร้อมค่าที่เลือกใหม่ เมื่อ native date input เปลี่ยนค่า", () => {
    const onChange = jest.fn();
    const { container } = render(
      <ThaiDateInput value="" onChange={onChange} />,
    );

    const hiddenDateInput = container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;

    fireEvent.change(hiddenDateInput, { target: { value: "2025-12-31" } });

    expect(onChange).toHaveBeenCalledWith("2025-12-31");
  });

  it("คลิกที่กล่อง input จะเรียก showPicker() และ focus() ของ native date input (เคส browser รองรับ showPicker)", async () => {
    const user = userEvent.setup();
    const showPickerSpy = jest.fn();
    (HTMLInputElement.prototype as any).showPicker = showPickerSpy;

    const { container } = render(
      <ThaiDateInput value="" onChange={jest.fn()} />,
    );

    const hiddenDateInput = container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    const focusSpy = jest.spyOn(hiddenDateInput, "focus");

    const visibleInput = screen.getByPlaceholderText("วว/ดด/ปปปป");
    await user.click(visibleInput);

    expect(showPickerSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it("คลิกที่กล่อง input ไม่พังและยัง focus() ได้ปกติ แม้ browser ไม่รองรับ showPicker (เคส optional chaining)", async () => {
    const user = userEvent.setup();
    // จำลองกรณี browser เก่าที่ไม่มีเมธอด showPicker เลย (เช่น Safari รุ่นเก่า)
    delete (HTMLInputElement.prototype as any).showPicker;

    const { container } = render(
      <ThaiDateInput value="" onChange={jest.fn()} />,
    );

    const hiddenDateInput = container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    const focusSpy = jest.spyOn(hiddenDateInput, "focus");

    const visibleInput = screen.getByPlaceholderText("วว/ดด/ปปปป");

    // ต้องไม่ throw error แม้ showPicker ไม่มีอยู่จริง (optional chaining ป้องกันไว้)
    await expect(user.click(visibleInput)).resolves.not.toThrow();
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });
});
