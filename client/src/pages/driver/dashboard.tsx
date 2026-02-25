import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";

export default function DriverDashboard() {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold">Driver Dashboard</h1>
          <p className="text-muted-foreground">View available deliveries and track your earnings.</p>
        </div>
        <Link href="/driver/earnings">
          <Button variant="outline" className="gap-2">
            <DollarSign className="h-4 w-4" />
            My Earnings
          </Button>
        </Link>
      </div>
    </div>
  );
}
