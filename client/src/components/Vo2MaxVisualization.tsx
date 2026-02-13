import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { trpc } from '@/lib/trpc';

interface Vo2MaxVisualizationProps {
  clientId: number;
}

export function Vo2MaxVisualization({ clientId }: Vo2MaxVisualizationProps) {
  const [anthropometricMetric, setAnthropometricMetric] = useState<string>('weight');
  const [fitnessMetric, setFitnessMetric] = useState<string>('vo2Max');

  const { data: tests, isLoading } = trpc.vo2MaxTests.getAll.useQuery({ clientId });

  if (isLoading) {
    return <div className="text-center py-8">Loading VO2 Max data...</div>;
  }

  if (!tests || tests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>VO2 Max Trends</CardTitle>
          <CardDescription>No VO2 Max tests available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">
            Upload a VO2 Max test to start tracking progress over time
          </p>
        </CardContent>
      </Card>
    );
  }

  // Prepare anthropometric data
  const anthropometricData = tests
    .filter((test: any) => test.anthropometric)
    .map((test: any) => ({
      date: new Date(test.testDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      weight: test.anthropometric.weight ? parseFloat(test.anthropometric.weight) : null,
      height: test.anthropometric.height ? parseFloat(test.anthropometric.height) : null,
      restingHR: test.anthropometric.restingHR ? parseInt(test.anthropometric.restingHR) : null,
      maxHR: test.anthropometric.maxHR ? parseInt(test.anthropometric.maxHR) : null,
      bmi: test.anthropometric.bmi ? parseFloat(test.anthropometric.bmi) : null,
    }))
    .reverse(); // Oldest first for chronological display

  // Prepare fitness assessment data
  const fitnessData = tests
    .filter((test: any) => test.fitnessAssessment)
    .map((test: any) => ({
      date: new Date(test.testDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      vo2Max: test.fitnessAssessment.vo2Max ? parseFloat(test.fitnessAssessment.vo2Max) : null,
      vo2MaxPerKg: test.fitnessAssessment.vo2MaxPerKg ? parseFloat(test.fitnessAssessment.vo2MaxPerKg) : null,
      maxSpeed: test.fitnessAssessment.maxSpeed ? parseFloat(test.fitnessAssessment.maxSpeed) : null,
      maxGrade: test.fitnessAssessment.maxGrade ? parseFloat(test.fitnessAssessment.maxGrade) : null,
      testDuration: test.fitnessAssessment.testDuration ? parseFloat(test.fitnessAssessment.testDuration) : null,
      vt1Speed: test.fitnessAssessment.vt1Speed ? parseFloat(test.fitnessAssessment.vt1Speed) : null,
      vt2Speed: test.fitnessAssessment.vt2Speed ? parseFloat(test.fitnessAssessment.vt2Speed) : null,
    }))
    .reverse();

  // Metric configurations
  const anthropometricMetrics = [
    { value: 'weight', label: 'Weight (kg)', color: '#578DB3' },
    { value: 'height', label: 'Height (cm)', color: '#82ca9d' },
    { value: 'restingHR', label: 'Resting HR (bpm)', color: '#ffc658' },
    { value: 'maxHR', label: 'Max HR (bpm)', color: '#ff7c7c' },
    { value: 'bmi', label: 'BMI', color: '#8884d8' },
  ];

  const fitnessMetrics = [
    { value: 'vo2Max', label: 'VO2 Max (L/min)', color: '#578DB3' },
    { value: 'vo2MaxPerKg', label: 'VO2 Max (ml/kg/min)', color: '#82ca9d' },
    { value: 'maxSpeed', label: 'Max Speed (km/h)', color: '#ffc658' },
    { value: 'maxGrade', label: 'Max Grade (%)', color: '#ff7c7c' },
    { value: 'testDuration', label: 'Test Duration (min)', color: '#8884d8' },
    { value: 'vt1Speed', label: 'VT1 Speed (km/h)', color: '#a4de6c' },
    { value: 'vt2Speed', label: 'VT2 Speed (km/h)', color: '#d0ed57' },
  ];

  const selectedAnthropometric = anthropometricMetrics.find(m => m.value === anthropometricMetric);
  const selectedFitness = fitnessMetrics.find(m => m.value === fitnessMetric);

  return (
    <div className="space-y-6">
      {/* Anthropometric & Baseline Trends */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Anthropometric & Baseline Trends</CardTitle>
              <CardDescription>Track changes in body measurements and baseline metrics over time</CardDescription>
            </div>
            <Select value={anthropometricMetric} onValueChange={setAnthropometricMetric}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anthropometricMetrics.map(metric => (
                  <SelectItem key={metric.value} value={metric.value}>
                    {metric.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {anthropometricData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={anthropometricData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={anthropometricMetric}
                  stroke={selectedAnthropometric?.color}
                  strokeWidth={2}
                  name={selectedAnthropometric?.label}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">No anthropometric data available</p>
          )}
        </CardContent>
      </Card>

      {/* Fitness Assessment Trends */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Fitness Assessment Trends</CardTitle>
              <CardDescription>Track changes in aerobic capacity and performance metrics over time</CardDescription>
            </div>
            <Select value={fitnessMetric} onValueChange={setFitnessMetric}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fitnessMetrics.map(metric => (
                  <SelectItem key={metric.value} value={metric.value}>
                    {metric.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {fitnessData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={fitnessData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={fitnessMetric}
                  stroke={selectedFitness?.color}
                  strokeWidth={2}
                  name={selectedFitness?.label}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">No fitness assessment data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
