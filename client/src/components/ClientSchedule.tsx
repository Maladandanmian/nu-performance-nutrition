import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, Dumbbell, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SESSION_TYPE_LABELS: Record<string, string> = {
  "1on1_pt": "1-on-1 Personal Training",
  "2on1_pt": "2-on-1 Personal Training",
  "nutrition_initial": "Initial Nutrition Consultation",
  "nutrition_coaching": "Nutrition Coaching Session",
};

const CLASS_TYPE_LABELS: Record<string, string> = {
  hyrox: "Hyrox",
  mobility: "Mobility",
  rehab: "Rehab",
  conditioning: "Conditioning",
  strength_conditioning: "Strength & Conditioning",
};

interface ClientScheduleProps {
  clientId: number;
}

export function ClientSchedule({ clientId }: ClientScheduleProps) {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Fetch upcoming sessions
  const { data: sessions, isLoading: sessionsLoading } = trpc.trainingSessions.getUpcoming.useQuery({
    clientId,
    days: 30,
  });

  // Fetch upcoming group classes
  const { data: groupClasses, isLoading: classesLoading } = trpc.groupClasses.getClientClasses.useQuery({
    clientId,
    days: 30,
  });

  const isLoading = sessionsLoading || classesLoading;

  // Combine and sort all events by date
  const allEvents = [
    ...(sessions || []).map(s => ({
      ...s,
      type: 'session' as const,
      dateTime: `${s.sessionDate} ${s.startTime}`,
    })),
    ...(groupClasses || []).map(c => ({
      ...c,
      type: 'class' as const,
      dateTime: `${c.classDate} ${c.startTime}`,
    })),
  ].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  // Group events by date
  const eventsByDate: Record<string, typeof allEvents> = {};
  allEvents.forEach(event => {
    const dateValue = event.type === 'session' ? event.sessionDate : event.classDate;
    const dateStr = dateValue instanceof Date ? dateValue.toISOString().split('T')[0] : String(dateValue);
    if (!eventsByDate[dateStr]) {
      eventsByDate[dateStr] = [];
    }
    eventsByDate[dateStr].push(event);
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            My Training Schedule
          </CardTitle>
          <CardDescription>Loading your upcoming sessions...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            My Training Schedule
          </CardTitle>
          <CardDescription>Your upcoming training sessions and group classes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No upcoming sessions scheduled</p>
            <p className="text-sm mt-1">Contact your trainer to book sessions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            My Training Schedule
          </CardTitle>
          <CardDescription>
            {allEvents.length} {allEvents.length === 1 ? 'session' : 'sessions'} in the next 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(eventsByDate).map(([date, events]) => (
              <div key={date} className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-gray-900 mb-2">{formatDate(date)}</h3>
                <div className="space-y-2">
                  {events.map((event, idx) => (
                    <button
                      key={`${event.type}-${event.id}-${idx}`}
                      onClick={() => setSelectedEvent(event)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {event.type === 'session' ? (
                            <Dumbbell className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Users className="h-5 w-5 text-purple-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {event.type === 'session' 
                              ? SESSION_TYPE_LABELS[event.sessionType] 
                              : CLASS_TYPE_LABELS[event.classType]}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <Clock className="h-4 w-4" />
                            {formatTime(event.startTime)} - {formatTime(event.endTime)}
                          </div>
                          {event.notes && (
                            <div className="text-sm text-gray-500 mt-1">{event.notes}</div>
                          )}
                        </div>
                        <div className="text-right">
                          {event.type === 'class' && (
                            <span className="inline-block px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                              Group Class
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Event Detail Modal */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent?.type === 'session' ? (
                <Dumbbell className="h-5 w-5 text-blue-600" />
              ) : (
                <Users className="h-5 w-5 text-purple-600" />
              )}
              {selectedEvent && (selectedEvent.type === 'session' 
                ? SESSION_TYPE_LABELS[selectedEvent.sessionType]
                : CLASS_TYPE_LABELS[selectedEvent.classType])}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-500">Date</div>
                <div className="text-base">
                  {formatDate(selectedEvent.type === 'session' ? selectedEvent.sessionDate : selectedEvent.classDate)}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Time</div>
                <div className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {formatTime(selectedEvent.startTime)} - {formatTime(selectedEvent.endTime)}
                </div>
              </div>
              {selectedEvent.notes && (
                <div>
                  <div className="text-sm font-medium text-gray-500">Notes</div>
                  <div className="text-base">{selectedEvent.notes}</div>
                </div>
              )}
              {selectedEvent.type === 'class' && (
                <div>
                  <div className="text-sm font-medium text-gray-500">Type</div>
                  <div className="text-base">Group Class</div>
                </div>
              )}
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600">
                  If you need to reschedule or cancel, please contact your trainer at least 24 hours in advance.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
