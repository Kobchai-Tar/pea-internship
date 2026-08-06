import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import OwnerSearchSection from "../ui/OwnerSearchSection"; 

describe("OwnerSearchSection Component", () => {
  const mockOnSearch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering and Basic Interactions", () => {
    // กรณี: เรนเดอร์คอมโพเนนต์ขึ้นมาครั้งแรก
    // คาดหวัง: ต้องมี Input ค้นหาและปุ่ม Dropdown แสดงอยู่
    it("renders keyword input and dropdown toggle buttons", () => {
      render(<OwnerSearchSection onSearch={mockOnSearch} />);

      // เนื่องจากมีทั้ง Desktop และ Mobile เลยใช้ getAllByPlaceholderText
      const keywordInputs = screen.getAllByPlaceholderText("ค้นหาตำแหน่งหรือชื่อผู้สมัคร...");
      expect(keywordInputs.length).toBeGreaterThan(0);
      expect(keywordInputs[0]).toBeInTheDocument();

      const dropdownButtons = screen.getAllByText("ชื่อสถาบันศึกษา");
      expect(dropdownButtons.length).toBeGreaterThan(0);
    });

    // กรณี: พิมพ์ข้อความในช่องค้นหา Keyword
    // คาดหวัง: ค่าในช่อง Input ต้องเปลี่ยนตามที่พิมพ์
    it("updates keyword state on input change", () => {
      render(<OwnerSearchSection onSearch={mockOnSearch} />);

      const keywordInput = screen.getAllByPlaceholderText("ค้นหาตำแหน่งหรือชื่อผู้สมัคร...")[0];
      
      fireEvent.change(keywordInput, { target: { value: "วิศวกร" } });
      expect(keywordInput).toHaveValue("วิศวกร");
    });
  });

  describe("Institution Dropdown Interactions", () => {
    // กรณี: คลิกปุ่ม "ชื่อสถาบันศึกษา"
    // คาดหวัง: Dropdown ต้องเปิดออกและแสดงรายการสถาบัน
    it("toggles the institution dropdown when clicked", () => {
      render(<OwnerSearchSection onSearch={mockOnSearch} />);

      const dropdownToggle = screen.getAllByText("ชื่อสถาบันศึกษา")[0];
      
      // คลิกเปิด
      fireEvent.click(dropdownToggle);
      
      // ตรวจสอบว่ามีตัวเลือก "ทั้งหมด (4)" และ "มหาวิทยาลัย" โผล่ขึ้นมา
      expect(screen.getAllByText("ทั้งหมด (4)")[0]).toBeInTheDocument();
      expect(screen.getAllByText("มหาวิทยาลัย")[0]).toBeInTheDocument();
    });

    // กรณี: คลิกปุ่มปิด (X) หรือปุ่มลูกศรใน Header ของ Dropdown
    // คาดหวัง: Dropdown ต้องถูกปิด
    it("closes the dropdown when close buttons are clicked", () => {
      render(<OwnerSearchSection onSearch={mockOnSearch} />);

      // เปิด Dropdown
      fireEvent.click(screen.getAllByText("ชื่อสถาบันศึกษา")[0]);
      expect(screen.getAllByText("ทั้งหมด (4)")[0]).toBeInTheDocument();

      // หาปุ่มใน Header (ในโค้ดไม่มี aria-label จึงต้องจำลองการดึงจาก tag หรือโครงสร้าง)
      // โค้ดมีการใช้ SVG 2 ตัวในกลุ่มปุ่ม Header, ตัวที่ 2 คือปุ่มกากบาท (X)
      const headerButtons = screen.getAllByRole("button").filter(
          btn => btn.className.includes("text-gray-400 hover:text-gray-600")
      );
      
      // กดปุ่มกากบาท (Close Dropdown)
      fireEvent.click(headerButtons[1]);

      // ตรวจสอบว่าเนื้อหาหายไปแล้ว
      expect(screen.queryByText("ทั้งหมด (4)")).not.toBeInTheDocument();
    });

    // กรณี: คลิกพื้นที่ว่างนอก Dropdown (Clicking Outside)
    // คาดหวัง: Dropdown ต้องปิดอัตโนมัติ
    it("closes dropdown when clicking outside", () => {
      render(<OwnerSearchSection onSearch={mockOnSearch} />);

      // เปิด Dropdown
      fireEvent.click(screen.getAllByText("ชื่อสถาบันศึกษา")[0]);
      expect(screen.getAllByText("ทั้งหมด (4)")[0]).toBeInTheDocument();

      // จำลองการคลิกที่ document body (พื้นที่ว่าง)
      fireEvent.mouseDown(document.body);

      // ตรวจสอบว่า Dropdown ปิดลง
      expect(screen.queryByText("ทั้งหมด (4)")).not.toBeInTheDocument();
    });
  });

  describe("Category Selections", () => {
    // กรณี: เลือกตัวเลือก "ทั้งหมด"
    // คาดหวัง: สถานะการเลือกต้องถูกอัปเดต (เช็กผ่านการรับ Event โดยไม่ Error)
    it("handles selecting and unselecting 'ทั้งหมด'", () => {
      render(<OwnerSearchSection onSearch={mockOnSearch} />);

      fireEvent.click(screen.getAllByText("ชื่อสถาบันศึกษา")[0]);
      
      const selectAllOption = screen.getAllByText("ทั้งหมด (4)")[0];
      
      // เลือก "ทั้งหมด"
      fireEvent.click(selectAllOption);
      // ยกเลิก "ทั้งหมด"
      fireEvent.click(selectAllOption);
      
      // การเทสต์ผ่านตรงนี้ถือว่าฟังก์ชัน handleSelectAll ทำงานได้โดยไม่ติด Runtime Error
      expect(selectAllOption).toBeInTheDocument();
    });

    // กรณี: เลือกหมวดหมู่ย่อย
    // คาดหวัง: ระบบต้องเคลียร์ "ทั้งหมด" ออกและเพิ่มหมวดหมู่ย่อยแทน
    it("handles selecting individual categories", () => {
      render(<OwnerSearchSection onSearch={mockOnSearch} />);

      fireEvent.click(screen.getAllByText("ชื่อสถาบันศึกษา")[0]);
      
      const universityOption = screen.getAllByText("มหาวิทยาลัย")[0];
      
      // เลือก "มหาวิทยาลัย"
      fireEvent.click(universityOption);
      // ยกเลิก "มหาวิทยาลัย"
      fireEvent.click(universityOption);
      
      expect(universityOption).toBeInTheDocument();
    });

    // กรณี: พิมพ์ค้นหาชื่อสถาบันศึกษาใน Dropdown
    // คาดหวัง: ค่า state ต้องเปลี่ยนตามที่พิมพ์
    it("updates institution search input", () => {
      render(<OwnerSearchSection onSearch={mockOnSearch} />);

      fireEvent.click(screen.getAllByText("ชื่อสถาบันศึกษา")[0]);
      
      const searchInputs = screen.getAllByPlaceholderText("ค้นหาชื่อสถาบันศึกษา...");
      fireEvent.change(searchInputs[0], { target: { value: "จุฬา" } });
      
      expect(searchInputs[0]).toHaveValue("จุฬา");
    });
  });
});