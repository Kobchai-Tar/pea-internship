import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import JobCard, { Job } from "../ui/JobCard";
import { useRouter } from "next/navigation";

// Mock the Next.js router
jest.mock("next/navigation", () => ({
    useRouter: jest.fn(),
}));

describe("JobCard Component", () => {
    const mockPush = jest.fn();

    // Mock Job Data
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
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    });

    describe("Rendering", () => {
        // สถานะพื้นฐาน: แสดงข้อมูลงานและวันที่รับสมัคร
        it("renders job details correctly", () => {
            render(<JobCard job={mockJob} />);

            expect(screen.getByText("Frontend Developer Intern")).toBeInTheDocument();
            expect(screen.getByText("Bangkok, Thailand")).toBeInTheDocument();
            expect(screen.getByText("Engineering")).toBeInTheDocument();
            expect(screen.getByText("2/5 คน")).toBeInTheDocument();
            expect(screen.getByText("React")).toBeInTheDocument();
            expect(
                screen.getByText("ระยะเวลาที่เปิดรับสมัคร: 01/08/2026 - 31/08/2026")
            ).toBeInTheDocument();
        });

        // กรณีจำนวนผู้สมัครไม่จำกัด
        it("displays unlimited applicants correctly when maxApplicants is 0", () => {
            render(<JobCard job={{ ...mockJob, maxApplicants: 0 }} />);
            expect(screen.getByText("ไม่จำกัดจำนวน")).toBeInTheDocument();
        });

        // แสดง tag แค่ 3 แรกและเพิ่ม counter เมื่อมีมากกว่า 3
        it("handles more than 3 tags correctly", () => {
            const manyTagsJob = {
                ...mockJob,
                tags: ["React", "Next.js", "TypeScript", "Tailwind", "Jest"],
            };
            render(<JobCard job={manyTagsJob} />);

            expect(screen.getByText("React")).toBeInTheDocument();
            expect(screen.getByText("Next.js")).toBeInTheDocument();
            expect(screen.getByText("TypeScript")).toBeInTheDocument();
            expect(screen.queryByText("Tailwind")).not.toBeInTheDocument();
            expect(screen.getByText("+2...")).toBeInTheDocument();
        });

        // กรณีมี tag 2 อัน: ไม่ควรมี overflow counter
        it("renders correctly with two tags and no overflow counter", () => {
            const twoTagJob = {
                ...mockJob,
                tags: ["React", "Next.js"],
            };
            render(<JobCard job={twoTagJob} />);

            expect(screen.getByText("React")).toBeInTheDocument();
            expect(screen.getByText("Next.js")).toBeInTheDocument();
            expect(screen.queryByText("+1...")).not.toBeInTheDocument();
        });

        // กรณีไม่มี tag: ไม่แสดง tag และไม่มี overflow counter
        it("renders correctly with no tags and no overflow counter", () => {
            render(<JobCard job={{ ...mockJob, tags: [] }} />);
            expect(screen.queryByText("React")).not.toBeInTheDocument();
            expect(screen.queryByText("+1...")).not.toBeInTheDocument();
        });

        // กรณีวันที่รับสมัครเป็น "-" ให้แสดงไม่กำหนดระยะเวลา
        it("displays 'ไม่กำหนดระยะเวลา' when recruit dates are missing or invalid", () => {
            const noDateJob = {
                ...mockJob,
                recruitStartDate: "-",
                recruitEndDate: "-",
            };
            render(<JobCard job={noDateJob} />);

            expect(
                screen.getByText("ระยะเวลาที่เปิดรับสมัคร: ไม่กำหนดระยะเวลา")
            ).toBeInTheDocument();
        });

        // กรณี recruitStartDate/recruitEndDate เป็น undefined ให้ fallback ไม่กำหนดระยะเวลา
        it("displays 'ไม่กำหนดระยะเวลา' when recruit dates are undefined", () => {
            const undefinedDateJob = {
                ...mockJob,
                recruitStartDate: undefined,
                recruitEndDate: undefined,
            };
            render(<JobCard job={undefinedDateJob} />);

            expect(
                screen.getByText("ระยะเวลาที่เปิดรับสมัคร: ไม่กำหนดระยะเวลา")
            ).toBeInTheDocument();
        });

        // กรณี recruitStartDate/recruitEndDate เป็น empty string ให้ fallback ไม่กำหนดระยะเวลา
        it("displays 'ไม่กำหนดระยะเวลา' when recruit dates are empty strings", () => {
            const emptyStringDateJob = {
                ...mockJob,
                recruitStartDate: "",
                recruitEndDate: "",
            };
            render(<JobCard job={emptyStringDateJob} />);

            expect(
                screen.getByText("ระยะเวลาที่เปิดรับสมัคร: ไม่กำหนดระยะเวลา")
            ).toBeInTheDocument();
        });
    });

    describe("Interactions & Routing", () => {
        // คลิกการ์ดในโหมด desktop ต้องเรียก onClick และไม่ route
        it("calls onClick when clicked in desktop mode (navigateOnMobile is false)", () => {
            const mockOnClick = jest.fn();
            render(<JobCard job={mockJob} onClick={mockOnClick} />);

            const card = screen.getByText("Frontend Developer Intern").closest("div.cursor-pointer");
            fireEvent.click(card!);

            expect(mockOnClick).toHaveBeenCalledTimes(1);
            expect(mockOnClick).toHaveBeenCalledWith(mockJob);
            expect(mockPush).not.toHaveBeenCalled();
        });

        // default mobile path เมื่อไม่ส่ง mobileDetailPath
        it("routes to 'public' detail path by default when navigateOnMobile is true and mobileDetailPath is omitted", () => {
            render(<JobCard job={mockJob} navigateOnMobile={true} />);

            const card = screen.getByText("Frontend Developer Intern").closest("div.cursor-pointer");
            fireEvent.click(card!);

            expect(mockPush).toHaveBeenCalledWith("/jobs/job-123");
        });

        // mobile path public
        it("routes to 'public' detail path when navigateOnMobile is true and mobileDetailPath is 'public'", () => {
            render(
                <JobCard
                    job={mockJob}
                    navigateOnMobile={true}
                    mobileDetailPath="public"
                />
            );

            const card = screen.getByText("Frontend Developer Intern").closest("div.cursor-pointer");
            fireEvent.click(card!);

            expect(mockPush).toHaveBeenCalledWith("/jobs/job-123");
        });

        // mobile path intern
        it("routes to 'intern' detail path when navigateOnMobile is true and mobileDetailPath is 'intern'", () => {
            render(
                <JobCard
                    job={mockJob}
                    navigateOnMobile={true}
                    mobileDetailPath="intern"
                />
            );

            const card = screen.getByText("Frontend Developer Intern").closest("div.cursor-pointer");
            fireEvent.click(card!);

            expect(mockPush).toHaveBeenCalledWith("/intern-home/job-detail?jobId=job-123");
        });

        // เมื่อกด bookmark แล้วต้องเรียก onBookmarkClick และไม่ bubble ไป onClick
        it("calls onBookmarkClick and stops propagation when bookmark is clicked", () => {
            const mockOnBookmarkClick = jest.fn();
            const mockOnClick = jest.fn();

            render(
                <JobCard
                    job={mockJob}
                    onBookmarkClick={mockOnBookmarkClick}
                    onClick={mockOnClick}
                />
            );

            const bookmarkBtn = screen.getByRole("button");
            fireEvent.click(bookmarkBtn);

            expect(mockOnBookmarkClick).toHaveBeenCalledTimes(1);
            expect(mockOnBookmarkClick).toHaveBeenCalledWith("job-123");
            expect(mockOnClick).not.toHaveBeenCalled();
        });

        // กรณีไม่มี onBookmarkClick ให้คลิกแล้วไม่เกิด error
        it("does not throw when bookmark button is clicked without onBookmarkClick", () => {
            render(<JobCard job={mockJob} />);

            const bookmarkBtn = screen.getByRole("button");
            expect(() => fireEvent.click(bookmarkBtn)).not.toThrow();
        });
    });

    describe("Styling states", () => {
        // styling เมื่อ selected และไม่ใช่ mobile mode
        it("applies selected styling when isSelected is true and navigateOnMobile is false", () => {
            const { container } = render(<JobCard job={mockJob} isSelected={true} />);
            const cardDiv = container.firstChild;

            expect(cardDiv).toHaveClass("border-primary-700 shadow-md");
            expect(cardDiv).not.toHaveClass("border-gray-100");
        });

        // ไม่ใช้ selected styling เมื่อเป็น mobile mode
        it("does not apply selected styling when navigateOnMobile is true, even if isSelected is true", () => {
            const { container } = render(
                <JobCard job={mockJob} isSelected={true} navigateOnMobile={true} />
            );
            const cardDiv = container.firstChild;

            expect(cardDiv).toHaveClass("border-gray-100");
            expect(cardDiv).not.toHaveClass("border-primary-700 shadow-md");
        });

        // styling favorite เมื่อ isFavorite=true
        it("applies favorite styling when isFavorite is true", () => {
            render(<JobCard job={mockJob} isFavorite={true} />);
            const bookmarkBtn = screen.getByRole("button");

            expect(bookmarkBtn).toHaveClass("text-primary-600");
            expect(bookmarkBtn).not.toHaveClass("text-gray-300");
        });

        // styling default เมื่อ isFavorite=false
        it("applies default bookmark styling when isFavorite is false", () => {
            render(<JobCard job={mockJob} isFavorite={false} />);
            const bookmarkBtn = screen.getByRole("button");

            expect(bookmarkBtn).toHaveClass("text-gray-300");
            expect(bookmarkBtn).not.toHaveClass("text-primary-600");
        });
    });
});