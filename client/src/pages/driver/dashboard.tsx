import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { DollarSign, Package, ClipboardList, Wallet } from "lucide-react";
import { t } from "@/i18n";
import { useDriverWallet, useDriverTasks, useAvailableOffers } from "@/hooks/use-driver";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DriverDashboard() {
  const { data: wallet, isLoading: walletLoading } = useDriverWallet();
  const { data: tasks, isLoading: tasksLoading } = useDriverTasks();
  const { data: offers, isLoading: offersLoading } = useAvailableOffers();

  return (
    <div className="p-8 rtl:text-right" dir="auto">
      <div className="flex justify-between items-center mb-8 rtl:flex-row-reverse">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الرصيد الحالي</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {walletLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{wallet?.balance || "0.00"} EGP</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المهام النشطة</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {tasksLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{tasks?.length || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">العروض المتاحة</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {offersLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{offers?.length || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/driver/tasks">
          <Button className="w-full h-24 text-xl" variant="outline">
            عرض المهام والعروض
          </Button>
        </Link>
        <Link href="/driver/active-delivery">
          <Button className="w-full h-24 text-xl" variant="default">
            التوصيل الحالي
          </Button>
        </Link>
      </div>
    </div>
  );
}
