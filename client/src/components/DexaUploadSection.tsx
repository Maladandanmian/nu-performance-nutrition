import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface DexaUploadSectionProps {
  clientId: number;
}

export function DexaUploadSection({ clientId }: DexaUploadSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const utils = trpc.useUtils();
  const { data: scans, isLoading } = trpc.dexa.getClientScans.useQuery({ clientId });

  const uploadMutation = trpc.dexa.uploadScan.useMutation({
    onSuccess: () => {
      toast.success("DEXA scan uploaded and analyzed successfully!");
      setSelectedFile(null);
      setIsUploading(false);
      utils.dexa.getClientScans.invalidate({ clientId });
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setIsUploading(false);
    },
  });

  const approveMutation = trpc.dexa.updateScanStatus.useMutation({
    onSuccess: () => {
      toast.success("Scan approved!");
      utils.dexa.getClientScans.invalidate({ clientId });
    },
    onError: (error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  const rejectMutation = trpc.dexa.updateScanStatus.useMutation({
    onSuccess: () => {
      toast.success("Scan rejected");
      utils.dexa.getClientScans.invalidate({ clientId });
    },
    onError: (error) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
    } else {
      toast.error("Please select a PDF file");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setIsUploading(true);

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result?.toString().split(",")[1];
      if (!base64) {
        toast.error("Failed to read file");
        setIsUploading(false);
        return;
      }

      uploadMutation.mutate({
        clientId,
        pdfFile: {
          data: base64,
          filename: selectedFile.name,
        },
      });
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
      setIsUploading(false);
    };
    reader.readAsDataURL(selectedFile);
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="dexa-pdf">Upload DEXA Scan PDF</Label>
            <Input
              id="dexa-pdf"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={isUploading}
              className="mt-2"
            />
          </div>

          {selectedFile && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4" />
              <span>{selectedFile.name}</span>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing PDF...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload and Analyze
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Scans List */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Uploaded Scans</h3>
        
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading scans...</div>
        ) : scans && scans.length > 0 ? (
          <div className="space-y-3">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className="border rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium">
                        Scan from {new Date(scan.scanDate).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {scan.scanType || "Whole Body"} • {scan.scanId || "No ID"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {scan.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          approveMutation.mutate({
                            scanId: scan.id,
                            status: "approved",
                          })
                        }
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          rejectMutation.mutate({
                            scanId: scan.id,
                            status: "rejected",
                            rejectionReason: "Manual rejection",
                          })
                        }
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                  {scan.status === "approved" && (
                    <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Approved
                    </span>
                  )}
                  {scan.status === "rejected" && (
                    <span className="text-sm text-red-600 font-medium flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      Rejected
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No DEXA scans uploaded yet
          </div>
        )}
      </div>
    </div>
  );
}
