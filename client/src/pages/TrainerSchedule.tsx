import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Plus, Users, Dumbbell, Repeat } from "lucide-react";
import SessionList from "@/components/SessionList";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const SESSION_TYPES = [
  { value: "1on1_pt", label: "1-on-1 Personal Training" },
  { value: "2on1_pt", label: "2-on-1 Personal Training" },
  { value: "nutrition_initial", label: "Initial Nutrition Consultation" },
  { value: "nutrition_coaching", label: "Nutrition Coaching Session" },
];

const CLASS_TYPES = [
  { value: "hyrox", label: "Hyrox" },
  { value: "mobility", label: "Mobility" },
  { value: "rehab", label: "Rehab" },
  { value: "conditioning", label: "Conditioning" },
  { value: "strength_conditioning", label: "Strength & Conditioning" },
];

export default function TrainerSchedule() {
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [classDialogOpen, setClassDialogOpen] = useState(false);

  // Get all clients for the dropdown
  const { data: clients } = trpc.clients.list.useQuery();

  // Session form state
  const [sessionForm, setSessionForm] = useState({
    clientId: "",
    sessionType: "",
    sessionDate: "",
    startTime: "",
    endTime: "",
    paymentStatus: "unpaid" as "paid" | "unpaid" | "from_package",
    packageId: undefined as number | undefined,
    notes: "",
    isRecurring: false,
    recurringDays: [] as number[],
    recurringEndDate: "",
  });

  // Group class form state
  const [classForm, setClassForm] = useState({
    classType: "",
    classDate: "",
    startTime: "",
    endTime: "",
    capacity: 20,
    notes: "",
  });

  // Create recurring session mutation
  const createRecurringSession = trpc.trainingSessions.createRecurring.useMutation({
    onSuccess: (data) => {
      toast.success(`Created ${data.count} recurring sessions successfully.`);
      setSessionDialogOpen(false);
      setSessionForm({
        clientId: "",
        sessionType: "",
        sessionDate: "",
        startTime: "",
        endTime: "",
        paymentStatus: "unpaid",
        packageId: undefined,
        notes: "",
        isRecurring: false,
        recurringDays: [],
        recurringEndDate: "",
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Create session mutation
  const createSession = trpc.trainingSessions.create.useMutation({
    onSuccess: () => {
      toast.success("Training session has been scheduled successfully.");
      setSessionDialogOpen(false);
      setSessionForm({
        clientId: "",
        sessionType: "",
        sessionDate: "",
        startTime: "",
        endTime: "",
        paymentStatus: "unpaid",
        packageId: undefined,
        notes: "",
        isRecurring: false,
        recurringDays: [],
        recurringEndDate: "",
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Create group class mutation
  const createClass = trpc.groupClasses.create.useMutation({
    onSuccess: () => {
      toast.success("Group class has been scheduled successfully.");
      setClassDialogOpen(false);
      setClassForm({
        classType: "",
        classDate: "",
        startTime: "",
        endTime: "",
        capacity: 20,
        notes: "",
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreateSession = () => {
    if (
      !sessionForm.clientId ||
      !sessionForm.sessionType ||
      !sessionForm.sessionDate ||
      !sessionForm.startTime ||
      !sessionForm.endTime
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }

    // Validate recurring fields if enabled
    if (sessionForm.isRecurring) {
      if (sessionForm.recurringDays.length === 0) {
        toast.error("Please select at least one day for recurring sessions.");
        return;
      }
      if (!sessionForm.recurringEndDate) {
        toast.error("Please select an end date for recurring sessions.");
        return;
      }

      createRecurringSession.mutate({
        clientId: parseInt(sessionForm.clientId),
        sessionType: sessionForm.sessionType as any,
        startDate: sessionForm.sessionDate,
        endDate: sessionForm.recurringEndDate,
        startTime: sessionForm.startTime,
        endTime: sessionForm.endTime,
        daysOfWeek: sessionForm.recurringDays,
        paymentStatus: sessionForm.paymentStatus,
        packageId: sessionForm.packageId,
        notes: sessionForm.notes || undefined,
      });
    } else {
      createSession.mutate({
        clientId: parseInt(sessionForm.clientId),
        sessionType: sessionForm.sessionType as any,
        sessionDate: sessionForm.sessionDate,
        startTime: sessionForm.startTime,
        endTime: sessionForm.endTime,
        paymentStatus: sessionForm.paymentStatus,
        packageId: sessionForm.packageId,
        notes: sessionForm.notes || undefined,
      });
    }
  };

  const handleCreateClass = () => {
    if (
      !classForm.classType ||
      !classForm.classDate ||
      !classForm.startTime ||
      !classForm.endTime
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }

    createClass.mutate({
      classType: classForm.classType as any,
      classDate: classForm.classDate,
      startTime: classForm.startTime,
      endTime: classForm.endTime,
      capacity: classForm.capacity,
      notes: classForm.notes || undefined,
    });
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Schedule Management</h1>
        <p className="text-muted-foreground">
          Manage training sessions and group classes
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Schedule Session Card */}
        <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
          <DialogTrigger asChild>
            <Card className="p-6 hover:bg-accent cursor-pointer transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    Schedule Session
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Book a personal training or nutrition session for a client
                  </p>
                </div>
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Schedule Training Session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Client Selection */}
              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Select
                  value={sessionForm.clientId}
                  onValueChange={(value) =>
                    setSessionForm({ ...sessionForm, clientId: value })
                  }
                >
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client: any) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Session Type */}
              <div className="space-y-2">
                <Label htmlFor="sessionType">Session Type *</Label>
                <Select
                  value={sessionForm.sessionType}
                  onValueChange={(value) =>
                    setSessionForm({ ...sessionForm, sessionType: value })
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

              {/* Date and Time */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionDate">Date *</Label>
                  <Input
                    id="sessionDate"
                    type="date"
                    value={sessionForm.sessionDate}
                    onChange={(e) =>
                      setSessionForm({
                        ...sessionForm,
                        sessionDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={sessionForm.startTime}
                    onChange={(e) =>
                      setSessionForm({
                        ...sessionForm,
                        startTime: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={sessionForm.endTime}
                    onChange={(e) =>
                      setSessionForm({
                        ...sessionForm,
                        endTime: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Payment Status */}
              <div className="space-y-2">
                <Label htmlFor="paymentStatus">Payment Status</Label>
                <Select
                  value={sessionForm.paymentStatus}
                  onValueChange={(value: any) =>
                    setSessionForm({ ...sessionForm, paymentStatus: value })
                  }
                >
                  <SelectTrigger id="paymentStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="from_package">From Package</SelectItem>
                  </SelectContent>
                </Select>
              </div>

                       {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes..."
                  value={sessionForm.notes}
                  onChange={(e) =>
                    setSessionForm({ ...sessionForm, notes: e.target.value })
                  }
                />
              </div>

              {/* Recurring Session Toggle */}
              <div className="flex items-center space-x-2 border-t pt-4">
                <Checkbox
                  id="recurring"
                  checked={sessionForm.isRecurring}
                  onCheckedChange={(checked) =>
                    setSessionForm({ ...sessionForm, isRecurring: !!checked })
                  }
                />
                <Label htmlFor="recurring" className="flex items-center gap-2 cursor-pointer">
                  <Repeat className="h-4 w-4" />
                  Make this a recurring session
                </Label>
              </div>

              {/* Recurring Options */}
              {sessionForm.isRecurring && (
                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                  <div className="space-y-2">
                    <Label>Repeat on days *</Label>
                    <div className="grid grid-cols-7 gap-2">
                      {[
                        { value: 0, label: "Sun" },
                        { value: 1, label: "Mon" },
                        { value: 2, label: "Tue" },
                        { value: 3, label: "Wed" },
                        { value: 4, label: "Thu" },
                        { value: 5, label: "Fri" },
                        { value: 6, label: "Sat" },
                      ].map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            const days = sessionForm.recurringDays.includes(day.value)
                              ? sessionForm.recurringDays.filter((d) => d !== day.value)
                              : [...sessionForm.recurringDays, day.value];
                            setSessionForm({ ...sessionForm, recurringDays: days });
                          }}
                          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            sessionForm.recurringDays.includes(day.value)
                              ? "bg-primary text-primary-foreground"
                              : "bg-background border hover:bg-accent"
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recurringEndDate">End Date *</Label>
                    <Input
                      id="recurringEndDate"
                      type="date"
                      value={sessionForm.recurringEndDate}
                      onChange={(e) =>
                        setSessionForm({
                          ...sessionForm,
                          recurringEndDate: e.target.value,
                        })
                      }
                      min={sessionForm.sessionDate}
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={handleCreateSession}
                className="w-full"
                disabled={createSession.isPending || createRecurringSession.isPending}
              >
                {createSession.isPending || createRecurringSession.isPending
                  ? "Creating..."
                  : sessionForm.isRecurring
                  ? "Create Recurring Sessions"
                  : "Schedule Session"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Schedule Group Class Card */}
        <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
          <DialogTrigger asChild>
            <Card className="p-6 hover:bg-accent cursor-pointer transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    Schedule Group Class
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Create a group fitness class (Hyrox, Mobility, etc.)
                  </p>
                </div>
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Schedule Group Class</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Class Type */}
              <div className="space-y-2">
                <Label htmlFor="classType">Class Type *</Label>
                <Select
                  value={classForm.classType}
                  onValueChange={(value) =>
                    setClassForm({ ...classForm, classType: value })
                  }
                >
                  <SelectTrigger id="classType">
                    <SelectValue placeholder="Select class type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASS_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="classDate">Date *</Label>
                  <Input
                    id="classDate"
                    type="date"
                    value={classForm.classDate}
                    onChange={(e) =>
                      setClassForm({ ...classForm, classDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    max="50"
                    value={classForm.capacity}
                    onChange={(e) =>
                      setClassForm({
                        ...classForm,
                        capacity: parseInt(e.target.value) || 20,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="classStartTime">Start Time *</Label>
                  <Input
                    id="classStartTime"
                    type="time"
                    value={classForm.startTime}
                    onChange={(e) =>
                      setClassForm({ ...classForm, startTime: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classEndTime">End Time *</Label>
                  <Input
                    id="classEndTime"
                    type="time"
                    value={classForm.endTime}
                    onChange={(e) =>
                      setClassForm({ ...classForm, endTime: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="classNotes">Notes (Optional)</Label>
                <Textarea
                  id="classNotes"
                  placeholder="Add any additional notes..."
                  value={classForm.notes}
                  onChange={(e) =>
                    setClassForm({ ...classForm, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <Button
                onClick={handleCreateClass}
                className="w-full"
                disabled={createClass.isPending}
              >
                {createClass.isPending ? "Creating..." : "Schedule Class"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Upcoming Schedule */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Dumbbell className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Upcoming Sessions</h2>
        </div>
        <SessionList />
      </div>
    </div>
  );
}
