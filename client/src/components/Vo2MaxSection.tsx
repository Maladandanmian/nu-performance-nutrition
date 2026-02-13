import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { trpc } from "@/lib/trpc";
import { FileText, Upload, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Vo2MaxVisualization } from './Vo2MaxVisualization';

interface Vo2MaxSectionProps {
  clientId: number;
  isTrainer?: boolean;
}

export function Vo2MaxSection({ clientId, isTrainer = true }: Vo2MaxSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [testDate, setTestDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const utils = trpc.useUtils();
  
  // Fetch all VO2 Max tests for this client
  const { data: tests = [], isLoading, refetch } = trpc.vo2MaxTests.getAll.useQuery(
    { clientId },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  // Fetch detailed data for the current test
  const currentTest = tests[currentIndex];
  const { data: testDetails, isLoading: isLoadingDetails, error: detailsError } = trpc.vo2MaxTests.getTestDetails.useQuery(
    { testId: currentTest?.id || 0 },
    { enabled: !!currentTest }
  );

  // Debug logging
  useEffect(() => {
    console.log('[Vo2MaxSection] Current test:', currentTest);
    console.log('[Vo2MaxSection] Test details:', testDetails);
    console.log('[Vo2MaxSection] Loading details:', isLoadingDetails);
    console.log('[Vo2MaxSection] Details error:', detailsError);
  }, [currentTest, testDetails, isLoadingDetails, detailsError]);

  // Upload mutation
  const uploadMutation = trpc.vo2MaxTests.upload.useMutation({
    onSuccess: () => {
      toast.success("VO2 Max test uploaded successfully. AI analysis in progress...");
      setSelectedFile(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = trpc.vo2MaxTests.delete.useMutation({
    onSuccess: () => {
      toast.success("VO2 Max test deleted successfully");
      if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        toast.error("Please select a PDF file");
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const base64Data = base64.split(',')[1];

      await uploadMutation.mutateAsync({
        clientId,
        filename: selectedFile.name,
        fileData: base64Data,
        testDate: new Date(testDate),
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDelete = () => {
    if (!currentTest) return;
    if (confirm('Are you sure you want to delete this VO2 Max test?')) {
      deleteMutation.mutate({ testId: currentTest.id });
    }
  };

  const handlePrevious = () => {
    if (currentIndex < tests.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading VO2 Max tests...</div>;
  }

  // Empty state
  if (tests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>VO2 Max Tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            No VO2 Max tests uploaded yet. Upload a test report to track aerobic capacity and lactate threshold data.
          </p>
          
          {isTrainer && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="test-date">Test Date</Label>
                <Input
                  id="test-date"
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pdf-upload">Upload PDF Report</Label>
                <Input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                />
              </div>
              
              {selectedFile && (
                <Button
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload Test Report'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Display current test
  return (
    <div className="space-y-6">
      {/* Visualizations */}
      <Vo2MaxVisualization clientId={clientId} />

      {/* Header with navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Title and action buttons row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-semibold">VO2 Max Test</h3>
                <p className="text-sm text-muted-foreground">
                  Test date: {currentTest?.testDate ? new Date(currentTest.testDate).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(currentTest?.pdfUrl, '_blank')}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View PDF
                </Button>
                
                {isTrainer && (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                    
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        const input = document.getElementById('pdf-upload-new') as HTMLInputElement;
                        input?.click();
                      }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload New
                    </Button>
                    <input
                      id="pdf-upload-new"
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setSelectedFile(e.target.files[0]);
                          handleUpload();
                        }
                      }}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Navigation controls row */}
            {tests.length > 1 && (
              <div className="flex justify-center items-center gap-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevious}
                  disabled={currentIndex >= tests.length - 1}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <span className="text-sm font-medium min-w-[90px] text-center">
                  Test {currentIndex + 1} of {tests.length}
                </span>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNext}
                  disabled={currentIndex <= 0}
                  className="h-8 w-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ambient Data */}
      {testDetails?.ambientData && (
        <Card>
          <CardHeader>
            <CardTitle>Ambient Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {testDetails.ambientData.temperature && (
                <div>
                  <p className="text-sm text-muted-foreground">Temperature</p>
                  <p className="text-lg font-semibold">{testDetails.ambientData.temperature}°C</p>
                </div>
              )}
              {testDetails.ambientData.pressure && (
                <div>
                  <p className="text-sm text-muted-foreground">Pressure</p>
                  <p className="text-lg font-semibold">{testDetails.ambientData.pressure} mmHg</p>
                </div>
              )}
              {testDetails.ambientData.humidity && (
                <div>
                  <p className="text-sm text-muted-foreground">Humidity</p>
                  <p className="text-lg font-semibold">{testDetails.ambientData.humidity}%</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Anthropometric & Baseline */}
      {testDetails?.anthropometric && (
        <Card>
          <CardHeader>
            <CardTitle>Anthropometric & Baseline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {testDetails.anthropometric.height && (
                <div>
                  <p className="text-sm text-muted-foreground">Height</p>
                  <p className="text-lg font-semibold">{testDetails.anthropometric.height} m</p>
                </div>
              )}
              {testDetails.anthropometric.weight && (
                <div>
                  <p className="text-sm text-muted-foreground">Weight</p>
                  <p className="text-lg font-semibold">{testDetails.anthropometric.weight} kg</p>
                </div>
              )}
              {testDetails.anthropometric.restingHeartRate && (
                <div>
                  <p className="text-sm text-muted-foreground">Resting HR</p>
                  <p className="text-lg font-semibold">{testDetails.anthropometric.restingHeartRate} bpm</p>
                </div>
              )}
              {testDetails.anthropometric.restingBpSystolic && testDetails.anthropometric.restingBpDiastolic && (
                <div>
                  <p className="text-sm text-muted-foreground">Resting BP</p>
                  <p className="text-lg font-semibold">
                    {testDetails.anthropometric.restingBpSystolic}/{testDetails.anthropometric.restingBpDiastolic} mmHg
                  </p>
                </div>
              )}
              {testDetails.anthropometric.restingLactate && (
                <div>
                  <p className="text-sm text-muted-foreground">Resting Lactate</p>
                  <p className="text-lg font-semibold">{testDetails.anthropometric.restingLactate} mmol/L</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fitness Assessment */}
      {testDetails?.fitnessAssessment && (
        <Card>
          <CardHeader>
            <CardTitle>Fitness Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Aerobic Threshold */}
            <div>
              <h4 className="font-semibold mb-3">Aerobic Threshold</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {testDetails.fitnessAssessment.aerobicThresholdLactate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Lactate</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.aerobicThresholdLactate} mmol/L</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.aerobicThresholdSpeed && (
                  <div>
                    <p className="text-sm text-muted-foreground">Speed</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.aerobicThresholdSpeed} km/h</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.aerobicThresholdHr && (
                  <div>
                    <p className="text-sm text-muted-foreground">Heart Rate</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.aerobicThresholdHr} bpm</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.aerobicThresholdHrPct && (
                  <div>
                    <p className="text-sm text-muted-foreground">HR %</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.aerobicThresholdHrPct}%</p>
                  </div>
                )}
              </div>
            </div>

            {/* Lactate Threshold */}
            <div>
              <h4 className="font-semibold mb-3">Lactate Threshold</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {testDetails.fitnessAssessment.lactateThresholdLactate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Lactate</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.lactateThresholdLactate} mmol/L</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.lactateThresholdSpeed && (
                  <div>
                    <p className="text-sm text-muted-foreground">Speed</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.lactateThresholdSpeed} km/h</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.lactateThresholdHr && (
                  <div>
                    <p className="text-sm text-muted-foreground">Heart Rate</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.lactateThresholdHr} bpm</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.lactateThresholdHrPct && (
                  <div>
                    <p className="text-sm text-muted-foreground">HR %</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.lactateThresholdHrPct}%</p>
                  </div>
                )}
              </div>
            </div>

            {/* Maximum */}
            <div>
              <h4 className="font-semibold mb-3">Maximum</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {testDetails.fitnessAssessment.maximumLactate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Lactate</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.maximumLactate} mmol/L</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.maximumSpeed && (
                  <div>
                    <p className="text-sm text-muted-foreground">Speed</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.maximumSpeed} km/h</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.maximumHr && (
                  <div>
                    <p className="text-sm text-muted-foreground">Heart Rate</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.maximumHr} bpm</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.maximumHrPct && (
                  <div>
                    <p className="text-sm text-muted-foreground">HR %</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.maximumHrPct}%</p>
                  </div>
                )}
              </div>
            </div>

            {/* VO2 Max Detailed Metrics */}
            <div>
              <h4 className="font-semibold mb-3">VO2 Max Detailed Metrics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {testDetails.fitnessAssessment.vo2MaxMlKgMin && (
                  <div>
                    <p className="text-sm text-muted-foreground">VO2 Max (relative)</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.vo2MaxMlKgMin} ml/kg/min</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.vo2MaxLMin && (
                  <div>
                    <p className="text-sm text-muted-foreground">VO2 Max (absolute)</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.vo2MaxLMin} L/min</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.vco2LMin && (
                  <div>
                    <p className="text-sm text-muted-foreground">VCO2</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.vco2LMin} L/min</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.rer && (
                  <div>
                    <p className="text-sm text-muted-foreground">RER</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.rer}</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.rrBrMin && (
                  <div>
                    <p className="text-sm text-muted-foreground">Respiratory Rate</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.rrBrMin} br/min</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.veBtpsLMin && (
                  <div>
                    <p className="text-sm text-muted-foreground">Ventilation</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.veBtpsLMin} L/min</p>
                  </div>
                )}
                {testDetails.fitnessAssessment.rpe && (
                  <div>
                    <p className="text-sm text-muted-foreground">RPE</p>
                    <p className="text-lg font-semibold">{testDetails.fitnessAssessment.rpe}/20</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Blood Lactate Profile */}
      {testDetails?.lactateProfile && testDetails.lactateProfile.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Blood Lactate Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Stage</th>
                    <th className="text-left p-2">Speed (km/h)</th>
                    <th className="text-left p-2">Lactate (mmol/L)</th>
                    <th className="text-left p-2">Heart Rate (bpm)</th>
                  </tr>
                </thead>
                <tbody>
                  {testDetails.lactateProfile.map((point, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">{point.stageNumber}</td>
                      <td className="p-2">{point.workloadSpeed}</td>
                      <td className="p-2">{point.lactate}</td>
                      <td className="p-2">{point.heartRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
