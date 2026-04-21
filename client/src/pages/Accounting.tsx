import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, BarChart3, CheckCircle, ChevronLeft, ChevronRight, Download, Package, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

const LUKE_EMAIL = "luke@nuperformancecoaching.com";

function formatHKD(amount: number) {
  return `HKD ${amount.toLocaleString("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Hong_Kong", day: "numeric", month: "short", year: "numeric" });
}

function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { timeZone: "Asia/Hong_Kong", month: "long", year: "numeric" });
}

function prevMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Taxman Report Tab ─────────────────────────────────────────────────────────

function TaxmanReport() {
  const now = new Date();
  const firstOfYear = `${now.getFullYear()}-01-01`;
  const today = now.toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(firstOfYear);
  const [endDate, setEndDate] = useState(today);
  const [serviceFilter, setServiceFilter] = useState("_all");
  const [queryParams, setQueryParams] = useState({ startDate: firstOfYear, endDate: today, serviceType: "_all" });

  const { data, isLoading, error } = trpc.accounting.taxmanReport.useQuery({
    startDate: queryParams.startDate,
    endDate: queryParams.endDate,
    serviceType: queryParams.serviceType === "_all" ? undefined : queryParams.serviceType,
  });

  const { data: serviceTypes, isLoading: serviceTypesLoading, error: serviceTypesError } = trpc.invoices.listServiceTypes.useQuery();

  const handleRun = () => {
    setQueryParams({ startDate, endDate, serviceType: serviceFilter });
  };

  const handleExportCSV = () => {
    if (!data?.rows.length) return;
    const header = "Date,Client,Service Type,Gross (HKD),Discount (HKD),Net (HKD),Reference";
    const rows = data.rows.map((r) =>
      [
        formatDate(r.date),
        r.clientName,
        r.serviceType,
        r.grossAmount.toFixed(2),
        r.discountApplied.toFixed(2),
        r.netAmount.toFixed(2),
        r.invoiceNumber ?? `Session #${r.sessionId}`,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taxman-report-${queryParams.startDate}-to-${queryParams.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date Range & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <Label>Service Type (optional)</Label>
              {serviceTypesError ? (
                <p className="text-red-500 text-sm">Error loading service types</p>
              ) : (
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All services" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All services</SelectItem>
                    {serviceTypes && serviceTypes.length > 0 ? (
                      serviceTypes.map((st) => (
                        <SelectItem key={st.id} value={st.name}>{st.name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="_none" disabled>No service types available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button onClick={handleRun} style={{ backgroundColor: "#578DB3" }} className="hover:opacity-90">
              Run Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-500 text-sm">Error: {error.message}</p>}
      {data && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Gross Revenue</p>
                <p className="text-2xl font-bold mt-1">{formatHKD(data.totals.grossAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Discounts</p>
                <p className="text-2xl font-bold mt-1 text-amber-600">{formatHKD(data.totals.discountApplied)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Net Revenue</p>
                <p className="text-2xl font-bold mt-1 text-green-700">{formatHKD(data.totals.netAmount)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{data.rows.length} transaction{data.rows.length !== 1 ? "s" : ""}</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!data.rows.length}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {data.rows.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No revenue found for this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-3 pr-4 font-medium">Date</th>
                        <th className="pb-3 pr-4 font-medium">Client</th>
                        <th className="pb-3 pr-4 font-medium">Service Type</th>
                        <th className="pb-3 pr-4 font-medium text-right">Gross</th>
                        <th className="pb-3 pr-4 font-medium text-right">Discount</th>
                        <th className="pb-3 pr-4 font-medium text-right">Net</th>
                        <th className="pb-3 font-medium">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 pr-4 whitespace-nowrap">{formatDate(row.date)}</td>
                          <td className="py-3 pr-4">{row.clientName}</td>
                          <td className="py-3 pr-4">{row.serviceType}</td>
                          <td className="py-3 pr-4 text-right">{row.grossAmount.toFixed(2)}</td>
                          <td className="py-3 pr-4 text-right text-amber-600">
                            {row.discountApplied > 0 ? row.discountApplied.toFixed(2) : "—"}
                          </td>
                          <td className="py-3 pr-4 text-right font-medium">{row.netAmount.toFixed(2)}</td>
                          <td className="py-3 text-gray-500 text-xs">
                            {row.invoiceNumber ?? (row.sessionId ? `Session #${row.sessionId}` : "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold">
                        <td colSpan={3} className="pt-3 pr-4">Total</td>
                        <td className="pt-3 pr-4 text-right">{data.totals.grossAmount.toFixed(2)}</td>
                        <td className="pt-3 pr-4 text-right text-amber-600">
                          {data.totals.discountApplied > 0 ? data.totals.discountApplied.toFixed(2) : "—"}
                        </td>
                        <td className="pt-3 pr-4 text-right text-green-700">{data.totals.netAmount.toFixed(2)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Monthly Overview Tab ──────────────────────────────────────────────────────

const COST_CATEGORIES = ["Rent", "Software Subscriptions", "Insurance", "Equipment", "Marketing", "Other"] as const;

function MonthlyOverview() {
  const [month, setMonth] = useState(currentMonthStr());
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.accounting.monthlyOverview.useQuery({ month });

  const [newCategory, setNewCategory] = useState<typeof COST_CATEGORIES[number]>("Other");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newRecurring, setNewRecurring] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const addCostMutation = trpc.accounting.addCost.useMutation({
    onSuccess: () => {
      toast.success("Cost added");
      utils.accounting.monthlyOverview.invalidate();
      setIsAddOpen(false);
      setNewDescription("");
      setNewAmount("");
      setNewRecurring(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCostMutation = trpc.accounting.updateCost.useMutation({
    onSuccess: () => utils.accounting.monthlyOverview.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const deleteCostMutation = trpc.accounting.deleteCost.useMutation({
    onSuccess: () => {
      toast.success("Cost removed");
      utils.accounting.monthlyOverview.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmMutation = trpc.accounting.confirmMonth.useMutation({
    onSuccess: () => {
      toast.success("Month confirmed");
      utils.accounting.monthlyOverview.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAddCost = () => {
    const amount = parseFloat(newAmount);
    if (!newDescription.trim()) { toast.error("Please enter a description"); return; }
    if (isNaN(amount) || amount < 0) { toast.error("Please enter a valid amount"); return; }
    addCostMutation.mutate({ month, category: newCategory, description: newDescription, amount, isRecurring: newRecurring });
  };

  const isCurrentMonth = month === currentMonthStr();

  return (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setMonth(prevMonth(month))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold min-w-[200px] text-center">{monthLabel(month)}</h2>
        <Button variant="outline" size="icon" onClick={() => setMonth(nextMonth(month))} disabled={isCurrentMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading && <p className="text-gray-500 text-sm">Loading...</p>}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Revenue</p>
                <p className="text-2xl font-bold mt-1 text-green-700">{formatHKD(data.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Costs</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{formatHKD(data.totalCosts)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Net Profit</p>
                <p className={`text-2xl font-bold mt-1 ${data.netProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {formatHKD(data.netProfit)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Costs table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Business Costs
                {data.isConfirmed && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" /> Confirmed
                  </Badge>
                )}
              </CardTitle>
              <div className="flex gap-2">
                {!data.isConfirmed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => confirmMutation.mutate({ month })}
                    disabled={confirmMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Month
                  </Button>
                )}
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" style={{ backgroundColor: "#578DB3" }} className="hover:opacity-90">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Cost
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Cost — {monthLabel(month)}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div>
                        <Label>Category</Label>
                        <Select value={newCategory} onValueChange={(v) => setNewCategory(v as any)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COST_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="e.g. Monthly gym rent" />
                      </div>
                      <div>
                        <Label>Amount (HKD)</Label>
                        <Input type="number" min="0" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0.00" />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="recurring" checked={newRecurring} onChange={(e) => setNewRecurring(e.target.checked)} className="h-4 w-4" />
                        <Label htmlFor="recurring">Recurring (auto-populate next month)</Label>
                      </div>
                      <Button onClick={handleAddCost} disabled={addCostMutation.isPending} className="w-full" style={{ backgroundColor: "#578DB3" }}>
                        Add Cost
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {data.costs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No costs recorded for this month.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-3 pr-4 font-medium">Category</th>
                        <th className="pb-3 pr-4 font-medium">Description</th>
                        <th className="pb-3 pr-4 font-medium text-right">Amount (HKD)</th>
                        <th className="pb-3 pr-4 font-medium">Recurring</th>
                        <th className="pb-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.costs.map((cost: any) => (
                        <tr key={cost.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 pr-4">
                            <Badge variant="outline">{cost.category}</Badge>
                          </td>
                          <td className="py-3 pr-4">{cost.description}</td>
                          <td className="py-3 pr-4 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={parseFloat(String(cost.amount)).toFixed(2)}
                              className="w-28 text-right border rounded px-2 py-1 text-sm"
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val !== parseFloat(String(cost.amount))) {
                                  updateCostMutation.mutate({ id: cost.id, amount: val });
                                }
                              }}
                            />
                          </td>
                          <td className="py-3 pr-4">
                            {cost.isRecurring ? <Badge variant="secondary">Yes</Badge> : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              onClick={() => deleteCostMutation.mutate({ id: cost.id })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold">
                        <td colSpan={2} className="pt-3 pr-4">Total Costs</td>
                        <td className="pt-3 pr-4 text-right text-red-600">{data.totalCosts.toFixed(2)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Remaining Packages Tab ────────────────────────────────────────────────────

function RemainingPackages() {
  const { data, isLoading } = trpc.accounting.remainingPackages.useQuery();

  const totalValueRemaining = useMemo(
    () => data?.reduce((s, r) => s + r.valueRemaining, 0) ?? 0,
    [data]
  );

  return (
    <div className="space-y-6">
      {isLoading && <p className="text-gray-500 text-sm">Loading...</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Active Packages</p>
                <p className="text-2xl font-bold mt-1">{data.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Value Remaining</p>
                <p className="text-2xl font-bold mt-1 text-blue-700">{formatHKD(totalValueRemaining)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Remaining Packages</CardTitle>
            </CardHeader>
            <CardContent>
              {data.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No active packages.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-3 pr-4 font-medium">Client</th>
                        <th className="pb-3 pr-4 font-medium">Package</th>
                        <th className="pb-3 pr-4 font-medium text-center">Used / Total</th>
                        <th className="pb-3 pr-4 font-medium text-center">Remaining</th>
                        <th className="pb-3 pr-4 font-medium text-right">Rate / Session</th>
                        <th className="pb-3 pr-4 font-medium text-right">Value Remaining</th>
                        <th className="pb-3 font-medium">Expiry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row) => {
                        const isExpiringSoon =
                          row.expiryDate &&
                          new Date(row.expiryDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
                        return (
                          <tr key={row.packageId} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-3 pr-4 font-medium">{row.clientName}</td>
                            <td className="py-3 pr-4">{row.packageType}</td>
                            <td className="py-3 pr-4 text-center">
                              {row.sessionsUsed} / {row.sessionsTotal}
                            </td>
                            <td className="py-3 pr-4 text-center">
                              <Badge
                                variant={row.sessionsRemaining <= 2 ? "destructive" : row.sessionsRemaining <= 5 ? "default" : "secondary"}
                              >
                                {row.sessionsRemaining}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4 text-right">
                              {row.pricePerSession > 0 ? formatHKD(row.pricePerSession) : "—"}
                            </td>
                            <td className="py-3 pr-4 text-right font-medium">
                              {row.valueRemaining > 0 ? formatHKD(row.valueRemaining) : "—"}
                            </td>
                            <td className="py-3">
                              {row.expiryDate ? (
                                <span className={isExpiringSoon ? "text-red-600 font-medium" : ""}>
                                  {formatDate(row.expiryDate)}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Main Accounting Page ──────────────────────────────────────────────────────

export default function Accounting() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
      </div>
    );
  }

  if (!user || user.email !== LUKE_EMAIL) {
    setLocation("/trainer");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/nu-logo.png" alt="Nu Performance" className="h-12 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            <Link href="/trainer">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Accounting</h1>
          </div>

          <Tabs defaultValue="taxman">
            <TabsList className="mb-6">
              <TabsTrigger value="taxman">Taxman Report</TabsTrigger>
              <TabsTrigger value="monthly">Monthly Overview</TabsTrigger>
              <TabsTrigger value="packages">Remaining Packages</TabsTrigger>
            </TabsList>

            <TabsContent value="taxman">
              <TaxmanReport />
            </TabsContent>
            <TabsContent value="monthly">
              <MonthlyOverview />
            </TabsContent>
            <TabsContent value="packages">
              <RemainingPackages />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
