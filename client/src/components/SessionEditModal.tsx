import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SESSION_TYPES = [
  { value: "1on1_pt", label: "1-on-1 Personal Training" },
  { value: "2on1_pt", label: "2-on-1 Personal Training" },
  { value: "nutrition_initial", label: "Initial Nutrition Consultation" },
  { value: "nutrition_coaching", label: "Nutrition Coaching Session" },
];

const PAYMENT_STATUS = [
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
  { value: "from_package", label: "From Package" },
];

interface SessionEditModalProps {
  session: {
    id: number;
    clientId: number;
    sessionDate: string | Date;
    startTime: string;
    endTime: string;
    sessionType: string;
    paymentStatus: string;
    packageId?: number | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SessionEditModal({
  session,
  open,
  onOpenChange,
  onSuccess,
}: SessionEditModalProps) {
  const [formData, setFormData] = useState({
    sessionDate: "",
    startTime: "",
    endTime: "",
    sessionType: "",
    paymentStatus: "",
    packageId: null as number | null,
  });

  const utils = trpc.useUtils();

  // Populate form when session changes
  useEffect(() => {
    if (session) {
      const dateObj = typeof session.sessionDate === "string" 
        ? new Date(session.sessionDate) 
        : session.sessionDate;
      
      setFormData({
        sessionDate: dateObj.toISOString().split("T")[0],
        startTime: session.startTime,
        endTime: session.endTime,
        sessionType: session.sessionType,
        paymentStatus: session.paymentStatus,
        packageId: session.packageId || null,
      });
    }
  }, [session]);

  const updateSession = trpc.trainingSessions.update.useMutation({
    onSuccess: () => {
      toast.success("Session updated successfully");
      utils.trainingSessions.getByTrainer.invalidate();
      utils.trainingSessions.getByClient.invalidate();
      utils.sessionPackages.getByTrainer.invalidate();
      utils.sessionPackages.getByClient.invalidate();
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Failed to update session: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!session) return;

    if (!formData.sessionDate || !formData.startTime || !formData.endTime || !formData.sessionType || !formData.paymentStatus) {
      toast.error("Please fill in all required fields");
      return;
    }

    updateSession.mutate({
      id: session.id,
      sessionDate: formData.sessionDate,
      startTime: formData.startTime,
      endTime: formData.endTime,
      sessionType: formData.sessionType as "1on1_pt" | "2on1_pt" | "nutrition_initial" | "nutrition_coaching",
      paymentStatus: formData.paymentStatus as "paid" | "unpaid" | "from_package",
      packageId: formData.packageId ?? undefined,
    });
  };

  if (!session) return null;

  const isPastSession = new Date(session.sessionDate) < new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isPastSession && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
              ⚠️ This is a past session. Changes will not affect package balances.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sessionDate">Session Date *</Label>
            <Input
              id="sessionDate"
              type="date"
              value={formData.sessionDate}
              onChange={(e) =>
                setFormData({ ...formData, sessionDate: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionType">Session Type *</Label>
            <Select
              value={formData.sessionType}
              onValueChange={(value) =>
                setFormData({ ...formData, sessionType: value })
              }
            >
              <SelectTrigger id="sessionType">
                <SelectValue placeholder="Select session type" />
              </SelectTrigger>
              <SelectContent>
                {SESSION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentStatus">Payment Status *</Label>
            <Select
              value={formData.paymentStatus}
              onValueChange={(value) =>
                setFormData({ ...formData, paymentStatus: value })
              }
            >
              <SelectTrigger id="paymentStatus">
                <SelectValue placeholder="Select payment status" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={updateSession.isPending}
            >
              {updateSession.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
