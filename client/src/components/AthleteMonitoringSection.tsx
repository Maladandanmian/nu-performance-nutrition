import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  LineChart,
} from "recharts";

const METRICS = {
  fatigue: {
    label: "Fatigue",
    descriptions: {
      1: "Always tired",
      2: "More tired than normal",
      3: "Normal",
      4: "Fresh",
      5: "Very fresh",
    },
    color: "#ef4444", // red
  },
  sleepQuality: {
    label: "Sleep Quality",
    descriptions: {
      1: "Insomnia",
      2: "Restless",
      3: "Difficulty falling asleep",
      4: "Good",
      5: "Very restful",
    },
    color: "#3b82f6", // blue
  },
  muscleSoreness: {
    label: "General Muscle Soreness",
    descriptions: {
      1: "Very sore",
      2: "Increase in muscle soreness",
      3: "Normal",
      4: "Good",
      5: "Feeling good",
    },
    color: "#f59e0b", // amber
  },
  stressLevels: {
    label: "Stress Levels",
    descriptions: {
      1: "Very stressed",
      2: "Stressed",
      3: "Normal",
      4: "Relaxed",
      5: "Very relaxed",
    },
    color: "#8b5cf6", // purple
  },
  mood: {
    label: "Mood",
    descriptions: {
      1: "Highly annoyed, irritable or down",
      2: "Snappiness at teammates or family",
      3: "Less interested in activities than normal",
      4: "Generally good mood",
      5: "Very positive mood",
    },
    color: "#10b981", // green
  },
};

interface AthleteMonitoringSectionProps {
  clientId: number;
  isTrainer?: boolean;
}

export function AthleteMonitoringSection({
  clientId,
  isTrainer = false,
}: AthleteMonitoringSectionProps) {

  const [timeRange, setTimeRange] = useState("7");
  
  // Form state
  const [fatigue, setFatigue] = useState(3);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [muscleSoreness, setMuscleSoreness] = useState(3);
  const [stressLevels, setStressLevels] = useState(3);
  const [mood, setMood] = useState(3);

  // Queries
  const { data: lastSubmission, refetch: refetchLast } =
    trpc.athleteMonitoring.getLastSubmission.useQuery({ clientId });

  // Check if last submission was today
  const isSubmittedToday = useMemo(() => {
    if (!lastSubmission) return false;
    const submittedDate = new Date(lastSubmission.submittedAt);
    const today = new Date();
    return (
      submittedDate.getDate() === today.getDate() &&
      submittedDate.getMonth() === today.getMonth() &&
      submittedDate.getFullYear() === today.getFullYear()
    );
  }, [lastSubmission]);

  // Pre-fill form with today's submission values
  useEffect(() => {
    if (lastSubmission && isSubmittedToday) {
      setFatigue(lastSubmission.fatigue);
      setSleepQuality(lastSubmission.sleepQuality);
      setMuscleSoreness(lastSubmission.muscleSoreness);
      setStressLevels(lastSubmission.stressLevels);
      setMood(lastSubmission.mood);
    }
  }, [lastSubmission, isSubmittedToday]);

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - parseInt(timeRange));
    return { startDate: start, endDate: end };
  }, [timeRange]);

  const { data: trendData = [], refetch: refetchTrend } = trpc.athleteMonitoring.getTrend.useQuery({
    clientId,
    startDate,
    endDate,
  });

  // Mutation
  const submitMutation = trpc.athleteMonitoring.submit.useMutation({
    onSuccess: () => {
      toast.success("Wellness check-in submitted successfully");
      refetchLast();
      refetchTrend();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = () => {
    submitMutation.mutate({
      clientId,
      fatigue,
      sleepQuality,
      muscleSoreness,
      stressLevels,
      mood,
    });
  };

  // Format trend data for chart
  const chartData = useMemo(() => {
    return trendData.map((entry: any) => ({
      date: new Date(entry.submittedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      Fatigue: entry.fatigue,
      "Sleep Quality": entry.sleepQuality,
      "Muscle Soreness": entry.muscleSoreness,
      "Stress Levels": entry.stressLevels,
      Mood: entry.mood,
    }));
  }, [trendData]);

  // Custom dot component that adds jitter for overlapping points
  const CustomDot = (props: any) => {
    const { cx, cy, dataKey, payload } = props;
    
    // Get all metric values at this data point
    const values: { [key: string]: any } = {
      Fatigue: payload.Fatigue,
      "Sleep Quality": payload["Sleep Quality"],
      "Muscle Soreness": payload["Muscle Soreness"],
      "Stress Levels": payload["Stress Levels"],
      Mood: payload.Mood,
    };
    
    // Find which metrics share the same value as current metric
    const currentValue = values[dataKey];
    const overlappingMetrics = Object.keys(values).filter(
      (key) => values[key] === currentValue
    );
    const overlapCount = overlappingMetrics.length;
    
    // Calculate horizontal offset if there are overlaps
    let xOffset = 0;
    if (overlapCount > 1) {
      const metricIndex = overlappingMetrics.indexOf(dataKey);
      // Spread points horizontally: -6, -3, 0, 3, 6 pixels for up to 5 overlaps
      const spacing = 6;
      const totalWidth = spacing * (overlapCount - 1);
      xOffset = (metricIndex * spacing) - (totalWidth / 2);
    }
    
    const color = METRICS[
      dataKey === "Fatigue" ? "fatigue" :
      dataKey === "Sleep Quality" ? "sleepQuality" :
      dataKey === "Muscle Soreness" ? "muscleSoreness" :
      dataKey === "Stress Levels" ? "stressLevels" : "mood"
    ].color;
    
    return (
      <circle
        cx={cx + xOffset}
        cy={cy}
        r={5}
        fill={color}
        stroke="white"
        strokeWidth={2}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Last Submission Indicator */}
      {lastSubmission && (
        <Card className="p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Last Submission:{" "}
            <span className="font-medium text-foreground">
              {new Date(lastSubmission.submittedAt).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </p>
        </Card>
      )}

      {/* Submission Form (Client Only) */}
      {!isTrainer && (
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6">Daily Wellness Check-In</h2>
          <div className="space-y-8">
            {Object.entries(METRICS).map(([key, config]) => {
              const value =
                key === "fatigue"
                  ? fatigue
                  : key === "sleepQuality"
                  ? sleepQuality
                  : key === "muscleSoreness"
                  ? muscleSoreness
                  : key === "stressLevels"
                  ? stressLevels
                  : mood;

              const setValue =
                key === "fatigue"
                  ? setFatigue
                  : key === "sleepQuality"
                  ? setSleepQuality
                  : key === "muscleSoreness"
                  ? setMuscleSoreness
                  : key === "stressLevels"
                  ? setStressLevels
                  : setMood;

              return (
                <div key={key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      {config.label}
                    </Label>
                    <span className="text-2xl font-bold">{value}</span>
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={(vals) => setValue(vals[0])}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    {config.descriptions[value as keyof typeof config.descriptions]}
                  </p>
                </div>
              );
            })}

            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || isSubmittedToday}
              className="w-full"
              size="lg"
            >
              {submitMutation.isPending
                ? "Submitting..."
                : isSubmittedToday
                ? "Already Submitted Today"
                : "Submit Check-In"}
            </Button>
            {isSubmittedToday && (
              <p className="text-sm text-muted-foreground text-center">
                You can submit again tomorrow
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Trend Visualization */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Wellness Trends</h2>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
              <SelectItem value="365">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {chartData.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No wellness data available for the selected time range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 6]} ticks={[1, 2, 3, 4, 5]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="Fatigue"
                stroke={METRICS.fatigue.color}
                strokeWidth={2}
                dot={<CustomDot />}
              />
              <Line
                type="monotone"
                dataKey="Sleep Quality"
                stroke={METRICS.sleepQuality.color}
                strokeWidth={2}
                dot={<CustomDot />}
              />
              <Line
                type="monotone"
                dataKey="Muscle Soreness"
                stroke={METRICS.muscleSoreness.color}
                strokeWidth={2}
                dot={<CustomDot />}
              />
              <Line
                type="monotone"
                dataKey="Stress Levels"
                stroke={METRICS.stressLevels.color}
                strokeWidth={2}
                dot={<CustomDot />}
              />
              <Line
                type="monotone"
                dataKey="Mood"
                stroke={METRICS.mood.color}
                strokeWidth={2}
                dot={<CustomDot />}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
