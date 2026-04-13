import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Calendar, Package, Pencil, Trash2, MinusCircle, FileText } from "lucide-react";
import { InvoiceModal } from "./InvoiceModal";

const SESSION_TYPE_LABELS: Record<string, string> = {
  "1on1_pt": "1-on-1 Personal Training",
  "2on1_pt": "2-on-1 Personal Training",
  "nutrition_coaching": "Nutrition Coaching",
  "nutrition_initial": "Initial Nutrition Consultation",
  "group_class": "Group Class",
  "online_coaching": "Online Coaching",
  "nutrition_consult": "Nutrition Consultation",
  "conditioning": "Conditioning",
  "strength_conditioning": "Strength & Conditioning",
};

function formatPackageType(t: string) {
  return SESSION_TYPE_LABELS[t] || t;
}

interface Package {
  id: number;
  packageType: string;
  sessionsTotal: number;
  sessionsRemaining: number;
  pricePerSession?: string | number | null;
  purchaseDate: Date | string | null;
  expiryDate: Date | string | null;
  notes: string | null;
  clientName?: string | null;
  clientId: number;
  trainerId: number;
}

interface PackageManagementProps {
  trainerId: number;
}

export function PackageManagement({ trainerId }: PackageManagementProps) {
  const utils = trpc.useUtils();

  const { data: allPackages, isLoading } = trpc.sessionPackages.getByTrainer.useQuery({
    trainerId,
  });

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [editingPkg, setEditingPkg] = useState<Package | null>(null);
  const [editPackageType, setEditPackageType] = useState("");
  const [editPricePerSession, setEditPricePerSession] = useState("");
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // ── Delete state ─────────────────────────────────────────────────────────────
  const [deletingPkg, setDeletingPkg] = useState<Package | null>(null);

  // ── Invoice state ─────────────────────────────────────────────────────────────
  const [invoicingPkg, setInvoicingPkg] = useState<Package | null>(null);

  // ── Deduct state ─────────────────────────────────────────────────────────────
  const [deductingPkg, setDeductingPkg] = useState<Package | null>(null);
  const [deductCount, setDeductCount] = useState("1");
  const [deductNote, setDeductNote] = useState("");

  // ── Mutations ────────────────────────────────────────────────────────────────
  const updateMutation = trpc.sessionPackages.update.useMutation({
    onSuccess: () => {
      toast.success("Package updated");
      setEditingPkg(null);
      utils.sessionPackages.invalidate();
    },
    onError: (e) => toast.error(`Update failed: ${e.message}`),
  });

  const deleteMutation = trpc.sessionPackages.delete.useMutation({
    onSuccess: () => {
      toast.success("Package deleted");
      setDeletingPkg(null);
      utils.sessionPackages.invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
      setDeletingPkg(null);
    },
  });

  const deductMutation = trpc.sessionPackages.deductSessions.useMutation({
    onSuccess: (data) => {
      toast.success(`Deducted sessions. New total: ${data.newTotal}`);
      setDeductingPkg(null);
      setDeductCount("1");
      setDeductNote("");
      utils.sessionPackages.invalidate();
    },
    onError: (e) => toast.error(`Deduction failed: ${e.message}`),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function openEdit(pkg: Package) {
    setEditingPkg(pkg);
    setEditPackageType(pkg.packageType);
    setEditPricePerSession(pkg.pricePerSession != null ? String(pkg.pricePerSession) : "");
    setEditExpiryDate(
      pkg.expiryDate ? new Date(pkg.expiryDate).toISOString().split("T")[0] : ""
    );
    setEditNotes(pkg.notes || "");
  }

  function submitEdit() {
    if (!editingPkg) return;
    const price = editPricePerSession ? parseFloat(editPricePerSession) : null;
    updateMutation.mutate({
      packageId: editingPkg.id,
      packageType: editPackageType || undefined,
      pricePerSession: price,
      expiryDate: editExpiryDate || null,
      notes: editNotes || null,
    });
  }

  function submitDeduct() {
    if (!deductingPkg) return;
    const n = parseInt(deductCount);
    if (isNaN(n) || n < 1) {
      toast.error("Enter a valid number of sessions to deduct");
      return;
    }
    deductMutation.mutate({
      packageId: deductingPkg.id,
      count: n,
      note: deductNote || undefined,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const activePackages = allPackages?.filter((pkg) => pkg.sessionsRemaining > 0) || [];
  const exhaustedPackages = allPackages?.filter((pkg) => pkg.sessionsRemaining <= 0) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Packages</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading packages…</p>
        </CardContent>
      </Card>
    );
  }

  function renderPackage(pkg: Package) {
    const usedSessions = pkg.sessionsTotal - pkg.sessionsRemaining;
    const progressPercent = pkg.sessionsTotal > 0 ? (usedSessions / pkg.sessionsTotal) * 100 : 0;
    const isExpiringSoon =
      pkg.expiryDate &&
      new Date(pkg.expiryDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
    const hasUsedSessions = usedSessions > 0;

    return (
      <div key={pkg.id} className="rounded-lg border bg-card p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{formatPackageType(pkg.packageType)}</span>
            </div>
            {pkg.expiryDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Expires: {new Date(pkg.expiryDate).toLocaleDateString()}
                {isExpiringSoon && (
                  <Badge variant="destructive" className="ml-1">Expiring Soon</Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={pkg.sessionsRemaining > 0 ? "secondary" : "outline"}>
              {pkg.sessionsRemaining} / {pkg.sessionsTotal} left
            </Badge>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{usedSessions} of {pkg.sessionsTotal} used</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Notes */}
        {pkg.notes && (
          <p className="text-xs text-muted-foreground whitespace-pre-line">{pkg.notes}</p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => openEdit(pkg)}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => {
              setDeductingPkg(pkg);
              setDeductCount("1");
              setDeductNote("");
            }}
          >
            <MinusCircle className="h-3 w-3" />
            Deduct Session
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => setInvoicingPkg(pkg)}
          >
            <FileText className="h-3 w-3" />
            Invoice
          </Button>

          <Button
            size="sm"
            variant="outline"
            className={`gap-1.5 text-xs border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground ${
              hasUsedSessions ? "opacity-40 cursor-not-allowed" : ""
            }`}
            disabled={hasUsedSessions}
            title={hasUsedSessions ? `Cannot delete: ${usedSessions} session${usedSessions !== 1 ? "s are" : " is"} linked to this package` : "Delete package"}
            onClick={() => !hasUsedSessions && setDeletingPkg(pkg)}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Active Packages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {activePackages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active packages.</p>
          ) : (
            // Group by client
            Object.entries(
              activePackages.reduce((acc, pkg) => {
                const name = pkg.clientName || "Unknown Client";
                if (!acc[name]) acc[name] = [];
                acc[name].push(pkg as Package);
                return acc;
              }, {} as Record<string, Package[]>)
            ).map(([clientName, pkgs]) => (
              <div key={clientName} className="space-y-3">
                <p className="text-sm font-medium">{clientName}</p>
                <div className="space-y-3 pl-4">
                  {pkgs.map(renderPackage)}
                </div>
              </div>
            ))
          )}

          {exhaustedPackages.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-3">Exhausted packages</p>
              <div className="space-y-3">
                {exhaustedPackages.map((pkg) => (
                  <div key={pkg.id} className="rounded-lg border bg-muted/30 p-4 space-y-3 opacity-70">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{formatPackageType(pkg.packageType)}</span>
                        <span className="text-xs text-muted-foreground">— {pkg.clientName}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">0 / {pkg.sessionsTotal} left</Badge>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openEdit(pkg as Package)}>
                        <Pencil className="h-3 w-3" />Edit
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setInvoicingPkg(pkg as Package)}>
                        <FileText className="h-3 w-3" />Invoice
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => setDeletingPkg(pkg as Package)}
                      >
                        <Trash2 className="h-3 w-3" />Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={!!editingPkg} onOpenChange={(o) => !o && setEditingPkg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Package</DialogTitle>
            <DialogDescription>
              Update package type, expiry date, or notes. Session counts are managed separately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Package Type</Label>
              <Select value={editPackageType} onValueChange={setEditPackageType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1on1_pt">1-on-1 Personal Training</SelectItem>
                  <SelectItem value="2on1_pt">2-on-1 Personal Training</SelectItem>
                  <SelectItem value="nutrition_coaching">Nutrition Coaching</SelectItem>
                  <SelectItem value="nutrition_initial">Initial Nutrition Consultation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Price per Session (optional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g., 800"
                value={editPricePerSession}
                onChange={(e) => setEditPricePerSession(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Expiry Date (optional)</Label>
              <Input
                type="date"
                value={editExpiryDate}
                onChange={(e) => setEditExpiryDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Any notes about this package…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPkg(null)}>Cancel</Button>
            <Button onClick={submitEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────────────────────────── */}
      <AlertDialog open={!!deletingPkg} onOpenChange={(o) => !o && setDeletingPkg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the{" "}
              <strong>{deletingPkg ? formatPackageType(deletingPkg.packageType) : ""}</strong>{" "}
              package. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingPkg && deleteMutation.mutate({ packageId: deletingPkg.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete Package"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Invoice Modal ─────────────────────────────────────────────────── */}
      {invoicingPkg && (
        <InvoiceModal
          open={!!invoicingPkg}
          onOpenChange={(o) => !o && setInvoicingPkg(null)}
          clientId={invoicingPkg.clientId}
          clientName={invoicingPkg.clientName || "Client"}
          packageId={invoicingPkg.id}
          packageType={formatPackageType(invoicingPkg.packageType)}
          sessionsTotal={invoicingPkg.sessionsTotal}
          pricePerSession={invoicingPkg.pricePerSession != null ? parseFloat(String(invoicingPkg.pricePerSession)) : undefined}
        />
      )}

      {/* ── Deduct Sessions Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!deductingPkg} onOpenChange={(o) => !o && setDeductingPkg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deduct Sessions</DialogTitle>
            <DialogDescription>
              Reduce the total session count for this package. Use this to account for trial
              sessions attended before the package was created.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {deductingPkg && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <span className="font-medium">{formatPackageType(deductingPkg.packageType)}</span>
                <span className="text-muted-foreground ml-2">
                  — {deductingPkg.sessionsRemaining} / {deductingPkg.sessionsTotal} remaining
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="deductCount">Sessions to deduct</Label>
              <Input
                id="deductCount"
                type="number"
                min="1"
                max={deductingPkg?.sessionsTotal}
                value={deductCount}
                onChange={(e) => setDeductCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deductNote">Reason (optional)</Label>
              <Input
                id="deductNote"
                placeholder="e.g. Trial session on 15 Mar"
                value={deductNote}
                onChange={(e) => setDeductNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeductingPkg(null)}>Cancel</Button>
            <Button onClick={submitDeduct} disabled={deductMutation.isPending}>
              {deductMutation.isPending ? "Deducting…" : "Confirm Deduction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
