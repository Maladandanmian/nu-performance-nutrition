import { useState, useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
    sessionType?: string;
    classType?: string;
    paymentStatus?: string;
    trainer?: string;
  };
}

interface ClientCalendarProps {
  clientId: number;
}

export function ClientCalendar({ clientId }: ClientCalendarProps) {
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Fetch all sessions for the client
  const { data: sessions } = trpc.trainingSessions.getByClient.useQuery({
    clientId,
  });

  // Fetch all group classes for the client
  const { data: groupClasses } = trpc.groupClasses.getByClient.useQuery({
    clientId,
  });

  // Transform sessions and group classes into calendar events
  const events: CalendarEvent[] = useMemo(() => {
    const sessionEvents: CalendarEvent[] =
      sessions?.map((session) => {
        const sessionDate = new Date(session.sessionDate);
        const [startHour, startMinute] = session.startTime.split(":").map(Number);
        const [endHour, endMinute] = session.endTime.split(":").map(Number);

        const start = new Date(sessionDate);
        start.setHours(startHour, startMinute, 0);

        const end = new Date(sessionDate);
        end.setHours(endHour, endMinute, 0);

        return {
          id: session.id,
          title: session.sessionType,
          start,
          end,
          resource: {
            type: "session" as const,
            sessionType: session.sessionType,
            paymentStatus: session.paymentStatus,
            trainer: "Your Trainer", // TODO: Get trainer name from session
          },
        };
      }) || [];

    const groupClassEvents: CalendarEvent[] =
      groupClasses?.map((groupClass) => {
        const classDate = new Date(groupClass.classDate);
        const [startHour, startMinute] = groupClass.startTime.split(":").map(Number);
        const [endHour, endMinute] = groupClass.endTime.split(":").map(Number);

        const start = new Date(classDate);
        start.setHours(startHour, startMinute, 0);

        const end = new Date(classDate);
        end.setHours(endHour, endMinute, 0);

        return {
          id: groupClass.id,
          title: `Group: ${groupClass.classType}`,
          start,
          end,
          resource: {
            type: "group_class" as const,
            classType: groupClass.classType,
          },
        };
      }) || [];

    return [...sessionEvents, ...groupClassEvents];
  }, [sessions, groupClasses]);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const isSession = event.resource.type === "session";
    const backgroundColor = isSession ? "#3b82f6" : "#10b981";
    const borderColor = isSession ? "#2563eb" : "#059669";

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
          <CardTitle>My Training Schedule</CardTitle>
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
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
