import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, DollarSign, Trash2, Edit, Filter } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const SESSION_TYPE_LABELS: Record<string, string> = {
  "1on1_pt": "1-on-1 PT",
  "2on1_pt": "2-on-1 PT",
  "nutrition_initial": "Nutrition Initial",
  "nutrition_coaching": "Nutrition Coaching",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-500/10 text-green-700 border-green-200",
  unpaid: "bg-orange-500/10 text-orange-700 border-orange-200",
  from_package: "bg-blue-500/10 text-blue-700 border-blue-200",
};

export default function SessionList() {
  const [dateFilter, setDateFilter] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
  });
  const [clientFilter, setClientFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<number | null>(null);

  // Get all clients for filter dropdown
  const { data: clients } = trpc.clients.list.useQuery();

  // Get sessions by trainer with date range
  const { data: sessions, isLoading, refetch } = trpc.trainingSessions.getByTrainer.useQuery({
    startDate: dateFilter.startDate as any,
    endDate: (dateFilter.endDate || undefined) as any,
  });

  // Delete session mutation
  const deleteSession = trpc.trainingSessions.delete.useMutation({
    onSuccess: () => {
      toast.success("Session has been cancelled and client notified.");
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Filter sessions based on client and payment status
  const filteredSessions = sessions?.filter((session: any) => {
    if (clientFilter && session.clientId.toString() !== clientFilter) return false;
    if (paymentFilter && session.paymentStatus !== paymentFilter) return false;
    return true;
  });

  const handleDeleteClick = (sessionId: number) => {
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (sessionToDelete) {
      deleteSession.mutate({ sessionId: sessionToDelete });
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={dateFilter.startDate}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, startDate: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date (Optional)</Label>
            <Input
              id="endDate"
              type="date"
              value={dateFilter.endDate}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, endDate: e.target.value })
              }
              min={dateFilter.startDate}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientFilter">Client</Label>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger id="clientFilter">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All clients</SelectItem>
                {clients?.map((client: any) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentFilter">Payment Status</Label>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger id="paymentFilter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="from_package">From Package</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Session List */}
      <div className="space-y-3">
        {isLoading ? (
          <Card className="p-6">
            <p className="text-center text-muted-foreground">Loading sessions...</p>
          </Card>
        ) : filteredSessions && filteredSessions.length > 0 ? (
          filteredSessions.map((session: any) => (
            <Card key={session.id} className="p-4 hover:bg-accent/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="font-semibold text-lg">
                      {SESSION_TYPE_LABELS[session.sessionType] || session.sessionType}
                    </h4>
                    <Badge
                      variant="outline"
                      className={PAYMENT_STATUS_COLORS[session.paymentStatus]}
                    >
                      {session.paymentStatus === "from_package"
                        ? "Package"
                        : session.paymentStatus}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{session.client?.name || "Unknown Client"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(session.sessionDate), "EEE, MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        {session.startTime} - {session.endTime}
                      </span>
                    </div>
                  </div>

                  {session.notes && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Note: {session.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(session.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-6">
            <p className="text-center text-muted-foreground">
              No sessions found for the selected filters.
            </p>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this session? The client will be notified
              via email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Keep Session
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteSession.isPending}
            >
              {deleteSession.isPending ? "Cancelling..." : "Cancel Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
