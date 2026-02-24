import { ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DataCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function DataCard({ title, value, icon, trend, trendUp, className }: DataCardProps) {
  return (
    <div className={cn("bg-card rounded-2xl p-6 premium-shadow border border-border/40", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-foreground tracking-tight">{value}</h3>
          
          {trend && (
            <p className={cn(
              "text-sm mt-2 font-medium flex items-center gap-1",
              trendUp ? "text-green-600" : "text-destructive"
            )}>
              {trendUp ? "↑" : "↓"} {trend}
            </p>
          )}
        </div>
        <div className="p-3 bg-primary/5 rounded-xl text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}
