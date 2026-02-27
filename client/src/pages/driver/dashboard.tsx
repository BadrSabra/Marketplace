import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { t } from "@/i18n";

export default function DriverDashboard() {
  return (
    <div className="p-8 rtl:text-right" dir="auto">
      <div className="flex justify-between items-center mb-4 rtl:flex-row-reverse">
        <div className="rtl:text-right">
          <h1 className="text-3xl font-bold">{t('driver.dashboard.title')}</h1>
          <p className="text-muted-foreground">{t('driver.dashboard.subtitle')}</p>
        </div>
        <Link href="/driver/earnings">
          <Button variant="outline" className="gap-2 rtl:flex-row-reverse">
            <DollarSign className="h-4 w-4" />
            {t('driver.dashboard.my_earnings')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
