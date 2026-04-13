import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Send, FileText, Loader2 } from "lucide-react";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number;
  clientName: string;
  packageId?: number;
  packageType?: string;
  sessionsTotal?: number;
  pricePerSession?: number; // Pre-populate unit price from package
  /** If provided, opens an existing invoice for editing/sending */
  existingInvoiceId?: number;
}

const CURRENCIES = ["HKD", "USD", "GBP", "EUR", "AUD", "SGD"];

export function InvoiceModal({
  open,
  onOpenChange,
  clientId,
  clientName,
  packageId,
  packageType,
  sessionsTotal,
  pricePerSession,
  existingInvoiceId,
}: InvoiceModalProps) {
  const utils = trpc.useUtils();

  // Invoice state
  const [invoiceId, setInvoiceId] = useState<number | null>(existingInvoiceId ?? null);
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [currency, setCurrency] = useState<string>("HKD");
  const [notes, setNotes] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [status, setStatus] = useState<string>("draft");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Load existing invoice
  const { data: existingInvoice } = trpc.invoices.getById.useQuery(
    { invoiceId: existingInvoiceId! },
    { enabled: !!existingInvoiceId && open }
  );

  useEffect(() => {
    if (existingInvoice) {
      setInvoiceId(existingInvoice.id);
      setInvoiceNumber(existingInvoice.invoiceNumber);
      setLineItems((existingInvoice.lineItems as LineItem[]) || []);
      setTaxRate(parseFloat(String(existingInvoice.taxRate || "0")));
      setCurrency(existingInvoice.currency || "HKD");
      setNotes(existingInvoice.notes || "");
      setDueDate(
        existingInvoice.dueDate
          ? new Date(existingInvoice.dueDate).toISOString().split("T")[0]
          : ""
      );
      setStatus(existingInvoice.status || "draft");
    }
  }, [existingInvoice]);

  // Reset when opening for a new invoice
  useEffect(() => {
    if (open && !existingInvoiceId) {
      setInvoiceId(null);
      setInvoiceNumber("");
      setLineItems(
        packageType && sessionsTotal
          ? [{
              description: packageType,
              quantity: sessionsTotal,
              unitPrice: pricePerSession ?? 0,
              total: Math.round(sessionsTotal * (pricePerSession ?? 0) * 100) / 100,
            }]
          : [{ description: "", quantity: 1, unitPrice: 0, total: 0 }]
      );
      setTaxRate(0);
      setCurrency("HKD");
      setNotes("");
      setDueDate("");
      setStatus("draft");
    }
  }, [open, existingInvoiceId, packageType, sessionsTotal, pricePerSession]);

  const generateMutation = trpc.invoices.generate.useMutation({
    onSuccess: (data) => {
      setInvoiceId(data.invoiceId);
      setInvoiceNumber(data.invoiceNumber);
      toast.success(`Invoice ${data.invoiceNumber} created`);
      utils.invoices.listByTrainer.invalidate();
      if (packageId) utils.invoices.listByPackage.invalidate({ packageId });
    },
    onError: (e) => toast.error(`Failed to create invoice: ${e.message}`),
  });

  const updateMutation = trpc.invoices.update.useMutation({
    onSuccess: () => {
      toast.success("Invoice saved");
      utils.invoices.listByTrainer.invalidate();
      if (packageId) utils.invoices.listByPackage.invalidate({ packageId });
    },
    onError: (e) => toast.error(`Failed to save invoice: ${e.message}`),
  });

  const sendMutation = trpc.invoices.send.useMutation({
    onSuccess: (data) => {
      toast.success(`Invoice sent to ${data.sentTo}`);
      setStatus("sent");
      utils.invoices.listByTrainer.invalidate();
      if (packageId) utils.invoices.listByPackage.invalidate({ packageId });
      onOpenChange(false);
    },
    onError: (e) => toast.error(`Failed to send invoice: ${e.message}`),
  });

  // ── Calculations ─────────────────────────────────────────────────────────────

  function recalcItem(items: LineItem[], index: number): LineItem[] {
    return items.map((item, i) =>
      i === index
        ? { ...item, total: Math.round(item.quantity * item.unitPrice * 100) / 100 }
        : item
    );
  }

  const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  function fmt(n: number) {
    return `${currency} ${n.toFixed(2)}`;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      await generateMutation.mutateAsync({
        clientId,
        packageId,
        packageType,
        sessionsTotal,
        pricePerSession,
        currency,
        notes: notes || undefined,
        dueDate: dueDate || undefined,
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!invoiceId) return;
    await updateMutation.mutateAsync({
      invoiceId,
      lineItems,
      taxRate,
      notes: notes || null,
      dueDate: dueDate || null,
      currency,
    });
  }

  async function handleSend() {
    if (!invoiceId) {
      toast.error("Save the invoice first before sending");
      return;
    }
    // Save latest edits first
    await updateMutation.mutateAsync({
      invoiceId,
      lineItems,
      taxRate,
      notes: notes || null,
      dueDate: dueDate || null,
      currency,
    });
    setIsSending(true);
    try {
      await sendMutation.mutateAsync({ invoiceId });
    } finally {
      setIsSending(false);
    }
  }

  function addLineItem() {
    setLineItems([...lineItems, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = lineItems.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setLineItems(recalcItem(updated, index));
  }

  const isSent = status === "sent";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {invoiceId ? `Invoice ${invoiceNumber}` : "Generate Invoice"}
          </DialogTitle>
          <DialogDescription>
            {isSent
              ? "This invoice has been sent."
              : invoiceId
              ? `Draft invoice for ${clientName}. Edit details then send.`
              : `Create an invoice for ${clientName}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Status badge */}
          {invoiceId && (
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  status === "sent"
                    ? "default"
                    : status === "paid"
                    ? "secondary"
                    : "outline"
                }
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
              {invoiceNumber && (
                <span className="text-sm text-muted-foreground">{invoiceNumber}</span>
              )}
            </div>
          )}

          {/* Currency + Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={isSent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isSent}
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <Label>Line Items</Label>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground w-16">Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Unit Price</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">Total</th>
                    {!isSent && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-2 py-1.5">
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(index, "description", e.target.value)}
                          placeholder="Description"
                          className="h-8 border-0 shadow-none focus-visible:ring-0 px-1"
                          disabled={isSent}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                          className="h-8 border-0 shadow-none focus-visible:ring-0 px-1 text-center"
                          disabled={isSent}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="h-8 border-0 shadow-none focus-visible:ring-0 px-1 text-right"
                          disabled={isSent}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium">
                        {fmt(item.total)}
                      </td>
                      {!isSent && (
                        <td className="px-1 py-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeLineItem(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isSent && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={addLineItem}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Line Item
              </Button>
            )}
          </div>

          {/* Totals */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Label className="text-sm">Tax Rate (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="h-8 w-20"
                  disabled={isSent}
                />
              </div>
              <div className="text-right space-y-1">
                <div className="flex justify-between gap-8 text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between gap-8 text-sm text-muted-foreground">
                    <span>Tax ({taxRate}%)</span>
                    <span>{fmt(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-8 text-base font-semibold">
                  <span>Total</span>
                  <span className="text-primary">{fmt(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes / Payment Instructions (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Please transfer to HSBC account ending 1234 within 7 days."
              rows={3}
              disabled={isSent}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {isSent ? "Close" : "Cancel"}
            </Button>

            {!isSent && (
              <div className="flex items-center gap-2">
                {!invoiceId ? (
                  <Button onClick={handleGenerate} disabled={isGenerating}>
                    {isGenerating ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
                    ) : (
                      <><FileText className="h-4 w-4 mr-2" />Create Invoice</>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
                      ) : (
                        "Save Draft"
                      )}
                    </Button>
                    <Button
                      onClick={handleSend}
                      disabled={isSending || sendMutation.isPending}
                      className="gap-2"
                    >
                      {isSending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
                      ) : (
                        <><Send className="h-4 w-4" />Send to Client</>
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
