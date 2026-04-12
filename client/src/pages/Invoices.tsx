import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceModal } from "@/components/InvoiceModal";
import { FileText, Search, Send, Eye } from "lucide-react";

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

export default function Invoices() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [viewingInvoiceId, setViewingInvoiceId] = useState<number | null>(null);

  const { data: invoices = [], isLoading } = trpc.invoices.listByTrainer.useQuery(undefined, {
    enabled: !!user,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All invoices generated from client packages
          </p>
        </div>
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
              {search ? "No invoices match your search." : "No invoices yet. Generate one from a client package."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Invoice #</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Due</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Total</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sent</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 font-medium">{inv.invoiceNumber}</td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {inv.dueDate
                          ? new Date(inv.dueDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })
                          : "—"}
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
                        {inv.sentAt
                          ? new Date(inv.sentAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })
                          : "—"}
                      </td>
                      <td className="py-3 px-3 text-right">
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
          clientId={0} // Not needed when editing existing invoice
          clientName=""
          existingInvoiceId={viewingInvoiceId}
        />
      )}
    </div>
  );
}
