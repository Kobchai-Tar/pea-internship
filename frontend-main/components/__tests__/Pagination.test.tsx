import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Pagination from "../ui/Pagination";

describe("Pagination Component", () => {
  const mockOnPageChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering Base Cases (totalPages <= 7)", () => {
    // กรณี: จำนวนหน้าทั้งหมดน้อยกว่าหรือเท่ากับ 7
    // คาดหวัง: ต้องแสดงเลขหน้าทั้งหมดโดยไม่มีจุดไข่ปลา
    it("renders all page numbers when totalPages is 7 or less", () => {
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnPageChange}
        />
      );

      // ตรวจสอบว่ามีปุ่มเลข 1-5 ครบถ้วน
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(i.toString())).toBeInTheDocument();
      }
      
      // ตรวจสอบว่าไม่มีจุดไข่ปลา
      expect(screen.queryByText("...")).not.toBeInTheDocument();
    });
  });

  describe("Rendering Ellipsis Cases (totalPages > 7)", () => {
    // กรณี: อยู่หน้าแรกๆ (currentPage <= 4)
    // คาดหวัง: แสดง [1, 2, 3, 4, 5, ..., 10]
    it("renders correct structure for start pages (currentPage <= 4)", () => {
      render(
        <Pagination
          currentPage={3}
          totalPages={10}
          onPageChange={mockOnPageChange}
        />
      );

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("...")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.queryByText("6")).not.toBeInTheDocument();
    });

    // กรณี: อยู่หน้าท้ายๆ (currentPage >= totalPages - 3)
    // คาดหวัง: แสดง [1, ..., 6, 7, 8, 9, 10]
    it("renders correct structure for end pages (currentPage >= totalPages - 3)", () => {
      render(
        <Pagination
          currentPage={8}
          totalPages={10}
          onPageChange={mockOnPageChange}
        />
      );

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("...")).toBeInTheDocument();
      expect(screen.getByText("6")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.queryByText("5")).not.toBeInTheDocument();
    });

    // กรณี: อยู่หน้าตรงกลาง
    // คาดหวัง: แสดง [1, ..., 4, 5, 6, ..., 10]
    it("renders correct structure for middle pages", () => {
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={mockOnPageChange}
        />
      );

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("6")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
      
      // จุดไข่ปลาต้องมี 2 จุด
      const ellipsis = screen.getAllByText("...");
      expect(ellipsis).toHaveLength(2);
    });
  });

  describe("Interactions", () => {
    // กรณี: คลิกเลขหน้า
    // คาดหวัง: เรียก onPageChange พร้อมกับเลขหน้าที่กด
    it("calls onPageChange with correct page number when a page is clicked", () => {
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnPageChange}
        />
      );

      fireEvent.click(screen.getByText("3"));
      expect(mockOnPageChange).toHaveBeenCalledWith(3);
      expect(mockOnPageChange).toHaveBeenCalledTimes(1);
    });

    // กรณี: อยู่หน้าแรก
    // คาดหวัง: ปุ่ม Previous ต้องถูก disable
    it("disables Previous button on the first page", () => {
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={mockOnPageChange}
        />
      );

      const buttons = screen.getAllByRole("button");
      const prevButton = buttons[0]; // ปุ่มแรกคือ Previous

      expect(prevButton).toBeDisabled();
    });

    // กรณี: อยู่หน้าสุดท้าย
    // คาดหวัง: ปุ่ม Next ต้องถูก disable
    it("disables Next button on the last page", () => {
      render(
        <Pagination
          currentPage={5}
          totalPages={5}
          onPageChange={mockOnPageChange}
        />
      );

      const buttons = screen.getAllByRole("button");
      const nextButton = buttons[buttons.length - 1]; // ปุ่มสุดท้ายคือ Next

      expect(nextButton).toBeDisabled();
    });

    // กรณี: คลิกปุ่ม Next
    // คาดหวัง: เรียก onPageChange ด้วย currentPage + 1
    it("navigates to next page when Next button is clicked", () => {
      render(
        <Pagination
          currentPage={3}
          totalPages={5}
          onPageChange={mockOnPageChange}
        />
      );

      const buttons = screen.getAllByRole("button");
      const nextButton = buttons[buttons.length - 1];
      
      fireEvent.click(nextButton);
      expect(mockOnPageChange).toHaveBeenCalledWith(4);
    });

    // กรณี: คลิกปุ่ม Previous
    // คาดหวัง: เรียก onPageChange ด้วย currentPage - 1
    it("navigates to previous page when Previous button is clicked", () => {
      render(
        <Pagination
          currentPage={3}
          totalPages={5}
          onPageChange={mockOnPageChange}
        />
      );

      const buttons = screen.getAllByRole("button");
      const prevButton = buttons[0];
      
      fireEvent.click(prevButton);
      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });

    // กรณี: พยายามคลิกจุดไข่ปลา
    // คาดหวัง: ปุ่มต้องถูก disable และไม่เรียก onPageChange
    it("disables ellipsis buttons", () => {
      render(
        <Pagination
          currentPage={1}
          totalPages={10}
          onPageChange={mockOnPageChange}
        />
      );

      const ellipsisButton = screen.getByText("...");
      expect(ellipsisButton).toBeDisabled();
      
      fireEvent.click(ellipsisButton);
      expect(mockOnPageChange).not.toHaveBeenCalled();
    });
  });
});