import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Table } from "lucide-react";

interface NutrientTrendGraphsProps {
  clientId: number;
  days?: number;
}

export function NutrientTrendGraphs({ clientId, days = 14 }: NutrientTrendGraphsProps) {
  const [viewMode, setViewMode] = useState<'graph' | 'table'>('graph');
  const [selectedDateRange, setSelectedDateRange] = useState<'today' | '7days' | '30days' | 'all'>('7days');
  
  // Calculate days based on selected range
  const calculatedDays = selectedDateRange === 'today' ? 1 : selectedDateRange === '7days' ? 7 : selectedDateRange === '30days' ? 30 : 365; // Use 365 for "all time"
  
  const timezoneOffset = new Date().getTimezoneOffset();
  const { data, isLoading, error } = trpc.meals.dailyTotals.useQuery({ 
    clientId, 
    days: calculatedDays,
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

  const dateRange = generateDateRange(calculatedDays);

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

  // Calculate average for a nutrient
  const calculateAverage = (key: string) => {
    const values = chartData.filter(d => d[key as keyof typeof d] !== null);
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, d) => sum + ((d[key as keyof typeof d] as number) || 0), 0) / values.length);
  };

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Nutrition Trends</h3>
        <Select value={selectedDateRange} onValueChange={(value) => setSelectedDateRange(value as 'today' | '7days' | '30days' | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Calories Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                Calories Trend
              </CardTitle>
              <CardDescription>
                {selectedDateRange === 'today' ? 'Today' : selectedDateRange === '7days' ? 'Last 7 days' : selectedDateRange === '30days' ? 'Last 30 days' : 'All time'} | Target: {goals.calories} kcal/day
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'graph' ? 'table' : 'graph')}
              className="flex items-center gap-2"
            >
              {viewMode === 'graph' ? (
                <><Table className="h-4 w-4" /> Table</>
              ) : (
                <><BarChart3 className="h-4 w-4" /> Graph</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'graph' ? (
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-semibold">Date</th>
                    <th className="text-right py-2 px-3 font-semibold">Actual (kcal)</th>
                    <th className="text-right py-2 px-3 font-semibold">Target (kcal)</th>
                    <th className="text-right py-2 px-3 font-semibold">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((day, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">{day.date}</td>
                      <td className="text-right py-2 px-3 font-medium" style={{ color: '#CE4C27' }}>
                        {day.calories !== null ? day.calories.toFixed(0) : '-'}
                      </td>
                      <td className="text-right py-2 px-3 text-gray-600">
                        {day.caloriesTarget.toFixed(0)}
                      </td>
                      <td className={`text-right py-2 px-3 font-medium ${
                        day.calories === null ? 'text-gray-400' :
                        day.calories >= day.caloriesTarget ? 'text-green-600' : 'text-amber-600'
                      }`}>
                        {day.calories !== null 
                          ? `${day.calories >= day.caloriesTarget ? '+' : ''}${(day.calories - day.caloriesTarget).toFixed(0)}`
                          : '-'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="text-xl">🍽️</span>
                Macronutrients Trend
              </CardTitle>
              <CardDescription>
                {selectedDateRange === 'today' ? 'Today' : selectedDateRange === '7days' ? 'Last 7 days' : selectedDateRange === '30days' ? 'Last 30 days' : 'All time'} | Protein: {goals.protein}g, Fat: {goals.fat}g, Carbs: {goals.carbs}g, Fiber: {goals.fibre}g
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'graph' ? 'table' : 'graph')}
              className="flex items-center gap-2"
            >
              {viewMode === 'graph' ? (
                <><Table className="h-4 w-4" /> Table</>
              ) : (
                <><BarChart3 className="h-4 w-4" /> Graph</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'graph' ? (
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-semibold">Date</th>
                    <th className="text-right py-2 px-3 font-semibold">Protein (g)</th>
                    <th className="text-right py-2 px-3 font-semibold">Fat (g)</th>
                    <th className="text-right py-2 px-3 font-semibold">Carbs (g)</th>
                    <th className="text-right py-2 px-3 font-semibold">Fiber (g)</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((day, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">{day.date}</td>
                      <td className="text-right py-2 px-3">
                        <div className="font-medium" style={{ color: '#578DB3' }}>
                          {day.protein !== null ? day.protein.toFixed(1) : '-'}
                        </div>
                        <div className="text-xs text-gray-500">Target: {day.proteinTarget}g</div>
                      </td>
                      <td className="text-right py-2 px-3">
                        <div className="font-medium" style={{ color: '#86BBD8' }}>
                          {day.fat !== null ? day.fat.toFixed(1) : '-'}
                        </div>
                        <div className="text-xs text-gray-500">Target: {day.fatTarget}g</div>
                      </td>
                      <td className="text-right py-2 px-3">
                        <div className="font-medium" style={{ color: '#F2CC8F' }}>
                          {day.carbs !== null ? day.carbs.toFixed(1) : '-'}
                        </div>
                        <div className="text-xs text-gray-500">Target: {day.carbsTarget}g</div>
                      </td>
                      <td className="text-right py-2 px-3">
                        <div className="font-medium" style={{ color: '#81B29A' }}>
                          {day.fibre !== null ? day.fibre.toFixed(1) : '-'}
                        </div>
                        <div className="text-xs text-gray-500">Target: {day.fibreTarget}g</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
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

      {/* Hydration Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="text-xl">💧</span>
                Hydration Trend
              </CardTitle>
              <CardDescription>
                {selectedDateRange === 'today' ? 'Today' : selectedDateRange === '7days' ? 'Last 7 days' : selectedDateRange === '30days' ? 'Last 30 days' : 'All time'} | Daily water intake vs target
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'graph' ? 'table' : 'graph')}
              className="flex items-center gap-2"
            >
              {viewMode === 'graph' ? (
                <><Table className="h-4 w-4" /> Table</>
              ) : (
                <><BarChart3 className="h-4 w-4" /> Graph</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'graph' ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyTotals}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ value: 'ml', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                formatter={(value: any) => [`${value} ml`, 'Hydration']}
              />
              <Legend />
              
              {/* Target line (dashed) */}
              <Line 
                type="monotone" 
                dataKey={() => goals.hydration}
                stroke="#06B6D4"
                strokeWidth={2}
                strokeDasharray="5 5"
                name={`Target (${goals.hydration} ml)`}
                dot={false}
              />
              
              {/* Actual hydration line */}
              <Line 
                type="monotone" 
                dataKey="hydration"
                stroke="#06B6D4"
                strokeWidth={3}
                name="Actual Hydration"
                dot={{ fill: '#06B6D4', r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-semibold">Date</th>
                    <th className="text-right py-2 px-3 font-semibold">Actual (ml)</th>
                    <th className="text-right py-2 px-3 font-semibold">Target (ml)</th>
                    <th className="text-right py-2 px-3 font-semibold">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyTotals.map((day, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">{day.date}</td>
                      <td className="text-right py-2 px-3 font-medium" style={{ color: '#06B6D4' }}>
                        {day.hydration !== null && day.hydration !== undefined ? day.hydration.toFixed(0) : '-'}
                      </td>
                      <td className="text-right py-2 px-3 text-gray-600">
                        {goals.hydration}
                      </td>
                      <td className={`text-right py-2 px-3 font-medium ${
                        day.hydration === null || day.hydration === undefined ? 'text-gray-400' :
                        day.hydration >= goals.hydration ? 'text-green-600' : 'text-amber-600'
                      }`}>
                        {day.hydration !== null && day.hydration !== undefined
                          ? `${day.hydration >= goals.hydration ? '+' : ''}${(day.hydration - goals.hydration).toFixed(0)}`
                          : '-'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Summary stats */}
          <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-gray-600">Average</p>
              <p className="text-lg font-semibold" style={{ color: '#06B6D4' }}>
                {hasAnyData ? <>{calculateAverage('hydration')} ml</> : <span className="text-gray-400">-</span>}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Target</p>
              <p className="text-lg font-semibold text-gray-700">
                {goals.hydration} ml
              </p>
            </div>
            <div>
              <p className="text-gray-600">Achievement</p>
              <p className="text-lg font-semibold" style={{ 
                color: hasAnyData && calculateAverage('hydration') >= goals.hydration ? '#10b981' : '#f59e0b'
              }}>
                {hasAnyData ? <>{Math.round((calculateAverage('hydration') / goals.hydration) * 100)}%</> : <span className="text-gray-400">-</span>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>


    </div>
  );
}
