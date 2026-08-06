"use client";

import { useRouter } from "next/navigation";

export interface Job {
  id: string;
  title: string;
  location: string;
  department: string;
  currentApplicants: number;
  maxApplicants: number;
  tags: string[];
  startDate: string;
  endDate: string;
  recruitStartDate?: string;
  recruitEndDate?: string;
  requiredDocuments?: string[];
  phonedepartment?: string;
  responsibilities?: string[];
  qualifications?: string[];
  benefits?: string;
  supervisorName?: string;
  supervisorEmail?: string;
  supervisorPhone?: string;
  mentorName?: string;
  mentorEmail?: string;
  mentorPhone?: string;
}

interface JobCardProps {
  job: Job;
  isSelected?: boolean;
  isFavorite?: boolean;
  onClick?: (job: Job) => void;
  onBookmarkClick?: (jobId: string) => void;
  navigateOnMobile?: boolean;
  mobileDetailPath?: "intern" | "public"; // "intern" = /intern-home/job-detail, "public" = /jobs/{id}
}

export default function JobCard({
  job,
  isSelected = false,
  isFavorite = false,
  onClick,
  onBookmarkClick,
  navigateOnMobile = false,
  mobileDetailPath = "public",
}: JobCardProps) {
  const router = useRouter();

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBookmarkClick?.(job.id);
  };

  const handleCardClick = () => {
    if (navigateOnMobile) {
      if (mobileDetailPath === "intern") {
        router.push(
          `/intern-home/job-detail?jobId=${encodeURIComponent(job.id)}`,
        );
      } else {
        router.push(`/jobs/${job.id}`);
      }
    } else {
      // Desktop behavior: select job to show in panel
      onClick?.(job);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all md:hover:shadow-md md:hover:border-primary-700 active:border-primary-700 active:scale-[0.99] ${
        isSelected && !navigateOnMobile
          ? "border-primary-700 shadow-md"
          : "border-gray-100"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex-1 text-gray-900 font-semibold text-base leading-tight truncate">
          {job.title}
        </h3>

        <button
          onClick={handleBookmarkClick}
          className={`ml-2 shrink-0 transition-colors p-2 rounded-2xl hover:bg-gray-100 cursor-pointer ${
            isFavorite
              ? "text-primary-600 hover:text-primary-700"
              : "text-gray-300 hover:text-primary-600"
          }`}
        >
          {isFavorite ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 21V5C5 4.45 5.19583 3.97917 5.5875 3.5875C5.97917 3.19583 6.45 3 7 3H17C17.55 3 18.0208 3.19583 18.4125 3.5875C18.8042 3.97917 19 4.45 19 5V21L12 18L5 21Z" />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 text-gray-600 text-sm mb-2">
        <svg
          width="13"
          height="17"
          viewBox="0 0 16 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 17.35C10.0333 15.4833 11.5417 13.7875 12.525 12.2625C13.5083 10.7375 14 9.38333 14 8.2C14 6.38333 13.4208 4.89583 12.2625 3.7375C11.1042 2.57917 9.68333 2 8 2C6.31667 2 4.89583 2.57917 3.7375 3.7375C2.57917 4.89583 2 6.38333 2 8.2C2 9.38333 2.49167 10.7375 3.475 12.2625C4.45833 13.7875 5.96667 15.4833 8 17.35ZM8 19.325C7.76667 19.325 7.53333 19.2833 7.3 19.2C7.06667 19.1167 6.85833 18.9917 6.675 18.825C5.59167 17.825 4.63333 16.85 3.8 15.9C2.96667 14.95 2.27083 14.0292 1.7125 13.1375C1.15417 12.2458 0.729167 11.3875 0.4375 10.5625C0.145833 9.7375 0 8.95 0 8.2C0 5.7 0.804167 3.70833 2.4125 2.225C4.02083 0.741667 5.88333 0 8 0C10.1167 0 11.9792 0.741667 13.5875 2.225C15.1958 3.70833 16 5.7 16 8.2C16 8.95 15.8542 9.7375 15.5625 10.5625C15.2708 11.3875 14.8458 12.2458 14.2875 13.1375C13.7292 14.0292 13.0333 14.95 12.2 15.9C11.3667 16.85 10.4083 17.825 9.325 18.825C9.14167 18.9917 8.93333 19.1167 8.7 19.2C8.46667 19.2833 8.23333 19.325 8 19.325ZM8 10C8.55 10 9.02083 9.80417 9.4125 9.4125C9.80417 9.02083 10 8.55 10 8C10 7.45 9.80417 6.97917 9.4125 6.5875C9.02083 6.19583 8.55 6 8 6C7.45 6 6.97917 6.19583 6.5875 6.5875C6.19583 6.97917 6 7.45 6 8C6 8.55 6.19583 9.02083 6.5875 9.4125C6.97917 9.80417 7.45 10 8 10Z"
            fill="#A80689"
          />
        </svg>
        <span>{job.location}</span>
      </div>

      {/* Department */}
      <div className="flex items-center gap-2 text-gray-600 text-sm mb-2">
        <svg
          width="15"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 18C1.45 18 0.979167 17.8042 0.5875 17.4125C0.195833 17.0208 0 16.55 0 16V6C0 5.45 0.195833 4.97917 0.5875 4.5875C0.979167 4.19583 1.45 4 2 4H4V2C4 1.45 4.19583 0.979167 4.5875 0.5875C4.97917 0.195833 5.45 0 6 0H12C12.55 0 13.0208 0.195833 13.4125 0.5875C13.8042 0.979167 14 1.45 14 2V8H16C16.55 8 17.0208 8.19583 17.4125 8.5875C17.8042 8.97917 18 9.45 18 10V16C18 16.55 17.8042 17.0208 17.4125 17.4125C17.0208 17.8042 16.55 18 16 18H10V14H8V18H2ZM2 16H4V14H2V16ZM2 12H4V10H2V12ZM2 8H4V6H2V8ZM6 12H8V10H6V12ZM6 8H8V6H6V8ZM6 4H8V2H6V4ZM10 12H12V10H10V12ZM10 8H12V6H10V8ZM10 4H12V2H10V4ZM14 16H16V14H14V16ZM14 12H16V10H14V12Z"
            fill="#A80689"
          />
        </svg>
        <span>{job.department}</span>
      </div>

      {/* Positions */}
      <div className="flex items-center gap-2 text-gray-600 text-sm mb-2">
        <svg
          className="w-4 h-5 text-primary-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <span>
          {job.maxApplicants === 0
            ? "ไม่จำกัดจำนวน"
            : `${job.currentApplicants}/${job.maxApplicants} คน`}
        </span>
      </div>

      {/* Tags */}
      <div className="flex items-start gap-2 mb-2">
        <svg
          width="18"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="flex-shrink-0 mt-0.5"
        >
          <path
            d="M6 22C5.45 22 4.97917 21.8042 4.5875 21.4125C4.19583 21.0208 4 20.55 4 20V4C4 3.45 4.19583 2.97917 4.5875 2.5875C4.97917 2.19583 5.45 2 6 2H18C18.55 2 19.0208 2.19583 19.4125 2.5875C19.8042 2.97917 20 3.45 20 4V20C20 20.55 19.8042 21.0208 19.4125 21.4125C19.0208 21.8042 18.55 22 18 22H6ZM6 20H18V4H16V10.125C16 10.325 15.9167 10.4708 15.75 10.5625C15.5833 10.6542 15.4167 10.65 15.25 10.55L14.025 9.8C13.8583 9.7 13.6875 9.65 13.5125 9.65C13.3375 9.65 13.1667 9.7 13 9.8L11.775 10.55C11.6083 10.65 11.4375 10.6542 11.2625 10.5625C11.0875 10.4708 11 10.325 11 10.125V4H6V20Z"
            fill="#A80689"
          />
        </svg>
        <div className="flex flex-wrap gap-2">
          {job.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-primary-50 text-gray-800 text-xs rounded-full"
            >
              {tag}
            </span>
          ))}
          {job.tags.length > 3 && (
            <span className="px-2 py-1 text-gray-500 text-xs font-medium  bg-gray-100 rounded-full">
              +{job.tags.length - 3}...
            </span>
          )}
        </div>
      </div>

      {/* Apply Period */}
      <div className="flex items-center gap-2 text-gray-500 text-xs">
        <svg
          width="15"
          height="18"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8.24167 1.75833C8.08055 1.59722 8 1.4 8 1.16667C8 0.933333 8.08055 0.736111 8.24167 0.575C8.40278 0.413889 8.6 0.333333 8.83333 0.333333C9.06667 0.333333 9.26389 0.413889 9.425 0.575C9.58611 0.736111 9.66667 0.933333 9.66667 1.16667C9.66667 1.4 9.58611 1.59722 9.425 1.75833C9.26389 1.91944 9.06667 2 8.83333 2C8.6 2 8.40278 1.91944 8.24167 1.75833ZM8.24167 12.7583C8.08055 12.5972 8 12.4 8 12.1667C8 11.9333 8.08055 11.7361 8.24167 11.575C8.40278 11.4139 8.6 11.3333 8.83333 11.3333C9.06667 11.3333 9.26389 11.4139 9.425 11.575C9.58611 11.7361 9.66667 11.9333 9.66667 12.1667C9.66667 12.4 9.58611 12.5972 9.425 12.7583C9.26389 12.9194 9.06667 13 8.83333 13C8.6 13 8.40278 12.9194 8.24167 12.7583ZM10.9083 4.09167C10.7472 3.93056 10.6667 3.73333 10.6667 3.5C10.6667 3.26667 10.7472 3.06944 10.9083 2.90833C11.0694 2.74722 11.2667 2.66667 11.5 2.66667C11.7333 2.66667 11.9306 2.74722 12.0917 2.90833C12.2528 3.06944 12.3333 3.26667 12.3333 3.5C12.3333 3.73333 12.2528 3.93056 12.0917 4.09167C11.9306 4.25278 11.7333 4.33333 11.5 4.33333C11.2667 4.33333 11.0694 4.25278 10.9083 4.09167ZM10.9083 10.425C10.7472 10.2639 10.6667 10.0667 10.6667 9.83333C10.6667 9.6 10.7472 9.40278 10.9083 9.24167C11.0694 9.08055 11.2667 9 11.5 9C11.7333 9 11.9306 9.08055 12.0917 9.24167C12.2528 9.40278 12.3333 9.6 12.3333 9.83333C12.3333 10.0667 12.2528 10.2639 12.0917 10.425C11.9306 10.5861 11.7333 10.6667 11.5 10.6667C11.2667 10.6667 11.0694 10.5861 10.9083 10.425ZM11.9083 7.25833C11.7472 7.09722 11.6667 6.9 11.6667 6.66667C11.6667 6.43333 11.7472 6.23611 11.9083 6.075C12.0694 5.91389 12.2667 5.83333 12.5 5.83333C12.7333 5.83333 12.9306 5.91389 13.0917 6.075C13.2528 6.23611 13.3333 6.43333 13.3333 6.66667C13.3333 6.9 13.2528 7.09722 13.0917 7.25833C12.9306 7.41944 12.7333 7.5 12.5 7.5C12.2667 7.5 12.0694 7.41944 11.9083 7.25833ZM6.66667 13.3333C5.74444 13.3333 4.87778 13.1583 4.06667 12.8083C3.25556 12.4583 2.55 11.9833 1.95 11.3833C1.35 10.7833 0.875 10.0778 0.525 9.26667C0.175 8.45555 0 7.58889 0 6.66667C0 5.74444 0.175 4.87778 0.525 4.06667C0.875 3.25556 1.35 2.55 1.95 1.95C2.55 1.35 3.25556 0.875 4.06667 0.525C4.87778 0.175 5.74444 0 6.66667 0V1.33333C5.17778 1.33333 3.91667 1.85 2.88333 2.88333C1.85 3.91667 1.33333 5.17778 1.33333 6.66667C1.33333 8.15555 1.85 9.41667 2.88333 10.45C3.91667 11.4833 5.17778 12 6.66667 12V13.3333ZM8.86667 9.8L6 6.93333V3.33333H7.33333V6.4L9.8 8.86667L8.86667 9.8Z"
            fill="#A80689"
          />
        </svg>
        <span>
          ระยะเวลาที่เปิดรับสมัคร:{" "}
          {job.recruitStartDate &&
          job.recruitEndDate &&
          job.recruitStartDate !== "-" &&
          job.recruitEndDate !== "-"
            ? `${job.recruitStartDate} - ${job.recruitEndDate}`
            : "ไม่กำหนดระยะเวลา"}
        </span>
      </div>
    </div>
  );
}
