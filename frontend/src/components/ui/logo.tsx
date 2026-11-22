import Link from "next/link";
import { Dumbbell } from "lucide-react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className = "", size = "md" }: LogoProps) {
  const sizeMap = {
    sm: { icon: "h-4 w-4", box: "h-7 w-7", text: "text-base" },
    md: { icon: "h-5 w-5", box: "h-9 w-9", text: "text-lg" },
    lg: { icon: "h-7 w-7", box: "h-12 w-12", text: "text-2xl" },
  };

  const { icon, box, text } = sizeMap[size];

  return (
    <Link href="/" className={`inline-flex items-center gap-3 select-none group ${className}`}>
      <div
        className={`${box} rounded-xl bg-[#B8FF3B] text-[#090D12] flex items-center justify-center font-black shadow-[0_0_20px_rgba(184,255,59,0.3)] group-hover:shadow-[0_0_28px_rgba(184,255,59,0.5)] group-hover:scale-105 transition-all duration-200`}
      >
        <Dumbbell className={`${icon}`} />
      </div>
      <div className="flex items-baseline">
        <span className={`font-extrabold tracking-tight text-[#F8FAFC] ${text}`}>
          FitCore
        </span>
        <span className={`font-extrabold tracking-tight text-[#B8FF3B] ml-1 ${text}`}>
          AI
        </span>
      </div>
    </Link>
  );
}
