import { useState, useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { SessionEditModal } from "@/components/SessionEditModal";
import { toast } from "sonner";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: {
    type: "session" | "group_class";
    clientName?: string;
    sessionType?: string;
    classType?: string;
    paymentStatus?: string;
    capacity?: number;
    attendeeCount?: number;
  };
}

interface TrainerCalendarProps {
  trainerId: number;
}

export function TrainerCalendar({ trainerId }: TrainerCalendarProps) {
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const utils = trpc.useUtils();
  const deleteSessionMutation = trpc.trainingSessions.delete.useMutation({
    onSuccess: () => {
      toast.success("Session cancelled and client notified");
      utils.trainingSessions.invalidate();
      setSelectedEvent(null);
      setShowDeleteConfirm(false);
    },
    onError: (error) => {
      toast.error(`Failed to cancel session: ${error.message}`);
    },
  });

  // Fetch all sessions for the trainer
  const { data: sessions } = trpc.trainingSessions.getByTrainer.useQuery({});

  // Fetch all group classes for the trainer
  const { data: groupClasses } = trpc.groupClasses.getByTrainer.useQuery({});

  // Transform sessions and group classes into calendar events
  const events: CalendarEvent[] = useMemo(() => {
    const sessionEvents: CalendarEvent[] =
      sessions?.map((session) => {
        // Parse date in UTC to avoid timezone shifts
        const sessionDate = new Date(session.sessionDate);
        const year = sessionDate.getUTCFullYear();
        const month = sessionDate.getUTCMonth();
        const day = sessionDate.getUTCDate();
        
        const [startHour, startMinute] = session.startTime.split(":").map(Number);
        const [endHour, endMinute] = session.endTime.split(":").map(Number);

        // Create dates in local timezone using UTC date components
        const start = new Date(year, month, day, startHour, startMinute, 0);
        const end = new Date(year, month, day, endHour, endMinute, 0);

        return {
          id: session.id,
          title: `${session.client.name} - ${session.sessionType}`,
          start,
          end,
          resource: {
            type: "session" as const,
            clientName: session.client.name,
            sessionType: session.sessionType,
            paymentStatus: session.paymentStatus,
          },
        };
      }) || [];

    const groupClassEvents: CalendarEvent[] =
      groupClasses?.map((groupClass) => {
        // Parse date in UTC to avoid timezone shifts
        const classDate = new Date(groupClass.classDate);
        const year = classDate.getUTCFullYear();
        const month = classDate.getUTCMonth();
        const day = classDate.getUTCDate();
        
        const [startHour, startMinute] = groupClass.startTime.split(":").map(Number);
        const [endHour, endMinute] = groupClass.endTime.split(":").map(Number);

        // Create dates in local timezone using UTC date components
        const start = new Date(year, month, day, startHour, startMinute, 0);
        const end = new Date(year, month, day, endHour, endMinute, 0);

        return {
          id: groupClass.id,
          title: `Group: ${groupClass.classType}`,
          start,
          end,
          resource: {
            type: "group_class" as const,
            classType: groupClass.classType,
            capacity: groupClass.capacity,
            attendeeCount: 0, // TODO: Calculate from attendance records
          },
        };
      }) || [];

    return [...sessionEvents, ...groupClassEvents];
  }, [sessions, groupClasses]);

  const SESSION_TYPE_COLORS: Record<string, { bg: string; border: string }> = {
    "1on1_pt": { bg: "#3b82f6", border: "#2563eb" },
    "2on1_pt": { bg: "#8b5cf6", border: "#7c3aed" },
    "nutrition_initial": { bg: "#ec4899", border: "#db2777" },
    "nutrition_coaching": { bg: "#f59e0b", border: "#d97706" },
    "custom": { bg: "#06b6d4", border: "#0891b2" },
  };

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    let backgroundColor = "#10b981";
    let borderColor = "#059669";

    if (event.resource.type === "session") {
      const sessionType = event.resource.sessionType || "1on1_pt";
      const colors = SESSION_TYPE_COLORS[sessionType] || SESSION_TYPE_COLORS["1on1_pt"];
      backgroundColor = colors.bg;
      borderColor = colors.border;
    }

    return {
      style: {
        backgroundColor,
        borderColor,
        borderWidth: "2px",
        borderStyle: "solid",
        borderRadius: "4px",
        opacity: 0.9,
        color: "white",
        fontSize: "0.875rem",
        padding: "2px 4px",
      },
    };
  }, []);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Training Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[600px]">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              eventPropGetter={eventStyleGetter}
              onSelectEvent={handleSelectEvent}
              views={["month", "week", "day"]}
              step={30}
              showMultiDayTimes
              defaultView="week"
            />
          </div>
          <div className="mt-4 flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-sm">Personal Training Sessions</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm">Group Classes</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-3">
              <div>
                <span className="font-medium">Time:</span>{" "}
                {format(selectedEvent.start, "h:mm a")} -{" "}
                {format(selectedEvent.end, "h:mm a")}
              </div>
              <div>
                <span className="font-medium">Date:</span>{" "}
                {format(selectedEvent.start, "MMMM d, yyyy")}
              </div>
              {selectedEvent.resource.type === "session" && (
                <>
                  <div>
                    <span className="font-medium">Client:</span>{" "}
                    {selectedEvent.resource.clientName}
                  </div>
                  <div>
                    <span className="font-medium">Session Type:</span>{" "}
                    {selectedEvent.resource.sessionType}
                  </div>
                  <div>
                    <span className="font-medium">Payment Status:</span>{" "}
                    <Badge
                      variant={
                        selectedEvent.resource.paymentStatus === "paid"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {selectedEvent.resource.paymentStatus}
                    </Badge>
                  </div>
                </>
              )}
              {selectedEvent.resource.type === "group_class" && (
                <>
                  <div>
                    <span className="font-medium">Class Type:</span>{" "}
                    {selectedEvent.resource.classType}
                  </div>
                  <div>
                    <span className="font-medium">Capacity:</span>{" "}
                    {selectedEvent.resource.attendeeCount} /{" "}
                    {selectedEvent.resource.capacity}
                  </div>
                </>
              )}
            </div>
          )}
          {selectedEvent && selectedEvent.resource.type === "session" && (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  // Find the full session data
                  const session = sessions?.find(s => s.id === selectedEvent.id);
                  if (session) {
                    setEditingSession(session);
                    setSelectedEvent(null);
                  }
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit Session
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Cancel Session
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Session?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to cancel this session? The client will be notified via email.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Keep Session
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedEvent) {
                  deleteSessionMutation.mutate({ sessionId: selectedEvent.id });
                }
              }}
              disabled={deleteSessionMutation.isPending}
            >
              {deleteSessionMutation.isPending ? "Cancelling..." : "Cancel Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Session Modal */}
      {editingSession && (
        <SessionEditModal
          session={editingSession}
          open={!!editingSession}
          onOpenChange={(open) => !open && setEditingSession(null)}
          onSuccess={() => {
            setEditingSession(null);
            utils.trainingSessions.invalidate();
          }}
        />
      )}
    </>
  );
}
