import React from "react";
import { render, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// เวอร์ชันนี้ต่างจากรอบแรกตรงที่เรา "คุมเวลาการเรียก animate() เอง" ได้
// แทนที่จะปล่อยให้ requestAnimationFrame เงียบไปเฉยๆ (ซึ่งทำให้โค้ดข้างใน animate()
// ไม่เคยถูกรันเลยสักครั้ง -> coverage ต่ำ) เราจะเก็บ callback ที่ถูกส่งเข้ามาไว้ในคิว
// แล้วมีฟังก์ชัน flushNextFrame(timestamp) ให้ "สั่งรัน" เฟรมนั้นด้วยเวลาที่เรากำหนดเอง
//
// จุดที่ต้องไล่ให้ครบเพื่อ coverage 100%:
//   - if (!canvas) return;  และ if (!ctx) return;      -> เงื่อนไข guard ที่ปกติไม่เกิดขึ้นจริง
//                                                          ต้องใช้การ mock แบบพิเศษเพื่อจำลอง
//   - shape === "rect" ? fillRect() : (arc + fill)      -> ต้องมีทั้ง 2 เคส
//   - if (elapsed > fadeStart) ปรับ opacity             -> ต้องมีทั้งเคสยังไม่ถึงและเคสเลยแล้ว
//   - if (elapsed < duration) ขอเฟรมถัดไป               -> ต้องมีทั้งเคสขอต่อและเคสหยุด (จบแอนิเมชัน)
// ---------------------------------------------------------------------------

import Confetti from "../ui/Confetti"; // แก้ path ให้ตรงกับตำแหน่งไฟล์จริงของคุณ

function createFakeCtx() {
  return {
    clearRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    fillRect: jest.fn(),
    fillStyle: "",
    globalAlpha: 1,
  };
}

let fakeCtx: ReturnType<typeof createFakeCtx>;
// คิวเก็บ callback ที่รอเรียก (จำลองคิวเฟรมแอนิเมชันของ browser จริง)
let rafQueue: FrameRequestCallback[];

// เรียกใช้เพื่อ "รัน" เฟรมถัดไปในคิว ด้วยเวลา (timestamp) ที่เรากำหนดเอง
// เวลานี้จะกลายเป็นค่า `now` ที่ถูกส่งเข้าไปในฟังก์ชัน animate(now) ของ component จริง
function flushNextFrame(timestamp: number) {
  const cb = rafQueue.shift();
  if (cb) {
    act(() => {
      cb(timestamp);
    });
  }
}

beforeEach(() => {
  fakeCtx = createFakeCtx();
  rafQueue = [];

  HTMLCanvasElement.prototype.getContext = jest.fn(() => fakeCtx) as any;

  window.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  }) as any;
  window.cancelAnimationFrame = jest.fn();

  // ทำให้เวลาเริ่มต้น (startTimeRef) เป็น 0 เสมอ เพื่อให้ timestamp ที่เราส่งเข้า flushNextFrame
  // มีความหมายตรงกับค่า "elapsed" ในโค้ดจริงพอดี (elapsed = now - startTimeRef.current)
  jest.spyOn(performance, "now").mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe("Confetti", () => {
  it("ไม่ render canvas เลยเมื่อ isActive={false}", () => {
    const { container } = render(<Confetti isActive={false} />);
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
  });

  it("render <canvas> เต็มจอเมื่อ isActive={true}", () => {
    const { container } = render(<Confetti isActive={true} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveClass("fixed", "inset-0", "pointer-events-none");
    expect(canvas).toHaveStyle({ zIndex: "100" });
  });

  it("ตั้งขนาด canvas ให้เท่ากับขนาดหน้าจอตอนเริ่มทำงาน", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { writable: true, value: 768 });

    const { container } = render(<Confetti isActive={true} />);
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;

    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(768);
  });

  it("ผูก event listener 'resize' ไว้กับ window ตอน active", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    render(<Confetti isActive={true} />);
    expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("เคลียร์ animation frame และ resize listener ตอน unmount", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const { unmount } = render(<Confetti isActive={true} />);
    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("เมื่อ isActive เปลี่ยนจาก true เป็น false จะเอา canvas ออกจาก DOM และยกเลิก animation", () => {
    const { container, rerender } = render(<Confetti isActive={true} />);
    expect(container.querySelector("canvas")).toBeInTheDocument();

    rerender(<Confetti isActive={false} />);

    expect(container.querySelector("canvas")).not.toBeInTheDocument();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // ส่วนที่เพิ่มใหม่: บังคับให้ animate() ทำงานจริง เพื่อไล่ coverage ในนั้นให้ครบ
  // -------------------------------------------------------------------------

  it("วาดอนุภาคทรงสี่เหลี่ยม (fillRect) เมื่อ shape เป็น 'rect'", () => {
    // บังคับให้ Math.random() คืนค่า > 0.5 เสมอ ทำให้ shape ทุกอนุภาคเป็น 'rect' แน่นอน
    // (ไม่ใช่การพึ่งพาโชค แต่บังคับผลลัพธ์ให้แน่นอน 100% ไม่มี flaky test)
    jest.spyOn(Math, "random").mockReturnValue(0.9);

    render(<Confetti isActive={true} duration={4000} />);
    flushNextFrame(0); // จำลองเฟรมแรกที่เวลาผ่านไป 0ms

    expect(fakeCtx.fillRect).toHaveBeenCalled();
    expect(fakeCtx.beginPath).not.toHaveBeenCalled();
    expect(fakeCtx.arc).not.toHaveBeenCalled();
  });

  it("วาดอนุภาคทรงวงกลม (beginPath + arc + fill) เมื่อ shape เป็น 'circle'", () => {
    // บังคับให้ Math.random() คืนค่า <= 0.5 เสมอ ทำให้ shape ทุกอนุภาคเป็น 'circle' แน่นอน
    jest.spyOn(Math, "random").mockReturnValue(0.1);

    render(<Confetti isActive={true} duration={4000} />);
    flushNextFrame(0);

    expect(fakeCtx.beginPath).toHaveBeenCalled();
    expect(fakeCtx.arc).toHaveBeenCalled();
    expect(fakeCtx.fill).toHaveBeenCalled();
    expect(fakeCtx.fillRect).not.toHaveBeenCalled();
  });

  it("เรียก ctx.clearRect, save, translate, rotate ทุกเฟรมที่วาด", () => {
    render(<Confetti isActive={true} duration={4000} />);
    flushNextFrame(0);

    expect(fakeCtx.clearRect).toHaveBeenCalled();
    expect(fakeCtx.save).toHaveBeenCalled();
    expect(fakeCtx.translate).toHaveBeenCalled();
    expect(fakeCtx.rotate).toHaveBeenCalled();
    expect(fakeCtx.restore).toHaveBeenCalled();
  });

  it("ไม่ปรับ opacity ของอนุภาคเมื่อยังไม่ถึง fadeStart (60% ของ duration)", () => {
    render(<Confetti isActive={true} duration={1000} />);
    // fadeStart = 1000 * 0.6 = 600, ส่งเวลาผ่านไปแค่ 300ms (ยังไม่ถึง fadeStart)
    flushNextFrame(300);

    // opacity เริ่มต้นของทุกอนุภาคคือ 1 และยังไม่ถูกแก้ไข เพราะยังไม่เข้าเงื่อนไข fade
    expect(fakeCtx.globalAlpha).toBe(1);
  });

  it("ปรับ opacity ของอนุภาคลดลงเมื่อเวลาผ่าน fadeStart แล้ว", () => {
    render(<Confetti isActive={true} duration={1000} />);
    // fadeStart = 600, ส่งเวลา 700ms (ผ่าน fadeStart ไปแล้ว 100ms จากช่วง fade ทั้งหมด 400ms)
    // สูตร: 1 - (700-600)/(1000-600) = 1 - 100/400 = 0.75
    flushNextFrame(700);

    expect(fakeCtx.globalAlpha).toBeCloseTo(0.75);
  });

  it("ขอเฟรมแอนิเมชันถัดไปต่อเนื่อง เมื่อเวลายังไม่ครบ duration", () => {
    render(<Confetti isActive={true} duration={4000} />);
    const callsBefore = (window.requestAnimationFrame as jest.Mock).mock.calls
      .length; // มี 1 ครั้งจากตอน mount

    flushNextFrame(0); // elapsed (0) < duration (4000) -> ต้องขอเฟรมถัดไปอีก

    const callsAfter = (window.requestAnimationFrame as jest.Mock).mock.calls
      .length;
    expect(callsAfter).toBe(callsBefore + 1);
  });

  it("หยุดขอเฟรมแอนิเมชันถัดไป เมื่อเวลาผ่านไปครบ duration แล้ว", () => {
    render(<Confetti isActive={true} duration={500} />);
    const callsBefore = (window.requestAnimationFrame as jest.Mock).mock.calls
      .length;

    flushNextFrame(500); // elapsed (500) >= duration (500) -> ไม่ขอเฟรมถัดไปอีกแล้ว

    const callsAfter = (window.requestAnimationFrame as jest.Mock).mock.calls
      .length;
    expect(callsAfter).toBe(callsBefore);
  });

  // -------------------------------------------------------------------------
  // เงื่อนไข guard ที่ปกติไม่มีทาง "เกิดขึ้นจริง" ระหว่างใช้งานแอปจริง
  // (canvasRef.current หรือ ctx เป็น null) แต่โค้ดกันไว้เผื่อไว้เพื่อความปลอดภัย
  // เราจำลองสถานการณ์นี้ผ่านการ mock แบบพิเศษ เพื่อให้ coverage ครบ 100%
  // -------------------------------------------------------------------------

  it("guard: ไม่ทำอะไรเลยเมื่อ getContext('2d') คืนค่า null (browser ไม่รองรับ canvas 2D)", () => {
    (HTMLCanvasElement.prototype.getContext as jest.Mock).mockReturnValueOnce(
      null,
    );

    render(<Confetti isActive={true} />);

    // ถ้าโค้ด return ออกไปตั้งแต่ก่อนถึงจุด requestAnimationFrame ตัวนี้ต้องไม่ถูกเรียกเลย
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // หมายเหตุ: เดิมมีเทสพยายามจำลอง canvasRef.current เป็น null (guard ที่ไม่เกิดขึ้นจริง)
  // แต่เอาออกแล้ว เพราะทำไม่ได้จริงในทางเทคนิค: React จะเขียนทับค่าใน ref object
  // ด้วย DOM node จริงระหว่างขั้นตอน commit เสมอ ไม่ว่าเราจะ mock useRef ให้คืนอะไรมาก็ตาม
  // (ref.current ถูกกำหนดค่าจาก React reconciler โดยตรง ไม่ใช่จากค่าเริ่มต้นที่ useRef คืนมา)
  //
  // วิธีแก้ที่ถูกต้องคือไปเพิ่มคอมเมนต์ `/* istanbul ignore if */` ไว้เหนือบรรทัด
  // `if (!canvas) return;` ในไฟล์ Confetti.tsx (ไฟล์ต้นฉบับ ไม่ใช่ไฟล์เทส) แทน
  // เพื่อบอกเครื่องมือวัด coverage ว่าบรรทัดนี้เป็นโค้ดป้องกันที่ทดสอบไม่ได้จริงโดยเจตนา
  // -------------------------------------------------------------------------
});
