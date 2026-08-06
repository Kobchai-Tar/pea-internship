import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import JobDetailPanel from "../ui/JobDetailPanel";
import { Job } from "../ui/JobCard";

describe("JobDetailPanel Component", () => {
    // Mock Job Data ครบทุก field ที่ component ใช้งาน
    const mockJob: Job = {
        id: "job-123",
        title: "Frontend Developer Intern",
        location: "Bangkok, Thailand",
        department: "Engineering",
        currentApplicants: 2,
        maxApplicants: 5,
        tags: ["React", "Next.js", "TypeScript"],
        startDate: "2026-09-01",
        endDate: "2026-12-31",
        recruitStartDate: "01/08/2026",
        recruitEndDate: "31/08/2026",
        requiredDocuments: ["Transcript", "Resume"],
        responsibilities: ["เขียนโค้ด Frontend", "ทดสอบระบบ"],
        qualifications: ["กำลังศึกษาปี 3-4", "มีพื้นฐาน React"],
        benefits: "ค่าเดินทาง\nอาหารกลางวัน",
        supervisorName: "คุณสมชาย",
        supervisorEmail: "somchai@example.com",
        supervisorPhone: "0812345678",
        mentorName: "คุณสมหญิง",
        mentorEmail: "somying@example.com",
        mentorPhone: "0898765432",
    } as Job;

    describe("Empty state", () => {
        // กรณี: ยังไม่มีการเลือกงาน (selectedJob = null)
        // คาดหวัง: component ต้องแสดง placeholder แทน ไม่ใช่ error หรือหน้าว่างเปล่า
        it("renders placeholder when selectedJob is null", () => {
            render(<JobDetailPanel selectedJob={null} />);

            expect(screen.getByText("เลือกงาน")).toBeInTheDocument();
            expect(screen.getByText("แสดงรายละเอียดที่นี่")).toBeInTheDocument();
            // ไม่ควรมีชื่องานใดๆ render ออกมา
            expect(screen.queryByText(mockJob.title)).not.toBeInTheDocument();
        });
    });

    describe("Rendering job details", () => {
        // กรณี: ส่ง job ที่มีข้อมูลครบเข้าไป
        // คาดหวัง: ข้อมูลพื้นฐาน (ชื่องาน, สถานที่, แผนก, จำนวนผู้สมัคร, tag) ต้อง render ออกมาถูกต้อง
        it("renders basic job info correctly", () => {
            render(<JobDetailPanel selectedJob={mockJob} />);

            expect(screen.getByText("Frontend Developer Intern")).toBeInTheDocument();
            expect(screen.getByText("Bangkok, Thailand")).toBeInTheDocument();
            expect(screen.getByText("Engineering")).toBeInTheDocument();
            expect(screen.getByText("2/5 คน")).toBeInTheDocument();
            expect(screen.getByText("React")).toBeInTheDocument();
        });

        // กรณี: maxApplicants เท่ากับ 0 (หมายถึงไม่จำกัดจำนวนรับสมัคร)
        // คาดหวัง: แสดงข้อความ "ไม่จำกัดจำนวน" แทนตัวเลข x/0
        it("displays unlimited applicants correctly when maxApplicants is 0", () => {
            render(<JobDetailPanel selectedJob={{ ...mockJob, maxApplicants: 0 }} />);
            expect(screen.getByText("ไม่จำกัดจำนวน")).toBeInTheDocument();
        });

        // กรณี: recruitStartDate และ recruitEndDate มีค่าถูกต้องทั้งคู่
        // คาดหวัง: แสดงช่วงวันที่รับสมัครเป็น "startDate - endDate"
        it("displays recruit date range when dates are valid", () => {
            render(<JobDetailPanel selectedJob={mockJob} />);
            expect(
                screen.getByText("ระยะเวลาที่เปิดรับสมัคร : 01/08/2026 - 31/08/2026")
            ).toBeInTheDocument();
        });

        // กรณี: recruitStartDate / recruitEndDate เป็น "-" (ไม่มีข้อมูล/ไม่ถูกต้อง)
        // คาดหวัง: แสดงข้อความ fallback "ไม่กำหนดระยะเวลา" แทนการโชว์ "-" ตรงๆ
        it("displays 'ไม่กำหนดระยะเวลา' when recruit dates are missing or invalid", () => {
            const noDateJob = { ...mockJob, recruitStartDate: "-", recruitEndDate: "-" };
            render(<JobDetailPanel selectedJob={noDateJob} />);
            expect(
                screen.getByText("ระยะเวลาที่เปิดรับสมัคร : ไม่กำหนดระยะเวลา")
            ).toBeInTheDocument();
        });

        // กรณี: job มี responsibilities และ qualifications เป็น array ของข้อความ
        // คาดหวัง: แต่ละรายการใน array ต้องถูก render ออกมาเป็น list item ครบทุกอัน
        it("renders responsibilities and qualifications lists", () => {
            render(<JobDetailPanel selectedJob={mockJob} />);
            expect(screen.getByText("เขียนโค้ด Frontend")).toBeInTheDocument();
            expect(screen.getByText("ทดสอบระบบ")).toBeInTheDocument();
            expect(screen.getByText("กำลังศึกษาปี 3-4")).toBeInTheDocument();
            expect(screen.getByText("มีพื้นฐาน React")).toBeInTheDocument();
        });

        // กรณี: มีการระบุ requiredDocuments มาเอง (ไม่ใช่ค่า default)
        // คาดหวัง: ต้องแสดงเอกสารตามที่ระบุ ไม่ใช้ค่า default "Transcript" เพียงอย่างเดียว
        it("renders provided required documents instead of the default", () => {
            render(<JobDetailPanel selectedJob={mockJob} />);
            expect(screen.getByText("Transcript")).toBeInTheDocument();
            expect(screen.getByText("Resume")).toBeInTheDocument();
        });

        // กรณี: ไม่ได้ส่ง requiredDocuments มาเลย (undefined)
        // คาดหวัง: component ต้อง fallback ไปแสดงค่า default เป็น "Transcript" เพื่อไม่ให้หน้าว่างเปล่า
        it("falls back to default 'Transcript' when requiredDocuments is not provided", () => {
            const jobWithoutDocs = { ...mockJob, requiredDocuments: undefined };
            render(<JobDetailPanel selectedJob={jobWithoutDocs} />);
            expect(screen.getByText("Transcript")).toBeInTheDocument();
        });

        // กรณี: benefits เป็น string ยาวที่มีการขึ้นบรรทัดใหม่ (\n) คั่นแต่ละสวัสดิการ
        // คาดหวัง: component ต้อง split string ด้วย \n แล้วแสดงเป็นรายการแยกแต่ละบรรทัด
        it("splits benefits by newline into separate items", () => {
            render(<JobDetailPanel selectedJob={mockJob} />);
            expect(screen.getByText("ค่าเดินทาง")).toBeInTheDocument();
            expect(screen.getByText("อาหารกลางวัน")).toBeInTheDocument();
        });

        // กรณี: ไม่ได้ส่ง benefits มาเลย (undefined)
        // คาดหวัง: แสดงข้อความ fallback "ไม่มีค่าตอบแทน" แทนการปล่อยว่าง
        it("falls back to default 'ไม่มีค่าตอบแทน' when benefits is not provided", () => {
            const jobWithoutBenefits = { ...mockJob, benefits: undefined };
            render(<JobDetailPanel selectedJob={jobWithoutBenefits} />);
            expect(screen.getByText("ไม่มีค่าตอบแทน")).toBeInTheDocument();
        });

        // กรณี: มีข้อมูลติดต่อของ supervisor และ mentor ครบทุกช่อง
        // คาดหวัง: ชื่อ, อีเมล, เบอร์โทร ของทั้ง supervisor และ mentor ต้องแสดงถูกต้องตรงกับข้อมูลที่ส่งเข้าไป
        it("renders supervisor and mentor contact info when provided", () => {
            render(<JobDetailPanel selectedJob={mockJob} />);
            expect(screen.getByText("คุณสมชาย")).toBeInTheDocument();
            expect(screen.getByText("somchai@example.com")).toBeInTheDocument();
            expect(screen.getByText("0812345678")).toBeInTheDocument();
            expect(screen.getByText("คุณสมหญิง")).toBeInTheDocument();
            expect(screen.getByText("somying@example.com")).toBeInTheDocument();
            expect(screen.getByText("0898765432")).toBeInTheDocument();
        });

        // กรณี: ไม่มีข้อมูลติดต่อของ supervisor/mentor เลยสักช่อง (undefined ทั้งหมด)
        // คาดหวัง: ทุกช่องต้อง fallback เป็น "ยังไม่ระบุ" รวมทั้งหมด 6 จุด (supervisor 3 + mentor 3)
        it("falls back to 'ยังไม่ระบุ' when supervisor/mentor info is missing", () => {
            const jobWithoutContacts = {
                ...mockJob,
                supervisorName: undefined,
                supervisorEmail: undefined,
                supervisorPhone: undefined,
                mentorName: undefined,
                mentorEmail: undefined,
                mentorPhone: undefined,
            };
            render(<JobDetailPanel selectedJob={jobWithoutContacts} />);
            expect(screen.getAllByText("ยังไม่ระบุ")).toHaveLength(6);
        });
    });

    describe("Interactions", () => {
        // กรณี: ผู้ใช้กดปุ่ม "สมัคร" ตอนที่ปุ่มยังไม่ถูก disable
        // คาดหวัง: ต้องเรียกฟังก์ชัน onApplyClick ที่ส่งเข้ามาถูกเรียกพอดี 1 ครั้ง
        it("calls onApplyClick when the apply button is clicked and not disabled", () => {
            const mockOnApplyClick = jest.fn();
            render(<JobDetailPanel selectedJob={mockJob} onApplyClick={mockOnApplyClick} />);

            const applyBtn = screen.getByText("สมัคร");
            fireEvent.click(applyBtn);

            expect(mockOnApplyClick).toHaveBeenCalledTimes(1);
        });

        // กรณี: isApplyDisabled = true พร้อมข้อความแจ้งเหตุผล (disabledMessage)
        // คาดหวัง: ปุ่มต้องถูก disable จริง, กดแล้วห้ามเรียก onApplyClick, และต้องแสดงข้อความ disabledMessage ให้ผู้ใช้เห็น
        it("does not call onApplyClick when isApplyDisabled is true, and shows disabledMessage", () => {
            const mockOnApplyClick = jest.fn();
            render(
                <JobDetailPanel
                    selectedJob={mockJob}
                    onApplyClick={mockOnApplyClick}
                    isApplyDisabled={true}
                    disabledMessage="สมัครไม่ได้เนื่องจากไม่ตรงเงื่อนไข"
                />
            );

            const applyBtn = screen.getByText("สมัคร");
            expect(applyBtn).toBeDisabled();

            fireEvent.click(applyBtn);
            expect(mockOnApplyClick).not.toHaveBeenCalled();
            expect(
                screen.getByText("สมัครไม่ได้เนื่องจากไม่ตรงเงื่อนไข")
            ).toBeInTheDocument();
        });

        // กรณี: ผู้ใช้กดปุ่มไอคอนดูรายละเอียดเพิ่มเติม (มุมขวาบน ข้างชื่องาน)
        // คาดหวัง: ต้องเรียกฟังก์ชัน onViewDetailClick ที่ส่งเข้ามา
        it("calls onViewDetailClick when the view-detail button is clicked", () => {
            const mockOnViewDetailClick = jest.fn();
            render(
                <JobDetailPanel selectedJob={mockJob} onViewDetailClick={mockOnViewDetailClick} />
            );

            // ปุ่มลำดับที่ 2 (index 1) คือปุ่มดูรายละเอียด: [สมัคร, ดูรายละเอียด, บุ๊คมาร์ค]
            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[1]);

            expect(mockOnViewDetailClick).toHaveBeenCalledTimes(1);
        });

        // กรณี: ผู้ใช้กดปุ่มบุ๊คมาร์ค (ปุ่มรูปหัวใจ/ธง เพื่อบันทึกงานที่สนใจ)
        // คาดหวัง: ต้องเรียก onBookmarkClick พร้อมส่ง id ของ job ที่ถูกต้องเป็น argument
        it("calls onBookmarkClick with the job id when the bookmark button is clicked", () => {
            const mockOnBookmarkClick = jest.fn();
            render(
                <JobDetailPanel selectedJob={mockJob} onBookmarkClick={mockOnBookmarkClick} />
            );

            // ปุ่มลำดับที่ 3 (index 2) คือปุ่มบุ๊คมาร์ค
            const buttons = screen.getAllByRole("button");
            fireEvent.click(buttons[2]);

            expect(mockOnBookmarkClick).toHaveBeenCalledTimes(1);
            expect(mockOnBookmarkClick).toHaveBeenCalledWith("job-123");
        });
    });

    describe("Favorite styling", () => {
        // กรณี: isFavorite = true (งานนี้ถูกบุ๊คมาร์คไว้แล้ว)
        // คาดหวัง: ปุ่มบุ๊คมาร์คต้องมี class สีที่บ่งบอกว่า active (text-primary-600) ไม่ใช่สีเทาปกติ
        it("applies favorite (primary) styling on the bookmark button when isFavorite is true", () => {
            render(<JobDetailPanel selectedJob={mockJob} isFavorite={true} />);
            const buttons = screen.getAllByRole("button");
            const bookmarkBtn = buttons[2];

            expect(bookmarkBtn).toHaveClass("text-primary-600");
            expect(bookmarkBtn).not.toHaveClass("text-gray-400");
        });

        // กรณี: isFavorite = false (งานนี้ยังไม่ถูกบุ๊คมาร์ค) - ค่า default
        // คาดหวัง: ปุ่มบุ๊คมาร์คต้องมี class สีเทาปกติ (text-gray-400) ไม่ใช่สี active
        it("applies default (gray) styling on the bookmark button when isFavorite is false", () => {
            render(<JobDetailPanel selectedJob={mockJob} isFavorite={false} />);
            const buttons = screen.getAllByRole("button");
            const bookmarkBtn = buttons[2];

            expect(bookmarkBtn).toHaveClass("text-gray-400");
            expect(bookmarkBtn).not.toHaveClass("text-primary-600");
        });
    });
});