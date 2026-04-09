import { useQuery } from "@tanstack/react-query";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { AuditLog } from "@shared/schema";

import { 
  Loader2, Search, ChevronLeft, ChevronRight, ShieldAlert, 
  History, User, Box, Clock, ChevronDown, ChevronUp 
} from "lucide-react";

// BUG-FIX: Was using format(date, "dd/MM/yyyy HH:mm:ss") from date-fns (Western numerals).
// Use ar-EG locale for consistent Arabic date/time display across the app.
function formatArabicDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" });
    const time = d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    return `${date} - ${time}`;
  } catch {
    return dateStr;
  }
}

export default function AdminAudit() {
  const [userId, setUserId] = useState("");
  const [actionType, setActionType] = useState("all");
  const [status, setStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const limit = 20;

  const { data, isLoading } = useQuery<{ logs: AuditLog[], total: number }>({
    queryKey: ["/api/admin/audit", { userId, actionType, status, startDate, endDate, offset: page * limit, limit }],
  });

  const getBadgeVariant = (type: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (type) {
      case "DEPOSIT_APPROVED": return "default";
      case "COMMISSION_PROCESSED": return "secondary";
      case "PROFILE_UPDATE": return "outline";
      default: return "outline";
    }
  };

  const getStatusBadge = (log: AuditLog) => {
    const logStatus = (log.metadata as any)?.status || "SUCCESS";
    const variant = logStatus === "FAILED" ? "destructive" : "default";
    const label = logStatus === "FAILED" ? "فشل" : "نجاح";
    return <Badge variant={variant}>{label}</Badge>;
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const totalPages = Math.ceil((data?.total || 0) / limit);

  return (
    <div className="p-8 space-y-8" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">سجلات التدقيق</h1>
          <p className="text-muted-foreground">مراقبة التغييرات في النظام والإجراءات الإدارية.</p>
        </div>
        <ShieldAlert className="h-8 w-8 text-primary" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            نشاط النظام
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="معرّف المستخدم..."
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setPage(0);
                }}
                className="pr-9 text-right"
                data-testid="input-filter-userid"
              />
            </div>
            <Select 
              value={actionType} 
              onValueChange={(val) => {
                setActionType(val);
                setPage(0);
              }}
            >
              <SelectTrigger data-testid="select-filter-actiontype">
                <SelectValue placeholder="نوع الإجراء" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الإجراءات</SelectItem>
                <SelectItem value="PROFILE_UPDATE">تحديث الملف الشخصي</SelectItem>
                <SelectItem value="COMMISSION_PROCESSED">معالجة العمولة</SelectItem>
                <SelectItem value="DEPOSIT_APPROVED">الموافقة على الإيداع</SelectItem>
                <SelectItem value="LEDGER_LIST_ACCESS">الوصول إلى السجل المالي</SelectItem>
              </SelectContent>
            </Select>
            <Select 
              value={status} 
              onValueChange={(val) => {
                setStatus(val);
                setPage(0);
              }}
            >
              <SelectTrigger data-testid="select-filter-status">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="SUCCESS">نجاح</SelectItem>
                <SelectItem value="FAILED">فشل</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
              data-testid="input-filter-startdate"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(0);
              }}
              data-testid="input-filter-enddate"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]"></TableHead>
                  <TableHead className="text-right">التوقيت</TableHead>
                  <TableHead className="text-right">الإجراء</TableHead>
                  <TableHead className="text-right">المستخدم / الدور</TableHead>
                  <TableHead className="text-right">معرّف الكيان</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : data?.logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      لا توجد سجلات تدقيق.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.logs.map((log) => (
                    <>
                      <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => toggleRow(log.id)}
                            data-testid={`button-expand-${log.id}`}
                          >
                            {expandedRows[log.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <Clock className="h-3 w-3" />
                            {formatArabicDateTime(log.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(log.actionType)}>
                            {log.actionType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.performedByUserId.split('-')[0]}...
                            </span>
                            <span className="text-xs text-muted-foreground">{log.performedByRole}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs font-mono">
                            <Box className="h-3 w-3" />
                            {log.entityId.split('-')[0]}...
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(log)}
                        </TableCell>
                      </TableRow>
                      {expandedRows[log.id] && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={6}>
                            <div className="p-4 space-y-4 text-right">
                              <div>
                                <h4 className="text-sm font-semibold mb-2">البيانات الوصفية</h4>
                                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 text-left" dir="ltr">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-sm font-semibold mb-2 text-red-500">القيمة السابقة</h4>
                                  <pre className="text-xs bg-red-50/50 p-2 rounded overflow-auto max-h-40 border border-red-100 text-left" dir="ltr">
                                    {log.oldValue ? JSON.stringify(log.oldValue, null, 2) : "لا يوجد"}
                                  </pre>
                                </div>
                                <div>
                                  <h4 className="text-sm font-semibold mb-2 text-green-500">القيمة الجديدة</h4>
                                  <pre className="text-xs bg-green-50/50 p-2 rounded overflow-auto max-h-40 border border-green-100 text-left" dir="ltr">
                                    {log.newValue ? JSON.stringify(log.newValue, null, 2) : "لا يوجد"}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between py-4">
            <div className="text-sm text-muted-foreground">
              إجمالي السجلات: {data?.total || 0}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1 || isLoading}
                data-testid="button-next-page"
              >
                <ChevronLeft className="h-4 w-4" />
                التالي
              </Button>
              <div className="text-sm font-medium">
                صفحة {page + 1} من {totalPages || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isLoading}
                data-testid="button-prev-page"
              >
                السابق
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
