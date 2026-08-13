import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// VideoLoading เป็น component แบบง่ายที่สุดในบรรดาไฟล์ที่เทสมาทั้งหมด:
//   - ไม่มี state, ไม่มี useEffect, ไม่มี event handler ใดๆ เลย
//   - เป็นแค่ "รับ props แล้ว render ตามเงื่อนไข"
// จุดที่ต้องไล่ให้ครบเพื่อ coverage 100%:
//   - message default vs กำหนดเอง vs ค่าว่าง (เงื่อนไข `{message && <p>...}`)
//   - fullScreen default (false) vs true (if-else คนละ return)
// ---------------------------------------------------------------------------

// mock next/image เหมือนที่เคยทำใน AdminNavbar.test.tsx เพราะ next/image
// ต้องใช้ Next.js image optimizer จริงตอนรัน ซึ่งไม่มีในสภาพแวดล้อมเทส
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ fill, priority, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img alt={alt} {...props} />;
  },
}));

import VideoLoading from "../ui/VideoLoading"; // แก้ path ให้ตรงกับตำแหน่งไฟล์จริงของคุณ

describe("VideoLoading", () => {
  it("แสดงข้อความ default 'กำลังโหลดข้อมูล...' เมื่อไม่ได้กำหนด message มา", () => {
    render(<VideoLoading />);

    expect(screen.getByText("กำลังโหลดข้อมูล...")).toBeInTheDocument();
  });

  it("แสดงข้อความที่กำหนดเองแทนค่า default เมื่อส่ง message เข้ามา", () => {
    render(<VideoLoading message="กำลังสลับบทบาท..." />);

    expect(screen.getByText("กำลังสลับบทบาท...")).toBeInTheDocument();
    expect(
      screen.queryByText("กำลังโหลดข้อมูล..."),
    ).not.toBeInTheDocument();
  });

  it("ไม่แสดงข้อความใดๆ เลยเมื่อส่ง message เป็นสตริงว่าง", () => {
    const { container } = render(<VideoLoading message="" />);

    // ครอบคลุม branch: {message && <p>...}  เมื่อ message เป็น falsy ("")
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("แสดงรูปโลโก้ตรงกลางวงแหวนหมุนเสมอ ไม่ว่า props อื่นจะเป็นอะไร", () => {
    render(<VideoLoading />);

    expect(screen.getByAltText("Loading")).toBeInTheDocument();
  });

  it("render เป็น container ธรรมดาแบบ inline เมื่อ fullScreen เป็นค่า default (false)", () => {
    const { container } = render(<VideoLoading />);

    // เคส inline: ต้องไม่มี class "fixed" (ซึ่งเป็นตัวบ่งบอกโหมด fullscreen overlay)
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv).not.toHaveClass("fixed");
    expect(outerDiv).toHaveStyle({ minHeight: "calc(100vh - 5rem)" });
  });

  it("render เป็น overlay เต็มจอเมื่อ fullScreen={true}", () => {
    const { container } = render(<VideoLoading fullScreen={true} />);

    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv).toHaveClass("fixed");
    expect(outerDiv).toHaveClass("inset-0");
    expect(outerDiv).toHaveClass("backdrop-blur-sm");
  });

  it("ยังคงแสดงข้อความและรูปเหมือนเดิม แม้ตั้ง fullScreen={true}", () => {
    render(<VideoLoading message="กำลังโหลด..." fullScreen={true} />);

    expect(screen.getByText("กำลังโหลด...")).toBeInTheDocument();
    expect(screen.getByAltText("Loading")).toBeInTheDocument();
  });
});
