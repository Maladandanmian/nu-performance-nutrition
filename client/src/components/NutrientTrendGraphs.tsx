import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

  const { data: bodyMetricsData } = trpc.bodyMetrics.list.useQuery({ clientId });

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

  // Prepare bodyweight data with persistence (carry forward last known weight)
  const bodyweightData = (() => {
    if (!bodyMetricsData || bodyMetricsData.length === 0) return [];
    
    // Create a map of weight entries by date
    const weightMap = new Map<string, number>();
    bodyMetricsData.forEach(metric => {
      if (metric.weight) {
        const date = new Date(metric.recordedAt).toISOString().split('T')[0];
        // Keep the latest weight for each day
        if (!weightMap.has(date) || metric.weight) {
          weightMap.set(date, metric.weight);
        }
      }
    });

    // Fill in the date range with carried-forward weights
    let lastKnownWeight: number | null = null;
    return dateRange.map(date => {
      const recordedWeight = weightMap.get(date);
      if (recordedWeight !== undefined) {
        lastKnownWeight = recordedWeight;
      }
      return {
        date: format(new Date(date), 'MMM d'),
        fullDate: date,
        weight: lastKnownWeight,
        weightTarget: goals.weightTarget ? parseFloat(goals.weightTarget) : null,
      };
    });
  })();

  const hasAnyData = dailyTotals.length > 0;
  const hasWeightData = bodyweightData.some(d => d.weight !== null);

  // Calculate average for a nutrient
  const calculateAverage = (key: string) => {
    const values = chartData.filter(d => d[key as keyof typeof d] !== null);
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, d) => sum + ((d[key as keyof typeof d] as number) || 0), 0) / values.length);
  };

  return (
    <div className="space-y-6">
      {/* Calories Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            Calories Trend
          </CardTitle>
          <CardDescription>
            Last {days} days | Target: {goals.calories} kcal/day
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
                label={{ value: 'kcal', angle: -90, position: 'insideLeft' }}
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
                dataKey="caloriesTarget"
                stroke="#CE4C27"
                strokeWidth={2}
                strokeDasharray="5 5"
                name={`Target (${goals.calories} kcal)`}
                dot={false}
              />
              
              {/* Actual consumption line (solid) */}
              <Line 
                type="monotone" 
                dataKey="calories"
                stroke="#CE4C27"
                strokeWidth={3}
                name="Actual Calories"
                dot={{ fill: '#CE4C27', r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
          
          {/* Summary stats */}
          <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-gray-600">Average</p>
              <p className="text-lg font-semibold" style={{ color: '#CE4C27' }}>
                {hasAnyData ? (
                  <>{calculateAverage('calories')} kcal</>
                ) : (
                  <span className="text-gray-400">No data</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Target</p>
              <p className="text-lg font-semibold text-gray-700">
                {goals.calories} kcal
              </p>
            </div>
            <div>
              <p className="text-gray-600">Adherence</p>
              <p className="text-lg font-semibold" style={{ 
                color: hasAnyData ? (Math.abs(calculateAverage('calories') - goals.calories) / goals.calories < 0.1 ? '#10b981' : '#f59e0b') : '#9ca3af'
              }}>
                {hasAnyData ? (
                  <>{Math.round(calculateAverage('calories') / goals.calories * 100)}%</>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Combined Macronutrients Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xl">🍽️</span>
            Macronutrients Trend
          </CardTitle>
          <CardDescription>
            Last {days} days | Protein: {goals.protein}g, Fat: {goals.fat}g, Carbs: {goals.carbs}g, Fiber: {goals.fibre}g
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ value: 'grams', angle: -90, position: 'insideLeft' }}
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
              
              {/* Target lines (dashed) */}
              <Line 
                type="monotone" 
                dataKey="proteinTarget"
                stroke="#578DB3"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                name={`Protein Target (${goals.protein}g)`}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="fatTarget"
                stroke="#86BBD8"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                name={`Fat Target (${goals.fat}g)`}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="carbsTarget"
                stroke="#F2CC8F"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                name={`Carbs Target (${goals.carbs}g)`}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="fibreTarget"
                stroke="#81B29A"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                name={`Fiber Target (${goals.fibre}g)`}
                dot={false}
              />
              
              {/* Actual consumption lines (solid) */}
              <Line 
                type="monotone" 
                dataKey="protein"
                stroke="#578DB3"
                strokeWidth={3}
                name="Protein"
                dot={{ fill: '#578DB3', r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="fat"
                stroke="#86BBD8"
                strokeWidth={3}
                name="Fat"
                dot={{ fill: '#86BBD8', r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="carbs"
                stroke="#F2CC8F"
                strokeWidth={3}
                name="Carbohydrates"
                dot={{ fill: '#F2CC8F', r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="fibre"
                stroke="#81B29A"
                strokeWidth={3}
                name="Fiber"
                dot={{ fill: '#81B29A', r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
          
          {/* Summary stats */}
          <div className="mt-4 grid grid-cols-4 gap-3 text-center text-sm">
            <div>
              <p className="text-gray-600 text-xs">💪 Protein</p>
              <p className="text-base font-semibold" style={{ color: '#578DB3' }}>
                {hasAnyData ? <>{calculateAverage('protein')}g</> : <span className="text-gray-400">-</span>}
              </p>
              <p className="text-xs text-gray-500">Target: {goals.protein}g</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs">🥑 Fat</p>
              <p className="text-base font-semibold" style={{ color: '#86BBD8' }}>
                {hasAnyData ? <>{calculateAverage('fat')}g</> : <span className="text-gray-400">-</span>}
              </p>
              <p className="text-xs text-gray-500">Target: {goals.fat}g</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs">🍞 Carbs</p>
              <p className="text-base font-semibold" style={{ color: '#F2CC8F' }}>
                {hasAnyData ? <>{calculateAverage('carbs')}g</> : <span className="text-gray-400">-</span>}
              </p>
              <p className="text-xs text-gray-500">Target: {goals.carbs}g</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs">🌾 Fiber</p>
              <p className="text-base font-semibold" style={{ color: '#81B29A' }}>
                {hasAnyData ? <>{calculateAverage('fibre')}g</> : <span className="text-gray-400">-</span>}
              </p>
              <p className="text-xs text-gray-500">Target: {goals.fibre}g</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bodyweight Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xl">⚖️</span>
            Bodyweight Trend
          </CardTitle>
          <CardDescription>
            Last {days} days | Weight is carried forward when not recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasWeightData ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={bodyweightData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    label={{ value: 'kg', angle: -90, position: 'insideLeft' }}
                    domain={['dataMin - 2', 'dataMax + 2']}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return format(new Date(payload[0].payload.fullDate), 'MMM d, yyyy');
                      }
                      return label;
                    }}
                    formatter={(value: any) => [`${value} kg`, 'Weight']}
                  />
                  <Legend />
                  
                  {/* Target line (dashed) - only show if weightTarget is set */}
                  {goals.weightTarget && (
                    <Line 
                      type="monotone" 
                      dataKey="weightTarget"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name={`Target (${parseFloat(goals.weightTarget).toFixed(1)} kg)`}
                      dot={false}
                    />
                  )}
                  
                  {/* Bodyweight line */}
                  <Line 
                    type="monotone" 
                    dataKey="weight"
                    stroke="#8B5CF6"
                    strokeWidth={3}
                    name="Bodyweight"
                    dot={{ fill: '#8B5CF6', r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                  />
                </LineChart>
              </ResponsiveContainer>
              
              {/* Summary stats */}
              <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <p className="text-gray-600">Current</p>
                  <p className="text-lg font-semibold" style={{ color: '#8B5CF6' }}>
                    {bodyweightData[bodyweightData.length - 1]?.weight?.toFixed(1)} kg
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Starting</p>
                  <p className="text-lg font-semibold text-gray-700">
                    {bodyweightData.find(d => d.weight !== null)?.weight?.toFixed(1)} kg
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Change</p>
                  <p className="text-lg font-semibold" style={{ 
                    color: (() => {
                      const start = bodyweightData.find(d => d.weight !== null)?.weight || 0;
                      const current = bodyweightData[bodyweightData.length - 1]?.weight || 0;
                      const change = current - start;
                      return change < 0 ? '#10b981' : change > 0 ? '#f59e0b' : '#9ca3af';
                    })()
                  }}>
                    {(() => {
                      const start = bodyweightData.find(d => d.weight !== null)?.weight || 0;
                      const current = bodyweightData[bodyweightData.length - 1]?.weight || 0;
                      const change = current - start;
                      return `${change > 0 ? '+' : ''}${change.toFixed(1)} kg`;
                    })()}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <span className="text-4xl mb-4 block">⚖️</span>
              <p className="text-lg font-medium">No weight data recorded yet</p>
              <p className="text-sm mt-2">Log your weight in the Metrics tab to see trends</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
