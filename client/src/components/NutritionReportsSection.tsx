import { useState } from 'react';
import { Upload, FileText, Loader2, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface NutritionReportsSectionProps {
  clientId: number;
}

export function NutritionReportsSection({ clientId }: NutritionReportsSectionProps) {
  // Toast is imported from sonner
  const [isUploading, setIsUploading] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<{
    goals?: string;
    currentStatus?: string;
    recommendations?: string;
  }>({});

  // Queries
  const { data: report, isLoading, refetch } = trpc.nutritionReports.get.useQuery({ clientId });

  // Mutations
  const uploadMutation = trpc.nutritionReports.upload.useMutation({
    onSuccess: () => {
      toast.success('Nutrition report uploaded successfully. AI analysis in progress...');
      refetch();
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
    if (!report) return;

    await updateSummaryMutation.mutateAsync({
      reportId: report.id,
      [field]: editedValues[field as keyof typeof editedValues],
    });
  };

  const handleDelete = async () => {
    if (!report) return;
    if (!confirm('Are you sure you want to delete this nutrition report?')) return;

    await deleteMutation.mutateAsync({ reportId: report.id });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nutrition Report</CardTitle>
          <CardDescription>Upload a nutrition report PDF to generate AI-powered insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <FileText className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No nutrition report uploaded yet</p>
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
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderEditableField = (field: string, label: string, value: string | null) => {
    const isEditing = editingField === field;
    const displayValue = value || 'No data extracted yet';

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">{label}</Label>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => startEditing(field, value)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
        {isEditing ? (
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
          <div className="rounded-md bg-muted p-4 whitespace-pre-wrap text-sm">
            {displayValue}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Nutrition Report</CardTitle>
              <CardDescription>
                Uploaded on {new Date(report.uploadedAt).toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-2" />
                  View PDF
                </a>
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* AI Analysis Status */}
      {!report.goalsText && !report.currentStatusText && !report.recommendationsText && (
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
      {renderEditableField('goals', 'Goals & Targets', report.goalsText)}

      {/* Current Status */}
      {renderEditableField('currentStatus', 'Current Status', report.currentStatusText)}

      {/* Recommendations */}
      {renderEditableField('recommendations', 'Key Recommendations', report.recommendationsText)}
    </div>
  );
}
