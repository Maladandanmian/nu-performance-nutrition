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
  pricePerSession?: number;
  /** If provided, opens an existing invoice for editing/sending */
  existingInvoiceId?: number;
}

const CURRENCIES = ["HKD", "USD", "GBP", "EUR", "AUD", "SGD"];

/** Temporary standard pricing for service types (HKD) — Luke can edit these per invoice */
const SERVICE_TYPE_PRICING: Record<string, { unitPrice: number; quantity?: number }> = {
  "PT Package": { unitPrice: 950, quantity: 10 }, // 10 sessions × HKD 950
  "PT PAYG": { unitPrice: 950 }, // Single session
  "Nutrition Consult": { unitPrice: 500 },
  "Monthly Online Gym Program": { unitPrice: 300 },
  "One Month Nutrition Coaching": { unitPrice: 800 },
  "Three Month Nutrition Coaching": { unitPrice: 2000 },
};

/** Returns a date string YYYY-MM-DD for today + n days */
function dateInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function recalcItem(items: LineItem[], index: number): LineItem[] {
  return items.map((item, i) =>
    i === index
      ? { ...item, total: Math.round(item.quantity * item.unitPrice * 100) / 100 }
      : item
  );
}

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
  const [currency, setCurrency] = useState<string>("HKD");
  const [notes, setNotes] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [status, setStatus] = useState<string>("draft");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // New fields
  const [serviceType, setServiceType] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState<string>("");
  const [discountDescription, setDiscountDescription] = useState<string>("");

  // PAYG mode: when no clientId is provided, allow selecting a client
  const isPAYG = !packageId && clientId === 0;
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedClientName, setSelectedClientName] = useState<string>("");

  const { data: clients = [] } = trpc.clients.list.useQuery(undefined, {
    enabled: isPAYG && open,
  });

  const { data: serviceTypes = [], error: serviceTypesError } = trpc.invoices.listServiceTypes.useQuery(undefined, {
    enabled: open,
  });
  if (serviceTypesError) console.error('[InvoiceModal] listServiceTypes error:', serviceTypesError.message, serviceTypesError.data?.code);

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
      setCurrency(existingInvoice.currency || "HKD");
      setNotes(existingInvoice.notes || "");
      setDueDate(
        existingInvoice.dueDate
          ? new Date(existingInvoice.dueDate).toISOString().split("T")[0]
          : dateInDays(14)
      );
      setStatus(existingInvoice.status || "draft");
      setServiceType((existingInvoice as any).serviceType || "");
      setDiscountAmount(
        (existingInvoice as any).discountAmount
          ? String(parseFloat((existingInvoice as any).discountAmount))
          : ""
      );
      setDiscountDescription((existingInvoice as any).discountDescription || "");
    }
  }, [existingInvoice]);

  // Reset when opening for a new invoice, pre-populate line items from package
  useEffect(() => {
    if (open && !existingInvoiceId) {
      setInvoiceId(null);
      setInvoiceNumber("");
      // Pre-populate line items from package props if available
      if (packageType && sessionsTotal) {
        const unitPrice = pricePerSession ?? 0;
        setLineItems([{
          description: packageType,
          quantity: sessionsTotal,
          unitPrice,
          total: Math.round(sessionsTotal * unitPrice * 100) / 100,
        }]);
      } else {
        setLineItems([]);
      }
      setCurrency("HKD");
      setNotes("");
      setDueDate(dateInDays(14));
      setStatus("draft");
      setServiceType("");
      setDiscountAmount("");
      setDiscountDescription("");
      setSelectedClientId("");
      setSelectedClientName("");
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
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  const sendMutation = trpc.invoices.send.useMutation({
    onSuccess: (data) => {
      toast.success(`Invoice sent to ${data.sentTo}`);
      setStatus("sent");
      utils.invoices.listByTrainer.invalidate();
      if (packageId) utils.invoices.listByPackage.invalidate({ packageId });
    },
    onError: (e) => toast.error(`Send failed: ${e.message}`),
  });

  const subtotal = Math.round(lineItems.reduce((s, i) => s + i.total, 0) * 100) / 100;
  const discountNum = parseFloat(discountAmount) || 0;
  const total = Math.max(0, Math.round((subtotal - discountNum) * 100) / 100);

  function fmt(n: number) {
    return `${currency} ${n.toFixed(2)}`;
  }

  // Auto-populate line item when service type is selected
  useEffect(() => {
    if (serviceType && serviceType !== "_none" && !existingInvoiceId) {
      const pricing = SERVICE_TYPE_PRICING[serviceType];
      if (pricing) {
        const qty = pricing.quantity ?? 1;
        const total = Math.round(qty * pricing.unitPrice * 100) / 100;
        const description = pricing.quantity
          ? `${serviceType} - ${pricing.quantity} sessions`
          : serviceType;
        setLineItems([{
          description,
          quantity: qty,
          unitPrice: pricing.unitPrice,
          total,
        }]);
      }
    }
  }, [serviceType, existingInvoiceId]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    const resolvedClientId = isPAYG ? parseInt(selectedClientId) : clientId;
    if (!resolvedClientId) {
      toast.error("Please select a client");
      return;
    }
    if (lineItems.length === 0) {
      toast.error("Add at least one line item before creating the invoice");
      return;
    }
    setIsGenerating(true);
    try {
      // Create invoice with the line items already built in the modal
      const invoiceData = await generateMutation.mutateAsync({
        clientId: resolvedClientId,
        packageId,
        lineItems: lineItems.length > 0 ? lineItems : undefined,
        // Don't pass packageType/sessionsTotal/pricePerSession — line items are already set
        currency,
        notes: notes || undefined,
        dueDate: dueDate || undefined,
        serviceType: serviceType && serviceType !== "_none" ? serviceType : undefined,
        discountAmount: discountNum > 0 ? discountNum : undefined,
        discountDescription: discountDescription || undefined,
      });
      // After creation, update the invoice with the pre-built line items
      if (invoiceData?.invoiceId && lineItems.length > 0) {
        await updateMutation.mutateAsync({
          invoiceId: invoiceData.invoiceId,
          lineItems,
          taxRate: 0,
          notes: notes || null,
          dueDate: dueDate || null,
          currency,
          serviceType: serviceType && serviceType !== "_none" ? serviceType : null,
          discountAmount: discountNum > 0 ? discountNum : null,
          discountDescription: discountDescription || null,
        });
      }
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!invoiceId) return;
    await updateMutation.mutateAsync({
      invoiceId,
      lineItems,
      taxRate: 0,
      notes: notes || null,
      dueDate: dueDate || null,
      currency,
      serviceType: serviceType && serviceType !== "_none" ? serviceType : null,
      discountAmount: discountNum > 0 ? discountNum : null,
      discountDescription: discountDescription || null,
    });
  }

  async function handleSend() {
    if (!invoiceId) {
      toast.error("Save the invoice first before sending");
      return;
    }
    await updateMutation.mutateAsync({
      invoiceId,
      lineItems,
      taxRate: 0,
      notes: notes || null,
      dueDate: dueDate || null,
      currency,
      serviceType: serviceType && serviceType !== "_none" ? serviceType : null,
      discountAmount: discountNum > 0 ? discountNum : null,
      discountDescription: discountDescription || null,
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
  const resolvedClientName = isPAYG ? selectedClientName : clientName;

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
              ? `Draft invoice for ${resolvedClientName}. Edit details then send.`
              : `Create an invoice${resolvedClientName ? ` for ${resolvedClientName}` : ""}.`}
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

          {/* PAYG: client selector */}
          {isPAYG && !invoiceId && (
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select
                value={selectedClientId}
                onValueChange={(val) => {
                  setSelectedClientId(val);
                  const c = clients.find((cl: any) => String(cl.id) === val);
                  setSelectedClientName(c ? c.name : "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Service Type */}
          <div className="space-y-1.5">
            <Label>Service Type <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={serviceType || "_none"} onValueChange={(v) => setServiceType(v === "_none" ? "" : v)} disabled={isSent}>
              <SelectTrigger>
                <SelectValue placeholder="Select service type…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {serviceTypes.map((st: any) => {
                  const pricing = SERVICE_TYPE_PRICING[st.name];
                  const displayPrice = pricing ? `${currency} ${pricing.unitPrice.toFixed(2)}` : "";
                  const displayQty = pricing?.quantity ? ` × ${pricing.quantity}` : "";
                  return (
                    <SelectItem key={st.id} value={st.name}>
                      {st.name} {displayPrice && `(${displayPrice}${displayQty})`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

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
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isSent}
              />
            </div>
          </div>

          {/* Line Items — visible before and after creation */}
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
                  {lineItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-sm text-muted-foreground">
                        No line items yet — add one below.
                      </td>
                    </tr>
                  )}
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
            {!invoiceId && lineItems.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Add at least one line item before creating the invoice.
              </p>
            )}
          </div>

          {/* Discount */}
          {!isSent && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Discount Amount <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Discount Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="e.g. Loyalty discount"
                  value={discountDescription}
                  onChange={(e) => setDiscountDescription(e.target.value)}
                />
              </div>
            </div>
          )}
          {isSent && discountNum > 0 && (
            <div className="text-sm text-muted-foreground">
              Discount applied: {fmt(discountNum)}{discountDescription ? ` — ${discountDescription}` : ""}
            </div>
          )}

          {/* Totals */}
          <div className="border-t pt-3 flex justify-end">
            <div className="text-right space-y-1 min-w-[200px]">
              <div className="flex justify-between gap-12 text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              {discountNum > 0 && (
                <div className="flex justify-between gap-12 text-sm text-green-700">
                  <span>Discount{discountDescription ? ` (${discountDescription})` : ""}</span>
                  <span>− {fmt(discountNum)}</span>
                </div>
              )}
              <div className="flex justify-between gap-12 text-base font-semibold border-t pt-1">
                <span>Total</span>
                <span className="text-primary">{fmt(total)}</span>
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
