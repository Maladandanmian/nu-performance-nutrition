import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { trpc } from "@/lib/trpc";
import { FileText, Upload, Trash2, ChevronLeft, ChevronRight, Pencil, X, Check } from "lucide-react";
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
  
  // Edit states for each section
  const [isEditingAmbient, setIsEditingAmbient] = useState(false);
  const [isEditingAnthropometric, setIsEditingAnthropometric] = useState(false);
  const [isEditingFitness, setIsEditingFitness] = useState(false);
  
  // Form states for ambient data
  const [ambientForm, setAmbientForm] = useState({
    temperature: '',
    pressure: '',
    humidity: '',
  });
  
  // Form states for anthropometric data
  const [anthropometricForm, setAnthropometricForm] = useState({
    height: '',
    weight: '',
    restingHr: '',
  });
  
  // Form states for fitness assessment
  const [fitnessForm, setFitnessForm] = useState({
    aerobicThresholdLactate: '',
    aerobicThresholdSpeed: '',
    aerobicThresholdHr: '',
    lactateThresholdLactate: '',
    lactateThresholdSpeed: '',
    lactateThresholdHr: '',
    maximumLactate: '',
    maximumSpeed: '',
    maximumHr: '',
    vo2MaxMlKgMin: '',
    vo2MaxLMin: '',
  });
  
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
  const { data: testDetails, isLoading: isLoadingDetails, error: detailsError, refetch: refetchDetails } = trpc.vo2MaxTests.getTestDetails.useQuery(
    { testId: currentTest?.id || 0 },
    { enabled: !!currentTest }
  );

  // Check if analysis is incomplete
  const hasIncompleteAnalysis = testDetails && (
    !testDetails.ambientData || 
    !testDetails.anthropometric || 
    !testDetails.fitnessAssessment || 
    testDetails.lactateProfile.length === 0
  );

  // Manual polling for AI analysis completion
  useEffect(() => {
    if (!hasIncompleteAnalysis) {
      console.log('[Vo2MaxSection] Analysis complete, stopping polling');
      return;
    }

    console.log('[Vo2MaxSection] Starting manual polling for incomplete analysis...');
    const interval = setInterval(() => {
      console.log('[Vo2MaxSection] Polling check - refetching...');
      refetchDetails();
    }, 5000); // Poll every 5 seconds

    return () => {
      console.log('[Vo2MaxSection] Cleaning up polling interval');
      clearInterval(interval);
    };
  }, [hasIncompleteAnalysis, refetchDetails]);

  // Debug logging
  useEffect(() => {
    console.log('[Vo2MaxSection] Test details updated:', {
      hasTest: !!testDetails,
      hasAmbient: !!testDetails?.ambientData,
      hasAnthropometric: !!testDetails?.anthropometric,
      hasFitness: !!testDetails?.fitnessAssessment,
      lactateCount: testDetails?.lactateProfile?.length || 0,
      hasIncomplete: hasIncompleteAnalysis
    });
  }, [testDetails, hasIncompleteAnalysis]);

  // Initialize form data when test details load
  useEffect(() => {
    if (testDetails?.ambientData) {
      setAmbientForm({
        temperature: testDetails.ambientData.temperature || '',
        pressure: testDetails.ambientData.pressure?.toString() || '',
        humidity: testDetails.ambientData.humidity?.toString() || '',
      });
    }
    if (testDetails?.anthropometric) {
      setAnthropometricForm({
        height: testDetails.anthropometric.height || '',
        weight: testDetails.anthropometric.weight || '',
        restingHr: testDetails.anthropometric.restingHeartRate?.toString() || '',
      });
    }
    if (testDetails?.fitnessAssessment) {
      setFitnessForm({
        aerobicThresholdLactate: testDetails.fitnessAssessment.aerobicThresholdLactate || '',
        aerobicThresholdSpeed: testDetails.fitnessAssessment.aerobicThresholdSpeed || '',
        aerobicThresholdHr: testDetails.fitnessAssessment.aerobicThresholdHr?.toString() || '',
        lactateThresholdLactate: testDetails.fitnessAssessment.lactateThresholdLactate || '',
        lactateThresholdSpeed: testDetails.fitnessAssessment.lactateThresholdSpeed || '',
        lactateThresholdHr: testDetails.fitnessAssessment.lactateThresholdHr?.toString() || '',
        maximumLactate: testDetails.fitnessAssessment.maximumLactate || '',
        maximumSpeed: testDetails.fitnessAssessment.maximumSpeed || '',
        maximumHr: testDetails.fitnessAssessment.maximumHr?.toString() || '',
        vo2MaxMlKgMin: testDetails.fitnessAssessment.vo2MaxMlKgMin || '',
        vo2MaxLMin: testDetails.fitnessAssessment.vo2MaxLMin || '',
      });
    }
  }, [testDetails]);

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

  // Update mutations
  const updateAmbientMutation = trpc.vo2MaxTests.updateAmbientData.useMutation({
    onSuccess: () => {
      toast.success("Ambient data updated successfully");
      setIsEditingAmbient(false);
      refetchDetails();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateAnthropometricMutation = trpc.vo2MaxTests.updateAnthropometric.useMutation({
    onSuccess: () => {
      toast.success("Anthropometric data updated successfully");
      setIsEditingAnthropometric(false);
      refetchDetails();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateFitnessMutation = trpc.vo2MaxTests.updateFitnessAssessment.useMutation({
    onSuccess: () => {
      toast.success("Fitness assessment updated successfully");
      setIsEditingFitness(false);
      refetchDetails();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a PDF file");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await uploadMutation.mutateAsync({
        clientId,
        testDate: new Date(testDate),
        filename: selectedFile.name,
        fileData: base64,
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDelete = async () => {
    if (!currentTest) return;
    if (!confirm("Are you sure you want to delete this VO2 Max test? This action cannot be undone.")) {
      return;
    }
    await deleteMutation.mutateAsync({ testId: currentTest.id });
  };

  const handleNext = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      // Cancel any active editing when switching tests
      setIsEditingAmbient(false);
      setIsEditingAnthropometric(false);
      setIsEditingFitness(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex < tests.length - 1) {
      setCurrentIndex(currentIndex + 1);
      // Cancel any active editing when switching tests
      setIsEditingAmbient(false);
      setIsEditingAnthropometric(false);
      setIsEditingFitness(false);
    }
  };

  // Save handlers
  const handleSaveAmbient = async () => {
    if (!currentTest) return;
    await updateAmbientMutation.mutateAsync({
      testId: currentTest.id,
      temperature: ambientForm.temperature || undefined,
      pressure: ambientForm.pressure || undefined,
      humidity: ambientForm.humidity || undefined,
    });
  };

  const handleSaveAnthropometric = async () => {
    if (!currentTest) return;
    await updateAnthropometricMutation.mutateAsync({
      testId: currentTest.id,
      height: anthropometricForm.height || undefined,
      weight: anthropometricForm.weight || undefined,
      restingHr: anthropometricForm.restingHr ? parseInt(anthropometricForm.restingHr, 10) : undefined,
    });
  };

  const handleSaveFitness = async () => {
    if (!currentTest) return;
    await updateFitnessMutation.mutateAsync({
      testId: currentTest.id,
      aerobicThresholdLactate: fitnessForm.aerobicThresholdLactate || undefined,
      aerobicThresholdSpeed: fitnessForm.aerobicThresholdSpeed || undefined,
      aerobicThresholdHr: fitnessForm.aerobicThresholdHr ? parseInt(fitnessForm.aerobicThresholdHr, 10) : undefined,
      lactateThresholdLactate: fitnessForm.lactateThresholdLactate || undefined,
      lactateThresholdSpeed: fitnessForm.lactateThresholdSpeed || undefined,
      lactateThresholdHr: fitnessForm.lactateThresholdHr ? parseInt(fitnessForm.lactateThresholdHr, 10) : undefined,
      maximumLactate: fitnessForm.maximumLactate || undefined,
      maximumSpeed: fitnessForm.maximumSpeed || undefined,
      maximumHr: fitnessForm.maximumHr ? parseInt(fitnessForm.maximumHr, 10) : undefined,
      vo2MaxMlKgMin: fitnessForm.vo2MaxMlKgMin || undefined,
      vo2MaxLMin: fitnessForm.vo2MaxLMin || undefined,
    });
  };

  // Cancel handlers
  const handleCancelAmbient = () => {
    if (testDetails?.ambientData) {
      setAmbientForm({
        temperature: testDetails.ambientData.temperature || '',
        pressure: testDetails.ambientData.pressure?.toString() || '',
        humidity: testDetails.ambientData.humidity?.toString() || '',
      });
    }
    setIsEditingAmbient(false);
  };

  const handleCancelAnthropometric = () => {
    if (testDetails?.anthropometric) {
      setAnthropometricForm({
        height: testDetails.anthropometric.height || '',
        weight: testDetails.anthropometric.weight || '',
        restingHr: testDetails.anthropometric.restingHeartRate?.toString() || '',
      });
    }
    setIsEditingAnthropometric(false);
  };

  const handleCancelFitness = () => {
    if (testDetails?.fitnessAssessment) {
      setFitnessForm({
        aerobicThresholdLactate: testDetails.fitnessAssessment.aerobicThresholdLactate || '',
        aerobicThresholdSpeed: testDetails.fitnessAssessment.aerobicThresholdSpeed || '',
        aerobicThresholdHr: testDetails.fitnessAssessment.aerobicThresholdHr?.toString() || '',
        lactateThresholdLactate: testDetails.fitnessAssessment.lactateThresholdLactate || '',
        lactateThresholdSpeed: testDetails.fitnessAssessment.lactateThresholdSpeed || '',
        lactateThresholdHr: testDetails.fitnessAssessment.lactateThresholdHr?.toString() || '',
        maximumLactate: testDetails.fitnessAssessment.maximumLactate || '',
        maximumSpeed: testDetails.fitnessAssessment.maximumSpeed || '',
        maximumHr: testDetails.fitnessAssessment.maximumHr?.toString() || '',
        vo2MaxMlKgMin: testDetails.fitnessAssessment.vo2MaxMlKgMin || '',
        vo2MaxLMin: testDetails.fitnessAssessment.vo2MaxLMin || '',
      });
    }
    setIsEditingFitness(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading VO2 Max tests...</p>
        </CardContent>
      </Card>
    );
  }

  if (tests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>VO2 Max Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          {isTrainer ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">No VO2 Max tests uploaded yet. Upload a PDF report to get started.</p>
              
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
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
              
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadMutation.isPending ? "Uploading..." : "Upload Test"}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">No VO2 Max tests available yet.</p>
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

      {/* AI Analysis Status */}
      {hasIncompleteAnalysis && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-800">
              AI is analysing this VO2 Max test. This page will update automatically when the analysis is complete.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Ambient Data */}
      {testDetails?.ambientData && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Ambient Data</CardTitle>
            {isTrainer && !isEditingAmbient && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditingAmbient(true)}
                className="h-8 w-8"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditingAmbient ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="temperature">Temperature (°C)</Label>
                    <Input
                      id="temperature"
                      value={ambientForm.temperature}
                      onChange={(e) => setAmbientForm({ ...ambientForm, temperature: e.target.value })}
                      placeholder="e.g., 24.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pressure">Pressure (mmHg)</Label>
                    <Input
                      id="pressure"
                      value={ambientForm.pressure}
                      onChange={(e) => setAmbientForm({ ...ambientForm, pressure: e.target.value })}
                      placeholder="e.g., 760"
                    />
                  </div>
                  <div>
                    <Label htmlFor="humidity">Humidity (%)</Label>
                    <Input
                      id="humidity"
                      value={ambientForm.humidity}
                      onChange={(e) => setAmbientForm({ ...ambientForm, humidity: e.target.value })}
                      placeholder="e.g., 65"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveAmbient}
                    disabled={updateAmbientMutation.isPending}
                    size="sm"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    onClick={handleCancelAmbient}
                    variant="outline"
                    size="sm"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>
      )}

      {/* Anthropometric & Baseline */}
      {testDetails?.anthropometric && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Anthropometric & Baseline</CardTitle>
            {isTrainer && !isEditingAnthropometric && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditingAnthropometric(true)}
                className="h-8 w-8"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isEditingAnthropometric ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="height">Height (m)</Label>
                    <Input
                      id="height"
                      value={anthropometricForm.height}
                      onChange={(e) => setAnthropometricForm({ ...anthropometricForm, height: e.target.value })}
                      placeholder="e.g., 1.75"
                    />
                  </div>
                  <div>
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input
                      id="weight"
                      value={anthropometricForm.weight}
                      onChange={(e) => setAnthropometricForm({ ...anthropometricForm, weight: e.target.value })}
                      placeholder="e.g., 70"
                    />
                  </div>
                  <div>
                    <Label htmlFor="restingHr">Resting HR (bpm)</Label>
                    <Input
                      id="restingHr"
                      value={anthropometricForm.restingHr}
                      onChange={(e) => setAnthropometricForm({ ...anthropometricForm, restingHr: e.target.value })}
                      placeholder="e.g., 60"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveAnthropometric}
                    disabled={updateAnthropometricMutation.isPending}
                    size="sm"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    onClick={handleCancelAnthropometric}
                    variant="outline"
                    size="sm"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>
      )}

      {/* Fitness Assessment */}
      {testDetails?.fitnessAssessment && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Fitness Assessment</CardTitle>
            {isTrainer && !isEditingFitness && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditingFitness(true)}
                className="h-8 w-8"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {isEditingFitness ? (
              <div className="space-y-6">
                {/* Aerobic Threshold */}
                <div>
                  <h4 className="font-semibold mb-3">Aerobic Threshold</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="aerobicLactate">Lactate (mmol/L)</Label>
                      <Input
                        id="aerobicLactate"
                        value={fitnessForm.aerobicThresholdLactate}
                        onChange={(e) => setFitnessForm({ ...fitnessForm, aerobicThresholdLactate: e.target.value })}
                        placeholder="e.g., 2.0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="aerobicSpeed">Speed (km/h)</Label>
                      <Input
                        id="aerobicSpeed"
                        value={fitnessForm.aerobicThresholdSpeed}
                        onChange={(e) => setFitnessForm({ ...fitnessForm, aerobicThresholdSpeed: e.target.value })}
                        placeholder="e.g., 12.0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="aerobicHr">Heart Rate (bpm)</Label>
                      <Input
                        id="aerobicHr"
                        value={fitnessForm.aerobicThresholdHr}
                        onChange={(e) => setFitnessForm({ ...fitnessForm, aerobicThresholdHr: e.target.value })}
                        placeholder="e.g., 150"
                      />
                    </div>
                  </div>
                </div>

                {/* Lactate Threshold */}
                <div>
                  <h4 className="font-semibold mb-3">Lactate Threshold</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="lactateLactate">Lactate (mmol/L)</Label>
                      <Input
                        id="lactateLactate"
                        value={fitnessForm.lactateThresholdLactate}
                        onChange={(e) => setFitnessForm({ ...fitnessForm, lactateThresholdLactate: e.target.value })}
                        placeholder="e.g., 4.0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lactateSpeed">Speed (km/h)</Label>
                      <Input
                        id="lactateSpeed"
                        value={fitnessForm.lactateThresholdSpeed}
                        onChange={(e) => setFitnessForm({ ...fitnessForm, lactateThresholdSpeed: e.target.value })}
                        placeholder="e.g., 14.0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lactateHr">Heart Rate (bpm)</Label>
                      <Input
                        id="lactateHr"
                        value={fitnessForm.lactateThresholdHr}
                        onChange={(e) => setFitnessForm({ ...fitnessForm, lactateThresholdHr: e.target.value })}
                        placeholder="e.g., 170"
                      />
                    </div>
                  </div>
                </div>

                {/* Maximum */}
                <div>
                  <h4 className="font-semibold mb-3">Maximum</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="maxLactate">Lactate (mmol/L)</Label>
                      <Input
                        id="maxLactate"
                        value={fitnessForm.maximumLactate}
                        onChange={(e) => setFitnessForm({ ...fitnessForm, maximumLactate: e.target.value })}
                        placeholder="e.g., 8.0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxSpeed">Speed (km/h)</Label>
                      <Input
                        id="maxSpeed"
                        value={fitnessForm.maximumSpeed}
                        onChange={(e) => setFitnessForm({ ...fitnessForm, maximumSpeed: e.target.value })}
                        placeholder="e.g., 16.0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxHr">Heart Rate (bpm)</Label>
                      <Input
                        id="maxHr"
                        value={fitnessForm.maximumHr}
                        onChange={(e) => setFitnessForm({ ...fitnessForm, maximumHr: e.target.value })}
                        placeholder="e.g., 190"
                      />
                    </div>
                  </div>
                </div>

                {/* VO2 Max Metrics */}
                <div>
                  <h4 className="font-semibold mb-3">VO2 Max Metrics</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="vo2MaxRel">VO2 Max (ml/kg/min)</Label>
                      <Input
                        id="vo2MaxRel"
                        value={fitnessForm.vo2MaxMlKgMin}
                        onChange={(e) => setFitnessForm({ ...fitnessForm, vo2MaxMlKgMin: e.target.value })}
                        placeholder="e.g., 55.0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="vo2MaxAbs">VO2 Max (L/min)</Label>
                      <Input
                        id="vo2MaxAbs"
                        value={fitnessForm.vo2MaxLMin}
                        onChange={(e) => setFitnessForm({ ...fitnessForm, vo2MaxLMin: e.target.value })}
                        placeholder="e.g., 4.2"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveFitness}
                    disabled={updateFitnessMutation.isPending}
                    size="sm"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    onClick={handleCancelFitness}
                    variant="outline"
                    size="sm"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
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
