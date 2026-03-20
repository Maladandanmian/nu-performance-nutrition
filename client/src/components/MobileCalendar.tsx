import { useState, useMemo, useCallback } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Clock, User, DollarSign } from "lucide-react";

interface MobileCalendarProps {
  trainerId: number;
}

type ViewMode = "today" | "three-day";

const SESSION_TYPE_COLORS: Record<string, { bg: string; border: string }> = {
  "1on1_pt": { bg: "#3b82f6", border: "#2563eb" },
  "2on1_pt": { bg: "#8b5cf6", border: "#7c3aed" },
  "nutrition_initial": { bg: "#ec4899", border: "#db2777" },
  "nutrition_coaching": { bg: "#f59e0b", border: "#d97706" },
  "custom": { bg: "#06b6d4", border: "#0891b2" },
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  "1on1_pt": "1-on-1 PT",
  "2on1_pt": "2-on-1 PT",
  "nutrition_initial": "Nutrition Initial",
  "nutrition_coaching": "Nutrition Coaching",
  "custom": "Custom",
};

function getSessionDisplayLabel(session: any): string {
  if (session.sessionType === "custom" && session.customSessionName) {
    return session.customSessionName;
  }
  return SESSION_TYPE_LABELS[session.sessionType] || session.sessionType;
}

export function MobileCalendar({ trainerId }: MobileCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  // Fetch all sessions for the trainer
  const { data: sessions } = trpc.trainingSessions.getByTrainer.useQuery({});

  // Get the date range to display
  const dateRange = useMemo(() => {
    const start = startOfDay(currentDate);
    const end = viewMode === "today" ? addDays(start, 1) : addDays(start, 3);
    return { start, end };
  }, [currentDate, viewMode]);

  // Filter sessions for the current date range
  const displayedSessions = useMemo(() => {
    if (!sessions) return [];
    
    return sessions
      .filter((session: any) => {
        const sessionDate = startOfDay(new Date(session.sessionDate));
        return sessionDate >= dateRange.start && sessionDate < dateRange.end;
      })
      .sort((a: any, b: any) => {
        const dateCompare = new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime();
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [sessions, dateRange]);

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    displayedSessions.forEach((session: any) => {
      const dateKey = format(new Date(session.sessionDate), "yyyy-MM-dd");
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(session);
    });
    return grouped;
  }, [displayedSessions]);

  // Get dates to display
  const datesToDisplay = useMemo(() => {
    const dates = [];
    const start = startOfDay(currentDate);
    const count = viewMode === "today" ? 1 : 3;
    for (let i = 0; i < count; i++) {
      dates.push(addDays(start, i));
    }
    return dates;
  }, [currentDate, viewMode]);

  const handlePreviousDay = useCallback(() => {
    setCurrentDate((prev) => addDays(prev, -1));
  }, []);

  const handleNextDay = useCallback(() => {
    setCurrentDate((prev) => addDays(prev, 1));
  }, []);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header with view toggle and navigation */}
      <div className="border-b p-4 space-y-3">
        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("today")}
            className="flex-1"
          >
            Today
          </Button>
          <Button
            variant={viewMode === "three-day" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("three-day")}
            className="flex-1"
          >
            3 Days
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreviousDay}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToday}
            className="text-sm"
          >
            {format(currentDate, "MMM d, yyyy")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextDay}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-4 min-w-min">
          {datesToDisplay.map((date) => {
            const dateKey = format(date, "yyyy-MM-dd");
            const daySessionsForDate = sessionsByDate[dateKey] || [];

            return (
              <div
                key={dateKey}
                className="flex-shrink-0 w-80 border rounded-lg bg-card p-4 space-y-3"
              >
                {/* Day Header */}
                <div className="border-b pb-3">
                  <h3 className="font-semibold text-lg">
                    {format(date, "EEE, MMM d")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {daySessionsForDate.length} session{daySessionsForDate.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Sessions List */}
                {daySessionsForDate.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {daySessionsForDate.map((session: any) => {
                      const colors =
                        SESSION_TYPE_COLORS[session.sessionType] ||
                        SESSION_TYPE_COLORS["1on1_pt"];

                      return (
                        <button
                          key={session.id}
                          onClick={() => setSelectedSession(session)}
                          className="w-full text-left p-3 rounded-lg border-2 transition-all hover:shadow-md"
                          style={{
                            backgroundColor: colors.bg,
                            borderColor: colors.border,
                            color: "white",
                          }}
                        >
                          <div className="font-semibold text-sm">
                            {getSessionDisplayLabel(session)}
                          </div>
                          <div className="text-xs opacity-90 mt-1">
                            {session.startTime} - {session.endTime}
                          </div>
                          <div className="text-xs opacity-90">
                            {session.client?.name || "Unknown Client"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No sessions scheduled</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Session Details Modal */}
      {selectedSession && (
        <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
          <DialogContent className="w-full max-w-sm">
            <DialogHeader>
              <DialogTitle>{getSessionDisplayLabel(selectedSession)}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Session Type Badge */}
              <div>
                <Badge
                  style={{
                    backgroundColor:
                      SESSION_TYPE_COLORS[selectedSession.sessionType]?.bg ||
                      SESSION_TYPE_COLORS["1on1_pt"].bg,
                    color: "white",
                  }}
                >
                  {SESSION_TYPE_LABELS[selectedSession.sessionType] || selectedSession.sessionType}
                </Badge>
              </div>

              {/* Client */}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedSession.client?.name || "Unknown"}</p>
                </div>
              </div>

              {/* Date and Time */}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {format(new Date(selectedSession.sessionDate), "MMM d, yyyy")} •{" "}
                    {selectedSession.startTime} - {selectedSession.endTime}
                  </p>
                </div>
              </div>

              {/* Price */}
              {selectedSession.customPrice !== null ? (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Price</p>
                    <p className="font-medium">£{selectedSession.customPrice}</p>
                  </div>
                </div>
              ) : null}

              {/* Payment Status */}
              <div>
                <p className="text-sm text-muted-foreground">Payment Status</p>
                <Badge variant="outline" className="mt-1">
                  {selectedSession.paymentStatus === "from_package"
                    ? "From Package"
                    : selectedSession.paymentStatus}
                </Badge>
              </div>

              {/* Notes */}
              {selectedSession.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm mt-1">{selectedSession.notes}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
