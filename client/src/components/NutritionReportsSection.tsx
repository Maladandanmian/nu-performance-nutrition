import { useState } from 'react';
import { Upload, FileText, Loader2, Pencil, Trash2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

interface NutritionReportsSectionProps {
  clientId: number;
  isTrainer?: boolean;
}

export function NutritionReportsSection({ clientId, isTrainer = true }: NutritionReportsSectionProps) {
  // Toast is imported from sonner
  const [isUploading, setIsUploading] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<{
    goals?: string;
    currentStatus?: string;
    recommendations?: string;
  }>({});
  const [currentReportIndex, setCurrentReportIndex] = useState(0);

  // Queries - now fetching all reports with polling for AI analysis updates
  const { data: reports, isLoading, refetch } = trpc.nutritionReports.getAll.useQuery(
    { clientId },
    {
      refetchInterval: (data) => {
        // Poll every 5 seconds if any report is missing analysis data
        if (!data || !Array.isArray(data)) return false;
        const hasIncompleteAnalysis = data.some(
          (report: any) => !report.goalsText || !report.currentStatusText || !report.recommendationsText
        );
        return hasIncompleteAnalysis ? 5000 : false;
      },
    }
  );

  // Mutations
  const uploadMutation = trpc.nutritionReports.upload.useMutation({
    onSuccess: () => {
      toast.success('Nutrition report uploaded successfully. AI analysis in progress...');
      refetch();
      setCurrentReportIndex(0); // Show the newest report after upload
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateSummaryMutation = trpc.nutritionReports.updateSummary.useMutation({
    onSuccess: () => {
      toast.success('Summary updated successfully');
      setEditingField(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.nutritionReports.delete.useMutation({
    onSuccess: () => {
      toast.success('Nutrition report deleted successfully');
      // Reset to first report if we deleted the current one
      setCurrentReportIndex(0);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setIsUploading(true);
    try {
      // Convert file to base64 for upload
      const fileBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(fileBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // Upload via tRPC mutation (server will handle S3 upload)
      await uploadMutation.mutateAsync({
        clientId,
        filename: file.name,
        fileData: base64,
        reportDate: new Date(),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const startEditing = (field: string, currentValue: string | null) => {
    setEditingField(field);
    setEditedValues({ ...editedValues, [field]: currentValue || '' });
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditedValues({});
  };

  const saveEdit = async (field: string) => {
    if (!reports || reports.length === 0) return;
    const currentReport = reports[currentReportIndex];

    await updateSummaryMutation.mutateAsync({
      reportId: currentReport.id,
      [field]: editedValues[field as keyof typeof editedValues],
    });
  };

  const handleDelete = async () => {
    if (!reports || reports.length === 0) return;
    const currentReport = reports[currentReportIndex];
    if (!confirm('Are you sure you want to delete this nutrition report?')) return;

    await deleteMutation.mutateAsync({ reportId: currentReport.id });
  };

  const goToPreviousReport = () => {
    if (currentReportIndex > 0) {
      setCurrentReportIndex(currentReportIndex - 1);
      setEditingField(null); // Cancel any editing when switching reports
    }
  };

  const goToNextReport = () => {
    if (reports && currentReportIndex < reports.length - 1) {
      setCurrentReportIndex(currentReportIndex + 1);
      setEditingField(null); // Cancel any editing when switching reports
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nutrition Report</CardTitle>
          <CardDescription>
            {isTrainer ? 'Upload a nutrition report PDF to generate AI-powered insights' : 'No nutrition reports available yet'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <FileText className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No nutrition report uploaded yet</p>
            {isTrainer && (
              <div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                  id="nutrition-report-upload"
                />
                <label htmlFor="nutrition-report-upload">
                  <Button disabled={isUploading} asChild>
                    <span>
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Report
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentReport = reports[currentReportIndex];

  const renderEditableField = (field: string, label: string, value: string | null) => {
    const isEditing = editingField === field;
    const displayValue = value || 'No data extracted yet';

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">{label}</Label>
          {!isEditing && isTrainer && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => startEditing(field, value)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
        {isEditing && isTrainer ? (
          <div className="space-y-2">
            <Textarea
              value={editedValues[field as keyof typeof editedValues] || ''}
              onChange={(e) => setEditedValues({ ...editedValues, [field]: e.target.value })}
              rows={6}
              className="font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveEdit(field)} disabled={updateSummaryMutation.isPending}>
                <Check className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEditing}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md bg-muted p-4 text-sm prose prose-sm max-w-none dark:prose-invert">
            <Streamdown>{displayValue}</Streamdown>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Report Header with Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <CardTitle>Nutrition Report</CardTitle>
                {reports.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousReport}
                      disabled={currentReportIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground min-w-[100px] text-center">
                      Report {currentReportIndex + 1} of {reports.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextReport}
                      disabled={currentReportIndex === reports.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <CardDescription>
                Uploaded on {new Date(currentReport.uploadedAt).toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={currentReport.pdfUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-2" />
                  View PDF
                </a>
              </Button>
              {isTrainer && (
                <>
                  <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                  {/* Upload new report button */}
                  <div>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="hidden"
                      id="nutrition-report-upload-new"
                    />
                    <label htmlFor="nutrition-report-upload-new">
                      <Button variant="default" size="sm" disabled={isUploading} asChild>
                        <span>
                          {isUploading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload New
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* AI Analysis Status */}
      {!currentReport.goalsText && !currentReport.currentStatusText && !currentReport.recommendationsText && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p>AI is analyzing the nutrition report... This may take a minute.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals & Targets */}
      {renderEditableField('goals', 'Goals & Targets', currentReport.goalsText)}

      {/* Current Status */}
      {renderEditableField('currentStatus', 'Current Status', currentReport.currentStatusText)}

      {/* Recommendations */}
      {renderEditableField('recommendations', 'Key Recommendations', currentReport.recommendationsText)}
    </div>
  );
}
