import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Plus } from "lucide-react";

interface GripStrengthSectionProps {
  clientId: number;
  clientGender: "male" | "female" | "other" | null;
  clientAge: number | null;
  isTrainer: boolean;
}

export function GripStrengthSection({ clientId, clientGender, clientAge, isTrainer }: GripStrengthSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [gripValue, setGripValue] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [timeRange, setTimeRange] = useState<"all" | "30" | "7" | "today">("30");

  const utils = trpc.useUtils();

  // Get latest test
  const { data: latestTest } = trpc.strengthTests.getLatestGripStrength.useQuery({ clientId });

  // Calculate date range for trend
  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    
    switch (timeRange) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "7":
        start.setDate(start.getDate() - 7);
        break;
      case "30":
        start.setDate(start.getDate() - 30);
        break;
      case "all":
        start.setFullYear(start.getFullYear() - 10); // 10 years back
        break;
    }
    
    return { start, end };
  };

  const { start, end } = getDateRange();
  const { data: trendData = [] } = trpc.strengthTests.getGripStrengthTrend.useQuery({
    clientId,
    startDate: start,
    endDate: end,
  });

  // Add grip strength mutation
  const addGripStrengthMutation = trpc.strengthTests.addGripStrength.useMutation({
    onSuccess: (data) => {
      toast.success(`Grip strength recorded: ${gripValue}kg - ${data.score}`);
      utils.strengthTests.getLatestGripStrength.invalidate({ clientId });
      utils.strengthTests.getGripStrengthTrend.invalidate();
      setIsAddDialogOpen(false);
      setGripValue("");
      setNotes("");
    },
    onError: (error) => {
      toast.error(`Failed to record grip strength: ${error.message}`);
    },
  });

  // Format chart data
  const chartData = trendData.map(test => ({
    date: new Date(test.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: test.value,
    score: test.score,
  }));

  // Calculate normal range lines based on gender and age
  const getNormalRange = () => {
    const effectiveGender = clientGender === "female" ? "female" : "male";
    let ageGroup: string;
    
    if (!clientAge || clientAge < 20) {
      ageGroup = "20-39";
    } else if (clientAge >= 20 && clientAge <= 39) {
      ageGroup = "20-39";
    } else if (clientAge >= 40 && clientAge <= 59) {
      ageGroup = "40-59";
    } else {
      ageGroup = "60+";
    }

    const ranges: Record<string, Record<string, { min: number; max: number }>> = {
      male: {
        "20-39": { min: 44, max: 55 },
        "40-59": { min: 36, max: 50 },
        "60+": { min: 30, max: 42 },
      },
      female: {
        "20-39": { min: 26, max: 35 },
        "40-59": { min: 22, max: 32 },
        "60+": { min: 18, max: 28 },
      },
    };

    return ranges[effectiveGender][ageGroup];
  };

  const normalRange = getNormalRange();

  // Get score color
  const getScoreColor = (score: string) => {
    switch (score) {
      case "Weak":
        return "#ef4444"; // red
      case "Normal":
        return "#22c55e"; // green
      case "Strong":
        return "#3b82f6"; // blue
      default:
        return "#6b7280"; // gray
    }
  };

  return (
    <div className="space-y-6">
      {/* Latest Test Result */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Grip Strength</CardTitle>
              <CardDescription>Track grip strength test results over time</CardDescription>
            </div>
            {isTrainer && (
              <Button onClick={() => setIsAddDialogOpen(true)} style={{ backgroundColor: '#578DB3' }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Test
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {latestTest ? (
            <div className="space-y-2">
              <p className="text-2xl font-bold">
                Last Test: {latestTest.value}kg -{" "}
                <span style={{ color: getScoreColor(latestTest.score) }}>
                  {latestTest.score}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Tested on {new Date(latestTest.testedAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              {latestTest.notes && (
                <p className="text-sm text-muted-foreground">Notes: {latestTest.notes}</p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No grip strength tests recorded yet</p>
          )}
        </CardContent>
      </Card>

      {/* Trend Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Grip Strength Trend</CardTitle>
              <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'Grip Strength (kg)', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded shadow-lg">
                          <p className="font-semibold">{data.date}</p>
                          <p>Value: {data.value}kg</p>
                          <p style={{ color: getScoreColor(data.score) }}>
                            Score: {data.score}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                {/* Normal range reference lines */}
                <ReferenceLine 
                  y={normalRange.min} 
                  stroke="#22c55e" 
                  strokeDasharray="3 3" 
                  label={{ value: 'Normal Min', position: 'right' }}
                />
                <ReferenceLine 
                  y={normalRange.max} 
                  stroke="#22c55e" 
                  strokeDasharray="3 3" 
                  label={{ value: 'Normal Max', position: 'right' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#578DB3" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Grip Strength (kg)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Add Test Dialog (Trainer Only) */}
      {isTrainer && (
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Grip Strength Test</DialogTitle>
              <DialogDescription>
                Record a new grip strength test result for this client
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="grip-value">Grip Strength (kg)</Label>
                <Input
                  id="grip-value"
                  type="number"
                  min="0"
                  step="0.1"
                  value={gripValue}
                  onChange={(e) => setGripValue(e.target.value)}
                  placeholder="e.g., 45.5"
                />
              </div>
              <div>
                <Label htmlFor="test-date">Test Date</Label>
                <Input
                  id="test-date"
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any observations or comments"
                />
              </div>
              <Button
                onClick={() => {
                  if (!gripValue) {
                    toast.error("Please enter a grip strength value");
                    return;
                  }
                  addGripStrengthMutation.mutate({
                    clientId,
                    value: parseFloat(gripValue),
                    testedAt: new Date(testDate),
                    notes: notes || undefined,
                  });
                }}
                disabled={addGripStrengthMutation.isPending}
                style={{ backgroundColor: '#578DB3' }}
                className="w-full"
              >
                {addGripStrengthMutation.isPending ? "Recording..." : "Record Test"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
