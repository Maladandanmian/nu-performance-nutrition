import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { BarChart3, Calendar, CheckCircle2, Database, FileText, LogOut, Plus, RefreshCw, Trash2, Users, XCircle } from "lucide-react";
import { Link } from "wouter";
import { NotificationBell } from "@/components/NotificationBell";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function TrainerDashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");
  // Nutrition goals — required fields, no defaults pre-filled
  const [newCalories, setNewCalories] = useState("");
  const [newProtein, setNewProtein] = useState("");
  const [newFat, setNewFat] = useState("");
  const [newCarbs, setNewCarbs] = useState("");
  const [newFibre, setNewFibre] = useState("");
  const [newHydration, setNewHydration] = useState("");

  const utils = trpc.useUtils();
  const { data: clients, isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const { data: lastBackup, refetch: refetchBackup } = trpc.backup.getLastLog.useQuery();
  const runBackupMutation = trpc.backup.sendBackup.useMutation({
    onSuccess: () => {
      toast.success("Backup sent to Luke's email");
      refetchBackup();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Compute cooldown state: disable button if last backup was within the past 24 hours
  const backupCooldownState = useMemo(() => {
    // Only apply cooldown if the last backup SUCCEEDED.
    // A failed backup must never block the manual button.
    if (!lastBackup || lastBackup.status !== 'success') return { isOnCooldown: false, timeStr: '' };
    const lastBackupTime = new Date(lastBackup.createdAt).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - lastBackupTime;
    if (elapsed < oneDayMs) {
      const remaining = oneDayMs - elapsed;
      const hoursLeft = Math.floor(remaining / (60 * 60 * 1000));
      const minutesLeft = Math.ceil((remaining % (60 * 60 * 1000)) / 60000);
      const timeStr = hoursLeft > 0 ? `${hoursLeft}h ${minutesLeft}m` : `${minutesLeft}m`;
      return { isOnCooldown: true, timeStr };
    }
    return { isOnCooldown: false, timeStr: '' };
  }, [lastBackup]);
  const backupCooldownMinutesLeft = backupCooldownState.isOnCooldown ? 1 : 0; // For compatibility with existing code

  // Compute backup alert state: red button if last backup failed AND is older than 24 hours
  const backupAlertState = useMemo(() => {
    if (!lastBackup) return { isAlert: false, reason: '' };
    
    // Check if last backup failed
    if (lastBackup.status !== 'failed') return { isAlert: false, reason: '' };
    
    // Check if it's been more than 24 hours since the failed backup
    const lastBackupTime = new Date(lastBackup.createdAt).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - lastBackupTime;
    
    if (elapsed > oneDayMs) {
      const hoursSince = Math.floor(elapsed / (60 * 60 * 1000));
      return { 
        isAlert: true, 
        reason: `Backup failed ${hoursSince}h ago. Manual backup needed.` 
      };
    }
    
    return { isAlert: false, reason: '' };
  }, [lastBackup]);

  const createClientMutation = trpc.clients.create.useMutation({
    onSuccess: (data) => {
      const invitationStatus = data.invitationSent 
        ? "Password setup invitation sent to their email."
        : "Email not configured. Please manually share the password setup link.";
      
      toast.success(`Client added! ${invitationStatus}`, { duration: 10000 });
      utils.clients.list.invalidate();
      setIsAddClientOpen(false);
      setNewClientName("");
      setNewClientEmail("");
      setNewClientPhone("");
      setNewClientNotes("");
      setNewCalories("");
      setNewProtein("");
      setNewFat("");
      setNewCarbs("");
      setNewFibre("");
      setNewHydration("");
      
      // Show success message
      alert(`Client created successfully!\n\n${invitationStatus}`);
    },
    onError: (error) => {
      toast.error(`Failed to add client: ${error.message}`);
    },
  });

  const deleteClientMutation = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Client deleted successfully");
      utils.clients.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete client: ${error.message}`);
    },
  });

  const handleDeleteClient = (clientId: number, clientName: string) => {
    if (confirm(`Are you sure you want to delete ${clientName}? This action cannot be undone.`)) {
      deleteClientMutation.mutate({ clientId });
    }
  };

  // Redirect non-authenticated users
  if (!loading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  // Redirect non-trainers to client dashboard
  if (user && user.role !== 'admin') {
    setLocation('/client');
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const handleAddClient = async () => {
    if (!newClientName.trim()) {
      toast.error("Please enter a client name");
      return;
    }
    if (!newClientEmail.trim()) {
      toast.error("Please enter a client email");
      return;
    }
    const calories = parseInt(newCalories);
    const protein = parseInt(newProtein);
    const fat = parseInt(newFat);
    const carbs = parseInt(newCarbs);
    const fibre = parseInt(newFibre);
    const hydration = parseInt(newHydration);
    if (!newCalories || isNaN(calories) || calories < 1) {
      toast.error("Please enter a valid calories target");
      return;
    }
    if (!newProtein || isNaN(protein) || protein < 0) {
      toast.error("Please enter a valid protein target");
      return;
    }
    if (!newFat || isNaN(fat) || fat < 0) {
      toast.error("Please enter a valid fat target");
      return;
    }
    if (!newCarbs || isNaN(carbs) || carbs < 0) {
      toast.error("Please enter a valid carbs target");
      return;
    }
    if (!newFibre || isNaN(fibre) || fibre < 0) {
      toast.error("Please enter a valid fibre target");
      return;
    }
    if (!newHydration || isNaN(hydration) || hydration < 0) {
      toast.error("Please enter a valid hydration target");
      return;
    }
    createClientMutation.mutate({
      name: newClientName,
      email: newClientEmail,
      phone: newClientPhone || undefined,
      notes: newClientNotes || undefined,
      caloriesTarget: calories,
      proteinTarget: protein,
      fatTarget: fat,
      carbsTarget: carbs,
      fibreTarget: fibre,
      hydrationTarget: hydration,
    });
  };

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/nu-logo.png" alt="Nu Performance" className="h-12 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            <Link href="/trainer/schedule">
              <Button
                variant="ghost"
                size="sm"
                className="text-sm font-medium"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Button>
            </Link>
            <Link href="/trainer/invoices">
              <Button
                variant="ghost"
                size="sm"
                className="text-sm font-medium"
              >
                <FileText className="h-4 w-4 mr-2" />
                Invoices
              </Button>
            </Link>
            {user?.email === "luke@nuperformancecoaching.com" && (
              <Link href="/trainer/accounting">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sm font-medium"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Accounting
                </Button>
              </Link>
            )}
            <NotificationBell />
            <span className="text-sm" style={{color: '#6F6E70'}}>{user?.name}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              style={{borderColor: '#578DB3', color: '#578DB3'}}
              className="hover:bg-blue-50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header with Add Client Button */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">My Clients</h2>
              <p className="text-gray-600">Manage your clients and their nutrition goals</p>
            </div>
            <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
              <DialogTrigger asChild>
                <Button style={{backgroundColor: '#578DB3'}} className="hover:opacity-90">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Client</DialogTitle>
                  <DialogDescription>
                    All fields marked * are required. Nutrition goals must be set before the client can be created.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  <div>
                    <Label htmlFor="client-name">Name *</Label>
                    <Input
                      id="client-name"
                      placeholder="Client name"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="client-email">Email *</Label>
                    <Input
                      id="client-email"
                      type="email"
                      placeholder="client@example.com"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">Client will receive an invitation to set their password</p>
                  </div>
                  <div>
                    <Label htmlFor="client-phone">Phone</Label>
                    <Input
                      id="client-phone"
                      placeholder="+852 1234 5678"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="client-notes">Notes</Label>
                    <Textarea
                      id="client-notes"
                      placeholder="Any additional notes..."
                      value={newClientNotes}
                      onChange={(e) => setNewClientNotes(e.target.value)}
                    />
                  </div>

                  {/* Nutrition Goals — required */}
                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold text-gray-800 mb-3">Nutrition Goals *</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="goal-calories">Calories (kcal) *</Label>
                        <Input
                          id="goal-calories"
                          type="number"
                          min="1"
                          placeholder="e.g. 2200"
                          value={newCalories}
                          onChange={(e) => setNewCalories(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="goal-protein">Protein (g) *</Label>
                        <Input
                          id="goal-protein"
                          type="number"
                          min="0"
                          placeholder="e.g. 160"
                          value={newProtein}
                          onChange={(e) => setNewProtein(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="goal-fat">Fat (g) *</Label>
                        <Input
                          id="goal-fat"
                          type="number"
                          min="0"
                          placeholder="e.g. 70"
                          value={newFat}
                          onChange={(e) => setNewFat(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="goal-carbs">Carbs (g) *</Label>
                        <Input
                          id="goal-carbs"
                          type="number"
                          min="0"
                          placeholder="e.g. 250"
                          value={newCarbs}
                          onChange={(e) => setNewCarbs(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="goal-fibre">Fibre (g) *</Label>
                        <Input
                          id="goal-fibre"
                          type="number"
                          min="0"
                          placeholder="e.g. 30"
                          value={newFibre}
                          onChange={(e) => setNewFibre(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="goal-hydration">Hydration (ml) *</Label>
                        <Input
                          id="goal-hydration"
                          type="number"
                          min="0"
                          placeholder="e.g. 2500"
                          value={newHydration}
                          onChange={(e) => setNewHydration(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={handleAddClient} 
                    className="w-full"
                    disabled={createClientMutation.isPending}
                  >
                    {createClientMutation.isPending ? "Adding..." : "Add Client"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Backup Status Row */}
          <div className="mb-6 rounded-lg border bg-white px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Database Backup</p>
                {lastBackup ? (
                  <p className="text-xs text-gray-500">
                    {lastBackup.status === 'success' ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Last backup {new Date(lastBackup.createdAt).toLocaleString()} &mdash; {lastBackup.fileSizeKB ? `${lastBackup.fileSizeKB} KB` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-red-500" />
                        Last attempt failed &mdash; {new Date(lastBackup.createdAt).toLocaleString()}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">No backup on record yet. Runs daily at 11:59 PM HKT.</p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runBackupMutation.mutate({ recipientEmail: 'lukusdavey@gmail.com' })}
              disabled={runBackupMutation.isPending || backupCooldownState.isOnCooldown}
              className={`shrink-0 text-xs ${
                backupAlertState.isAlert 
                  ? 'border-red-500 text-white bg-red-600 hover:bg-red-700' 
                  : ''
              }`}
              title={backupAlertState.isAlert ? backupAlertState.reason : backupCooldownState.isOnCooldown ? `Next backup available in ${backupCooldownState.timeStr}` : undefined}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${runBackupMutation.isPending ? 'animate-spin' : ''}`} />
              {runBackupMutation.isPending ? 'Running...' : backupAlertState.isAlert ? '⚠️ Backup Overdue' : backupCooldownState.isOnCooldown ? `Available in ${backupCooldownState.timeStr}` : 'Run Backup Now'}
            </Button>
          </div>

          {/* Clients List */}
          {clientsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading clients...</p>
            </div>
          ) : clients && clients.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clients.map((client) => (
                <Card key={client.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-green-600" />
                      {client.name}
                    </CardTitle>
                    <CardDescription>
                      {client.email || "No email provided"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {client.phone && (
                      <p className="text-sm text-gray-600 mb-2">📱 {client.phone}</p>
                    )}
                    {client.notes && (
                      <p className="text-sm text-gray-600 mb-4">{client.notes}</p>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => setLocation(`/trainer/client/${client.id}`)}
                      >
                        View Details
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleDeleteClient(client.id, client.name)}
                        style={{borderColor: '#CE4C27', color: '#CE4C27'}}
                        className="hover:bg-red-50"
                      >
                        🗑️
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No clients yet</h3>
                <p className="text-gray-600 mb-4">Get started by adding your first client</p>
                <Button onClick={() => setIsAddClientOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Client
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
