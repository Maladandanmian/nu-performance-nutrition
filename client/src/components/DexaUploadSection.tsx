import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface DexaUploadSectionProps {
  clientId: number;
}

export function DexaUploadSection({ clientId }: DexaUploadSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedScanId, setExpandedScanId] = useState<number | null>(null);

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
      utils.dexa.getBodyCompTrend.invalidate({ clientId });
      utils.dexa.getBmdTrend.invalidate({ clientId });
    },
    onError: (error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  const rejectMutation = trpc.dexa.updateScanStatus.useMutation({
    onSuccess: () => {
      toast.success("Scan rejected");
      utils.dexa.getClientScans.invalidate({ clientId });
      utils.dexa.getBodyCompTrend.invalidate({ clientId });
      utils.dexa.getBmdTrend.invalidate({ clientId });
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

  const toggleScanDetails = (scanId: number) => {
    setExpandedScanId(expandedScanId === scanId ? null : scanId);
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
              <ScanCard
                key={scan.id}
                scan={scan}
                isExpanded={expandedScanId === scan.id}
                onToggle={() => toggleScanDetails(scan.id)}
                onApprove={() =>
                  approveMutation.mutate({
                    scanId: scan.id,
                    status: "approved",
                  })
                }
                onReject={() =>
                  rejectMutation.mutate({
                    scanId: scan.id,
                    status: "rejected",
                    rejectionReason: "Manual rejection",
                  })
                }
                isProcessing={approveMutation.isPending || rejectMutation.isPending}
              />
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

interface ScanCardProps {
  scan: any;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}

function ScanCard({ scan, isExpanded, onToggle, onApprove, onReject, isProcessing }: ScanCardProps) {
  const { data: details, isLoading: detailsLoading } = trpc.dexa.getScanDetails.useQuery(
    { scanId: scan.id },
    { enabled: isExpanded }
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-white hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <div className="flex-1 flex items-center gap-3">
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

        <div className="flex items-center gap-2">
          {scan.status === "pending" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove();
                }}
                disabled={isProcessing}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onReject();
                }}
                disabled={isProcessing}
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
          
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t bg-gray-50 p-4">
          {detailsLoading ? (
            <div className="text-center py-4 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading scan details...
            </div>
          ) : details ? (
            <div className="space-y-4">
              {/* Extracted Images */}
              {details.images && details.images.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Extracted Images</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {details.images.map((image: any) => (
                      <div key={image.id} className="border rounded-lg overflow-hidden bg-white">
                        <img
                          src={image.imageUrl}
                          alt={formatImageType(image.imageType)}
                          className="w-full h-auto"
                        />
                        <div className="p-2 text-sm text-gray-600 text-center border-t">
                          {formatImageType(image.imageType)} (Page {image.pageNumber})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Metrics */}
              {details.bodyComp && (
                <div>
                  <h4 className="font-semibold mb-3">Body Composition</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {details.bodyComp.totalBodyFatPct && (
                      <MetricCard label="Body Fat %" value={`${details.bodyComp.totalBodyFatPct}%`} />
                    )}
                    {details.bodyComp.vatArea && (
                      <MetricCard label="VAT Area" value={`${details.bodyComp.vatArea} cm²`} />
                    )}
                    {details.bodyComp.totalLeanMass && (
                      <MetricCard label="Lean Mass" value={`${details.bodyComp.totalLeanMass} g`} />
                    )}
                    {details.bodyComp.totalFatMass && (
                      <MetricCard label="Fat Mass" value={`${details.bodyComp.totalFatMass} g`} />
                    )}
                    {details.bodyComp.androidGynoidRatio && (
                      <MetricCard label="A/G Ratio" value={details.bodyComp.androidGynoidRatio} />
                    )}
                  </div>
                </div>
              )}

              {/* BMD Data */}
              {details.bmdData && details.bmdData.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Bone Mineral Density</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="text-left p-2">Region</th>
                          <th className="text-right p-2">BMD</th>
                          <th className="text-right p-2">T-Score</th>
                          <th className="text-right p-2">Z-Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.bmdData.map((bmd: any, idx: number) => (
                          <tr key={idx} className="border-b">
                            <td className="p-2">{bmd.region}</td>
                            <td className="text-right p-2">{bmd.bmd || "-"}</td>
                            <td className="text-right p-2">{bmd.tScore || "-"}</td>
                            <td className="text-right p-2">{bmd.zScore || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PDF Link */}
              <div className="pt-2">
                <a
                  href={scan.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  View Original PDF →
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">No details available</div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function formatImageType(type: string): string {
  const labels: Record<string, string> = {
    body_scan_colorized: "Body Scan (Color)",
    body_scan_grayscale: "Body Scan (Skeletal)",
    fracture_risk_chart: "Fracture Risk Chart",
    body_fat_chart: "Body Fat % Chart",
  };
  return labels[type] || type;
}
