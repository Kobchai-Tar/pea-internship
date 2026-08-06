import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import NotificationStatusIcon, { detectNotificationTone } from "../ui/NotificationStatusIcon";

describe("Notification Utils and Component", () => {
  
  describe("detectNotificationTone (ฟังก์ชันคำนวณสถานะแจ้งเตือน)", () => {
    // กรณี: มีคีย์เวิร์ดในกลุ่ม ERROR (เช่น "ยกเลิก", "reject", "ไม่ผ่าน") อยู่ใน Title หรือ Message
    // คาดหวัง: ฟังก์ชันต้องคืนค่า "error"
    it("returns 'error' when text contains error keywords", () => {
      expect(detectNotificationTone("แจ้งเตือน", "คำขอของคุณถูกยกเลิกแล้ว")).toBe("error");
      expect(detectNotificationTone("Reject", "Your request is invalid")).toBe("error");
    });

    // กรณี: มีคีย์เวิร์ดในกลุ่ม SUCCESS (เช่น "เสร็จสมบูรณ์", "success", "ผ่าน") อยู่ใน Title หรือ Message
    // คาดหวัง: ฟังก์ชันต้องคืนค่า "success"
    it("returns 'success' when text contains success keywords", () => {
      expect(detectNotificationTone("การอนุมัติ", "ดำเนินการเสร็จสมบูรณ์")).toBe("success");
      expect(detectNotificationTone("Approved!", "Welcome to the team")).toBe("success");
    });

    // กรณี: มีคีย์เวิร์ดในกลุ่ม PENDING (เช่น "รอ", "ตรวจสอบ", "pending") อยู่ใน Title หรือ Message
    // คาดหวัง: ฟังก์ชันต้องคืนค่า "pending"
    it("returns 'pending' when text contains pending keywords", () => {
      expect(detectNotificationTone("รอตรวจสอบ", "เอกสารของคุณอยู่ในระบบ")).toBe("pending");
      expect(detectNotificationTone("Status update", "Currently in review")).toBe("pending");
    });

    // กรณี: ไม่มีคีย์เวิร์ดใดๆ ที่ตรงกับเงื่อนไขข้างต้นเลย
    // คาดหวัง: ฟังก์ชันต้องตกไปที่ค่า default ซึ่งก็คือ "pending"
    it("returns 'pending' as default when no keywords match", () => {
      expect(detectNotificationTone("Hello", "มีอัปเดตใหม่สำหรับคุณ")).toBe("pending");
    });

    // กรณี: ตัวพิมพ์เล็ก/พิมพ์ใหญ่ผสมกัน (Case Insensitivity)
    // คาดหวัง: ฟังก์ชันต้องทำงานได้ถูกต้องโดยไม่สนใจตัวพิมพ์เล็กหรือพิมพ์ใหญ่
    it("is case-insensitive when matching keywords", () => {
      expect(detectNotificationTone("SuCcEsS", "completed details")).toBe("success");
      expect(detectNotificationTone("FaIlEd", "login error")).toBe("error");
    });

    // กรณี: มีคีย์เวิร์ดหลายกลุ่มผสมกันในประโยคเดียว (เช่น มีทั้งคำว่า "รอ" และ "ยกเลิก")
    // คาดหวัง: ต้องยึดลำดับความสำคัญตามโค้ด คือเช็ค ERROR ก่อน -> SUCCESS -> PENDING
    it("prioritizes error over success and pending if multiple keywords exist", () => {
      // มีคำว่า "รอ" (pending) และ "ยกเลิก" (error) -> ต้องได้ error เพราะเช็คก่อน
      expect(detectNotificationTone("รอตรวจสอบ", "แต่ถูกยกเลิกไปแล้ว")).toBe("error");
    });
  });

  describe("NotificationStatusIcon Component (UI รูปไอคอน)", () => {
    // กรณี: ส่ง prop tone="error"
    // คาดหวัง: ต้อง Render SVG ที่เป็นไอคอนสีแดง (fill="#D92D20")
    it("renders the error icon when tone is 'error'", () => {
      const { container } = render(<NotificationStatusIcon tone="error" />);
      const svgElement = container.querySelector("svg");
      
      expect(svgElement).toBeInTheDocument();
      expect(svgElement?.innerHTML).toContain('fill="#D92D20"');
    });

    // กรณี: ส่ง prop tone="success"
    // คาดหวัง: ต้อง Render SVG ที่เป็นไอคอนสีเขียว (fill="#17B26A")
    it("renders the success icon when tone is 'success'", () => {
      const { container } = render(<NotificationStatusIcon tone="success" />);
      const svgElement = container.querySelector("svg");
      
      expect(svgElement).toBeInTheDocument();
      expect(svgElement?.innerHTML).toContain('fill="#17B26A"');
    });

    // กรณี: ส่ง prop tone="pending"
    // คาดหวัง: ต้อง Render SVG ที่เป็นไอคอนนาฬิกาสีส้ม (fill="#F79009")
    it("renders the pending icon when tone is 'pending'", () => {
      const { container } = render(<NotificationStatusIcon tone="pending" />);
      const svgElement = container.querySelector("svg");
      
      expect(svgElement).toBeInTheDocument();
      expect(svgElement?.innerHTML).toContain('fill="#F79009"');
    });

    // กรณี: มีการส่ง prop className เข้ามาด้วย
    // คาดหวัง: ต้องแนบ className นั้นเข้าไปที่แท็ก svg ได้อย่างถูกต้อง
    it("applies custom className to the svg element", () => {
      const { container } = render(<NotificationStatusIcon tone="success" className="custom-icon-class" />);
      const svgElement = container.querySelector("svg");
      
      expect(svgElement).toHaveClass("custom-icon-class");
    });
  });
});
