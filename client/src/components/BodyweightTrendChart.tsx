import { trpc } from "@/lib/trpc";
import { format, subDays } from "date-fns";
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, Table as TableIcon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface BodyweightTrendChartProps {
  clientId: number;
  goals: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fibre: number;
    hydration: number;
    weightTarget: string | null;
  };
}

type DateRange = 'today' | '7days' | '30days' | 'all';

export function BodyweightTrendChart({ clientId, goals }: BodyweightTrendChartProps) {
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>('7days');
  const [viewMode, setViewMode] = useState<'graph' | 'table'>('graph');
  const [smoothing, setSmoothing] = useState(false);

  // Calculate days based on selected range
  const calculatedDays = useMemo(() => {
    switch (selectedDateRange) {
      case 'today': return 1;
      case '7days': return 7;
      case '30days': return 30;
      case 'all': return 365; // Max 1 year
      default: return 7;
    }
  }, [selectedDateRange]);

  const { data: bodyMetricsData } = trpc.bodyMetrics.list.useQuery({ clientId });

  // Prepare date range
  const dateRange = useMemo(() => {
    const now = new Date();
    const dates: string[] = [];
    for (let i = calculatedDays - 1; i >= 0; i--) {
      const date = subDays(now, i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }, [calculatedDays]);

  // Prepare bodyweight data with persistence (carry forward last known weight)
  const bodyweightData = useMemo(() => {
    if (!bodyMetricsData || bodyMetricsData.length === 0) return [];
    
    // Create a map of weight entries by date
    const weightMap = new Map<string, number>();
    bodyMetricsData.forEach(metric => {
      if (metric.weight) {
        // Use local date to match the dateRange format
        const recordedDate = new Date(metric.recordedAt);
        const date = `${recordedDate.getFullYear()}-${String(recordedDate.getMonth() + 1).padStart(2, '0')}-${String(recordedDate.getDate()).padStart(2, '0')}`;
        // Convert from stored integer (e.g., 684) to decimal (e.g., 68.4)
        const weightInKg = metric.weight / 10;
        // Keep the latest weight for each day
        if (!weightMap.has(date) || metric.weight) {
          weightMap.set(date, weightInKg);
        }
      }
    });

    // Find the most recent weight BEFORE the date range starts (to carry forward)
    const firstDateInRange = new Date(dateRange[0]);
    let lastKnownWeight: number | null = null;
    
    // Look through all body metrics to find the most recent weight before the range
    bodyMetricsData
      .filter(metric => metric.weight && new Date(metric.recordedAt) < firstDateInRange)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
      .forEach((metric, index) => {
        if (index === 0 && metric.weight) {
          lastKnownWeight = metric.weight / 10; // Convert from stored integer to decimal
        }
      });
    
    // Fill in the date range with carried-forward weights
    return dateRange.map(date => {
      const recordedWeight = weightMap.get(date);
      const isActualInput = recordedWeight !== undefined;
      if (isActualInput) {
        lastKnownWeight = recordedWeight;
      }
      return {
        date: format(new Date(date), 'MMM d'),
        fullDate: date,
        weight: lastKnownWeight,
        weightTarget: goals.weightTarget ? parseFloat(goals.weightTarget) : null,
        isActualInput, // Track whether this is a real user input or forward-filled
      };
    });
  }, [bodyMetricsData, dateRange, goals.weightTarget]);

  // Apply smoothing if enabled
  // When smoothing is ON: show only actual user-input weights (no forward-filled points)
  // But preserve full date range with null values for proper X-axis spacing
  // Also include the most recent weight entry BEFORE the date range for curve continuity
  const smoothedBodyweightData = useMemo(() => {
    if (!smoothing || bodyweightData.length === 0) return bodyweightData;
    
    // Find the most recent weight entry BEFORE the date range starts
    const firstDateInRange = new Date(dateRange[0]);
    const previousEntry = bodyMetricsData && bodyMetricsData.length > 0
      ? bodyMetricsData
          .filter(metric => metric.weight && new Date(metric.recordedAt) < firstDateInRange)
          .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())[0]
      : undefined;
    
    // Map over all dates, but set weight to null for forward-filled points
    const result = bodyweightData.map(point => {
      if (point.isActualInput && point.weight !== null) {
        // Keep actual user-input weights
        return point;
      } else {
        // Set weight to null for forward-filled dates (preserves X-axis spacing)
        return { ...point, weight: null };
      }
    });
    
    // If there's a previous entry, prepend it to show curve extending from before the window
    if (previousEntry && previousEntry.weight) {
      const recordedDate = new Date(previousEntry.recordedAt);
      const previousPoint = {
        date: format(recordedDate, 'MMM d'),
        fullDate: `${recordedDate.getFullYear()}-${String(recordedDate.getMonth() + 1).padStart(2, '0')}-${String(recordedDate.getDate()).padStart(2, '0')}`,
        weight: previousEntry.weight / 10, // Convert from stored integer to decimal
        weightTarget: goals.weightTarget ? parseFloat(goals.weightTarget) : null,
        isActualInput: true,
      };
      return [previousPoint, ...result];
    }
    
    return result;
  }, [bodyweightData, smoothing, bodyMetricsData, dateRange, goals.weightTarget]);
  
  const displayData = smoothing ? smoothedBodyweightData : bodyweightData;
  const hasWeightData = bodyweightData.some(d => d.weight !== null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">⚖️</span>
              Bodyweight Trend
            </CardTitle>
            <CardDescription>
              {selectedDateRange === 'today' && 'Today'}
              {selectedDateRange === '7days' && 'Last 7 days'}
              {selectedDateRange === '30days' && 'Last 30 days'}
              {selectedDateRange === 'all' && 'All time'}
              {' | Weight is carried forward when not recorded'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={smoothing ? "default" : "outline"}
              size="sm"
              onClick={() => setSmoothing(!smoothing)}
              className="text-xs md:text-sm whitespace-nowrap"
            >
              Smoothing {smoothing ? 'On' : 'Off'}
            </Button>
            <Select value={selectedDateRange} onValueChange={(value) => setSelectedDateRange(value as DateRange)}>
              <SelectTrigger className="w-[120px] md:w-[140px] text-xs md:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMode(viewMode === 'graph' ? 'table' : 'graph')}
            >
              {viewMode === 'graph' ? <TableIcon className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasWeightData ? (
          <>
            {viewMode === 'graph' ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={displayData}>
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
                      formatter={(value: any) => [`${value?.toFixed(1) || 'N/A'} kg`, 'Weight']}
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Date</th>
                      <th className="text-right py-2 px-4">Weight (kg)</th>
                      {goals.weightTarget && <th className="text-right py-2 px-4">Target (kg)</th>}
                      {goals.weightTarget && <th className="text-right py-2 px-4">Difference</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {bodyweightData.filter(d => d.weight !== null && d.isActualInput).map((day, idx) => {
                      const diff = goals.weightTarget && day.weight 
                        ? day.weight - parseFloat(goals.weightTarget)
                        : null;
                      return (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-4">{format(new Date(day.fullDate), 'MMM d, yyyy')}</td>
                          <td className="text-right py-2 px-4 font-medium">{day.weight?.toFixed(1)}</td>
                          {goals.weightTarget && (
                            <td className="text-right py-2 px-4">{parseFloat(goals.weightTarget).toFixed(1)}</td>
                          )}
                          {goals.weightTarget && diff !== null && (
                            <td className="text-right py-2 px-4" style={{
                              color: diff > 0 ? '#f59e0b' : diff < 0 ? '#10b981' : '#9ca3af'
                            }}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <span className="text-4xl mb-4 block">⚖️</span>
            <p className="text-lg font-medium">No weight data recorded yet</p>
            <p className="text-sm mt-2">Log your weight above to see trends</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
