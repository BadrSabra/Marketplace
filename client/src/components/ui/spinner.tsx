import { Loader2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Spinner({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12"
  };

  return (
    <Loader2 
      className={cn("animate-spin text-primary", sizeClasses[size], className)} 
    />
  );
}
