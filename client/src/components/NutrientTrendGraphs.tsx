import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from "date-fns";

interface NutrientTrendGraphsProps {
  clientId: number;
  days?: number;
}

export function NutrientTrendGraphs({ clientId, days = 14 }: NutrientTrendGraphsProps) {
  const timezoneOffset = new Date().getTimezoneOffset();
  const { data, isLoading, error } = trpc.meals.dailyTotals.useQuery({ 
    clientId, 
    days,
    timezoneOffset
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600">
        <p>Failed to load nutrition trends: {error.message}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        <span className="text-4xl mb-4 block">📊</span>
        <p className="text-lg font-medium">Unable to load data</p>
      </div>
    );
  }

  const { dailyTotals, goals } = data;

  // Generate date range for the last N days
  const generateDateRange = (days: number) => {
    const dates = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const dateRange = generateDateRange(days);

  // Create a map of existing data
  const dataMap = new Map(dailyTotals.map(day => [day.date, day]));

  // Format data for charts - include all dates with targets, fill in actual data where available
  const chartData = dateRange.map(date => {
    const dayData = dataMap.get(date);
    return {
      date: format(new Date(date), 'MMM d'),
      fullDate: date,
      calories: dayData?.calories || null,
      caloriesTarget: goals.calories,
      protein: dayData?.protein || null,
      proteinTarget: goals.protein,
      fat: dayData?.fat || null,
      fatTarget: goals.fat,
      carbs: dayData?.carbs || null,
      carbsTarget: goals.carbs,
      fibre: dayData?.fibre || null,
      fibreTarget: goals.fibre,
    };
  });

  const hasAnyData = dailyTotals.length > 0;

  const nutrients = [
    { 
      key: 'calories', 
      label: 'Calories', 
      unit: 'kcal', 
      color: '#CE4C27', 
      targetColor: '#CE4C27',
      emoji: '🔥'
    },
    { 
      key: 'protein', 
      label: 'Protein', 
      unit: 'g', 
      color: '#578DB3', 
      targetColor: '#578DB3',
      emoji: '💪'
    },
    { 
      key: 'fat', 
      label: 'Fat', 
      unit: 'g', 
      color: '#86BBD8', 
      targetColor: '#86BBD8',
      emoji: '🥑'
    },
    { 
      key: 'carbs', 
      label: 'Carbohydrates', 
      unit: 'g', 
      color: '#F2CC8F', 
      targetColor: '#F2CC8F',
      emoji: '🍞'
    },
    { 
      key: 'fibre', 
      label: 'Fiber', 
      unit: 'g', 
      color: '#81B29A', 
      targetColor: '#81B29A',
      emoji: '🌾'
    },
  ];

  return (
    <div className="space-y-6">
      {nutrients.map(nutrient => {
        const targetValue = goals[nutrient.key as keyof typeof goals];
        
        return (
          <Card key={nutrient.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-xl">{nutrient.emoji}</span>
                {nutrient.label} Trend
              </CardTitle>
              <CardDescription>
                Last {days} days | Target: {targetValue} {nutrient.unit}/day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    label={{ value: nutrient.unit, angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return format(new Date(payload[0].payload.fullDate), 'MMM d, yyyy');
                      }
                      return label;
                    }}
                  />
                  <Legend />
                  
                  {/* Target line (dashed) */}
                  <Line 
                    type="monotone" 
                    dataKey={`${nutrient.key}Target`}
                    stroke={nutrient.targetColor}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name={`Target (${targetValue} ${nutrient.unit})`}
                    dot={false}
                  />
                  
                  {/* Actual consumption line (solid) */}
                  <Line 
                    type="monotone" 
                    dataKey={nutrient.key}
                    stroke={nutrient.color}
                    strokeWidth={3}
                    name={`Actual ${nutrient.label}`}
                    dot={{ fill: nutrient.color, r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              
              {/* Summary stats */}
              <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <p className="text-gray-600">Average</p>
                  <p className="text-lg font-semibold" style={{ color: nutrient.color }}>
                    {hasAnyData ? (
                      <>{Math.round(chartData.reduce((sum, d) => sum + ((d[nutrient.key as keyof typeof d] as number) || 0), 0) / chartData.filter(d => d[nutrient.key as keyof typeof d] !== null).length)} {nutrient.unit}</>
                    ) : (
                      <span className="text-gray-400">No data</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Target</p>
                  <p className="text-lg font-semibold text-gray-700">
                    {targetValue} {nutrient.unit}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Adherence</p>
                  <p className="text-lg font-semibold" style={{ 
                    color: hasAnyData ? (Math.abs((chartData.reduce((sum, d) => sum + ((d[nutrient.key as keyof typeof d] as number) || 0), 0) / chartData.filter(d => d[nutrient.key as keyof typeof d] !== null).length) - targetValue) / targetValue < 0.1 ? '#10b981' : '#f59e0b') : '#9ca3af'
                  }}>
                    {hasAnyData ? (
                      <>{Math.round((chartData.reduce((sum, d) => sum + ((d[nutrient.key as keyof typeof d] as number) || 0), 0) / chartData.filter(d => d[nutrient.key as keyof typeof d] !== null).length) / targetValue * 100)}%</>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
