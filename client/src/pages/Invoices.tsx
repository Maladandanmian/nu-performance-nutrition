import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceModal } from "@/components/InvoiceModal";
import { ArrowLeft, FileText, Search, Send, Eye, CheckCircle, RefreshCw, Plus } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

const STATUS_COLOURS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "default",
  paid: "secondary",
  cancelled: "destructive",
};

function formatCurrency(amount: number | string, currency: string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${currency} ${num.toFixed(2)}`;
}

function formatDate(d: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Hong_Kong", ...(opts ?? { day: "numeric", month: "short" }) });
}

export default function Invoices() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [viewingInvoiceId, setViewingInvoiceId] = useState<number | null>(null);
  const [showPAYGModal, setShowPAYGModal] = useState(false);

  const utils = trpc.useUtils();

  const { data: invoices = [], isLoading } = trpc.invoices.listByTrainer.useQuery(undefined, {
    enabled: !!user,
  });

  const markPaidMutation = trpc.invoices.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as paid");
      utils.invoices.listByTrainer.invalidate();
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const resendMutation = trpc.invoices.resend.useMutation({
    onSuccess: (data) => {
      toast.success(`Invoice resent to ${data.sentTo}`);
      utils.invoices.listByTrainer.invalidate();
    },
    onError: (e) => toast.error(`Resend failed: ${e.message}`),
  });

  const filtered = invoices.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.status.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: invoices.length,
    draft: invoices.filter((i) => i.status === "draft").length,
    sent: invoices.filter((i) => i.status === "sent").length,
    paid: invoices.filter((i) => i.status === "paid").length,
  };

  return (
    <div className="container py-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/trainer">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All invoices — package-based and PAYG services
          </p>
        </div>
        <Button onClick={() => setShowPAYGModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total },
          { label: "Draft", value: stats.draft },
          { label: "Sent", value: stats.sent },
          { label: "Paid", value: stats.paid },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by invoice number or status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading invoices…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {search ? "No invoices match your search." : "No invoices yet. Use 'New Invoice' to create one, or generate from a client package."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Invoice #</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Created</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Due</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Total</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sent</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Paid On</th>
                    <th className="w-28" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 font-medium">{inv.invoiceNumber}</td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {formatDate(inv.createdAt, { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="py-3 px-3 text-right font-medium">
                        {formatCurrency(inv.total, inv.currency || "HKD")}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge variant={STATUS_COLOURS[inv.status] || "outline"}>
                          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground text-xs">
                        {formatDate(inv.sentAt)}
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground text-xs">
                        {(inv as any).paidAt ? formatDate((inv as any).paidAt) : "—"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {inv.status === "sent" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1.5 text-xs text-green-700 border-green-300 hover:bg-green-50"
                              onClick={() => markPaidMutation.mutate({ invoiceId: inv.id })}
                              disabled={markPaidMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3" />
                              Mark Paid
                            </Button>
                          )}
                          {(inv.status === "sent" || inv.status === "paid") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1.5 text-xs"
                              onClick={() => resendMutation.mutate({ invoiceId: inv.id })}
                              disabled={resendMutation.isPending}
                              title="Resend this invoice to the client"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Resend
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1.5 text-xs"
                            onClick={() => setViewingInvoiceId(inv.id)}
                          >
                            {inv.status === "draft" ? (
                              <><Send className="h-3 w-3" />Edit / Send</>
                            ) : (
                              <><Eye className="h-3 w-3" />View</>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View / Edit existing invoice */}
      {viewingInvoiceId && (
        <InvoiceModal
          open={!!viewingInvoiceId}
          onOpenChange={(o) => !o && setViewingInvoiceId(null)}
          clientId={0}
          clientName=""
          existingInvoiceId={viewingInvoiceId}
        />
      )}

      {/* Create new PAYG invoice */}
      <InvoiceModal
        open={showPAYGModal}
        onOpenChange={setShowPAYGModal}
        clientId={0}
        clientName=""
      />
    </div>
  );
}
