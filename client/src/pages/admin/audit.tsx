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
import { format } from "date-fns";
import type { AuditLog } from "@shared/schema";
import { Loader2, Search, ChevronLeft, ChevronRight, ShieldAlert, History, User, Box, Clock } from "lucide-react";

export default function AdminAudit() {
  const [userId, setUserId] = useState("");
  const [actionType, setActionType] = useState("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading } = useQuery<{ logs: AuditLog[], total: number }>({
    queryKey: ["/api/admin/audit", { userId, actionType, offset: page * limit, limit }],
  });

  const getBadgeVariant = (type: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (type) {
      case "DEPOSIT_APPROVED": return "default";
      case "COMMISSION_PROCESSED": return "secondary";
      case "WALLET_UPDATE": return "outline";
      default: return "outline";
    }
  };

  const totalPages = Math.ceil((data?.total || 0) / limit);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">Monitor system changes and administrative actions.</p>
        </div>
        <ShieldAlert className="h-8 w-8 text-primary" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            System Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by User ID..."
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
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
              <SelectTrigger className="w-[200px]" data-testid="select-filter-actiontype">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="WALLET_UPDATE">Wallet Update</SelectItem>
                <SelectItem value="COMMISSION_PROCESSED">Commission Processed</SelectItem>
                <SelectItem value="DEPOSIT_APPROVED">Deposit Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User/Role</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : data?.logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No audit logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.logs.map((log) => (
                    <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.createdAt), "MMM dd, yyyy HH:mm:ss")}
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
                            ID: {log.performedByUserId}
                          </span>
                          <span className="text-xs text-muted-foreground">{log.performedByRole}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs font-mono">
                          <Box className="h-3 w-3" />
                          {log.entityId}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs max-w-xs overflow-hidden text-ellipsis whitespace-nowrap" title={JSON.stringify(log.metadata)}>
                          {log.metadata ? JSON.stringify(log.metadata) : "-"}
                        </div>
                        {log.oldValue && log.newValue && (
                          <div className="flex items-center gap-2 mt-1 text-[10px]">
                            <span className="text-red-500 line-through">
                              {typeof log.oldValue === 'object' ? JSON.stringify(log.oldValue) : log.oldValue}
                            </span>
                            <span>→</span>
                            <span className="text-green-500 font-medium">
                              {typeof log.newValue === 'object' ? JSON.stringify(log.newValue) : log.newValue}
                            </span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">
              Total {data?.total || 0} logs
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isLoading}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm font-medium">
                Page {page + 1} of {totalPages || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1 || isLoading}
                data-testid="button-next-page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
