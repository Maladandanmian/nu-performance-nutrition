import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

interface TodaysSummaryProps {
  clientId: number;
}

interface CircularProgressProps {
  value: number;
  max: number;
  label: string;
  unit: string;
  emoji: string;
  color: string;
}

function CircularProgress({ value, max, label, unit, emoji, color }: CircularProgressProps) {
  const actualPercentage = max > 0 ? (value / max) * 100 : 0;
  const displayPercentage = Math.min(actualPercentage, 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayPercentage / 100) * circumference;
  
  // Determine base color (always green when at or over 100%)
  let statusColor = "#10b981"; // green
  if (actualPercentage < 90) {
    statusColor = "#ef4444"; // red (under target)
  } else if (actualPercentage < 100) {
    statusColor = "#f59e0b"; // orange (close to target)
  }
  
  // Determine warning color and dash pattern for over-target
  let warningColor: string | null = null;
  let useDashedStroke = false;
  
  if (actualPercentage > 100) {
    useDashedStroke = true;
    if (actualPercentage <= 120) {
      warningColor = "#f59e0b"; // orange (slightly over)
    } else {
      warningColor = "#ef4444"; // red (significantly over)
    }
  }
  
  // Create alternating dash pattern that divides evenly into circumference
  // Circumference ≈ 251.3, use 12 segments of ~20.94 units each (10.47 dash + 10.47 gap)
  const segmentCount = 12;
  const dashLength = circumference / (segmentCount * 2); // Half segment for dash, half for gap
  const dashPattern = useDashedStroke ? `${dashLength} ${dashLength}` : undefined;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="transform -rotate-90 w-24 h-24">
          {/* Background circle */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="#e5e7eb"
            strokeWidth="8"
            fill="none"
          />
          {/* Progress circle (green base) */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke={statusColor}
            strokeWidth="8"
            fill="none"
            strokeDasharray={dashPattern ? `${dashPattern} ${circumference}` : circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="butt"
            className="transition-all duration-500"
          />
          {/* Warning color segments (alternating with green) */}
          {useDashedStroke && warningColor && (
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke={warningColor}
              strokeWidth="8"
              fill="none"
              strokeDasharray={`0 ${dashLength} ${dashLength} ${dashLength}`}
              strokeDashoffset={strokeDashoffset - dashLength}
              strokeLinecap="butt"
              className="transition-all duration-500"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl">{emoji}</span>
          <span className="text-xs font-semibold">{Math.round(actualPercentage)}%</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">
          {value} / {max} {unit}
        </div>
      </div>
    </div>
  );
}

export default function TodaysSummary({ clientId }: TodaysSummaryProps) {
  // Get today's meal totals
  const timezoneOffset = new Date().getTimezoneOffset(); // Get client timezone offset in minutes
  const { data: dailyData, isLoading } = trpc.meals.dailyTotals.useQuery({
    clientId,
    days: 1, // Just today
    timezoneOffset, // Pass client timezone to server
  });

  // Get nutrition goals
  const { data: goals } = trpc.nutritionGoals.get.useQuery({ clientId });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-48 mb-4"></div>
          <div className="flex gap-4 justify-around">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 bg-muted rounded-full"></div>
                <div className="h-4 bg-muted rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!goals || !dailyData || dailyData.dailyTotals.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">📊 Today's Summary</h3>
        <p className="text-sm text-muted-foreground">
          No meals logged today. Start tracking to see your progress!
        </p>
      </Card>
    );
  }

  // Get today's data (first item since we requested 1 day)
  const today = dailyData.dailyTotals[0];
  
  const nutrients = [
    {
      label: "Calories",
      value: today.calories,
      max: goals.caloriesTarget,
      unit: "kcal",
      emoji: "🔥",
      color: "#3b82f6",
    },
    {
      label: "Protein",
      value: today.protein,
      max: goals.proteinTarget,
      unit: "g",
      emoji: "💪",
      color: "#8b5cf6",
    },
    {
      label: "Fat",
      value: today.fat,
      max: goals.fatTarget,
      unit: "g",
      emoji: "🥑",
      color: "#10b981",
    },
    {
      label: "Carbs",
      value: today.carbs,
      max: goals.carbsTarget,
      unit: "g",
      emoji: "🍞",
      color: "#f59e0b",
    },
    {
      label: "Fiber",
      value: today.fibre,
      max: goals.fibreTarget,
      unit: "g",
      emoji: "🌾",
      color: "#84cc16",
    },
    {
      label: "Hydration",
      value: today.hydration || 0,
      max: goals.hydrationTarget,
      unit: "ml",
      emoji: "💧",
      color: "#06b6d4",
    },
  ];

  return (
    <Card className="p-6 bg-gradient-to-br from-background to-muted/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">📊 Today's Summary</h3>
        <span className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'short', 
            day: 'numeric',
            timeZone: 'Asia/Hong_Kong'
          })}
        </span>
      </div>
      <div className="flex gap-6 justify-around flex-wrap">
        {nutrients.map((nutrient) => (
          <CircularProgress key={nutrient.label} {...nutrient} />
        ))}
      </div>
    </Card>
  );
}
