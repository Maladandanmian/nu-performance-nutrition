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
  const [timeRange, setTimeRange] = useState<"all" | "30" | "7" | "today">("all");
  const [smoothing, setSmoothing] = useState(true);

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
        start.setDate(start.getDate() - 6); // Last 7 days including today
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

  const { data: allTrendData = [] } = trpc.strengthTests.getGripStrengthTrend.useQuery({
    clientId,
  });
  
  // Filter data based on time range on the frontend
  const { start, end } = getDateRange();
  
  // Include the last test BEFORE the range for proper forward-fill
  const testsInRange = allTrendData.filter(test => {
    const testDate = new Date(test.date);
    return testDate >= start && testDate <= end;
  });
  
  // Find the last test before the range start
  const lastTestBeforeRange = allTrendData
    .filter(test => new Date(test.date) < start)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  
  // Combine: last test before range + tests in range
  const trendData = lastTestBeforeRange 
    ? [lastTestBeforeRange, ...testsInRange]
    : testsInRange;


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

  // Forward-fill logic: duplicate last known value for each day
  const forwardFillData = () => {
    if (trendData.length === 0) return [];

    const filled: Array<{ date: Date; value: number; score: string; isActual: boolean }> = [];
    const sortedTests = [...trendData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Always start from the selected range start (e.g., 7 days ago for "Last 7 Days")
    const startDate = new Date(start);
    const endDate = new Date(); // Always end at today
    
    // Check if the first test in sortedTests is before the range start
    // If so, use it as the initial value and mark hasSeenFirstTest as true
    const firstTest = sortedTests[0];
    const firstTestDate = new Date(firstTest.date);
    const isFirstTestBeforeRange = firstTestDate < startDate;
    
    let currentValue = firstTest.value;
    let currentScore = firstTest.score;
    let hasSeenFirstTest = isFirstTestBeforeRange; // Start true if we have a test before range
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      // Check if there's an actual test on this date
      const actualTest = sortedTests.find(t => new Date(t.date).toISOString().split('T')[0] === dateStr);
      
      if (actualTest) {
        currentValue = actualTest.value;
        currentScore = actualTest.score;
        hasSeenFirstTest = true;
        filled.push({
          date: new Date(d),
          value: currentValue,
          score: currentScore,
          isActual: true,
        });
      } else if (hasSeenFirstTest) {
        // Forward-fill with last known value (only after we've seen the first test)
        filled.push({
          date: new Date(d),
          value: currentValue,
          score: currentScore,
          isActual: false,
        });
      }
    }
    
    return filled;
  };

  const filledData = forwardFillData();
  
  // Format chart data
  const chartData = filledData.map(item => ({
    date: item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: item.value,
    score: item.score,
    isActual: item.isActual,
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
      {trendData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Grip Strength Trend</CardTitle>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSmoothing(!smoothing)}
                >
                  Smoothing: {smoothing ? "On" : "Off"}
                </Button>
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
                  type={smoothing ? "monotone" : "linear"}
                  dataKey="value" 
                  stroke="#578DB3" 
                  strokeWidth={2}
                  strokeDasharray="0"
                  dot={(props: any) => {
                    const { cx, cy, payload, index } = props;
                    if (payload.isActual) {
                      return <circle key={`actual-${index}`} cx={cx} cy={cy} r={4} fill="#578DB3" stroke="white" strokeWidth={2} />;
                    }
                    return <circle key={`filled-${index}`} cx={cx} cy={cy} r={0} />;
                  }}
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
