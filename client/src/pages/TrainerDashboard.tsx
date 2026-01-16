import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { LogOut, Plus, Users } from "lucide-react";
import { useState } from "react";
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
  const [newClientPin, setNewClientPin] = useState("");

  const utils = trpc.useUtils();
  const { data: clients, isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const createClientMutation = trpc.clients.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Client added! PIN: ${data.pin}`, { duration: 10000 });
      utils.clients.list.invalidate();
      setIsAddClientOpen(false);
      setNewClientName("");
      setNewClientEmail("");
      setNewClientPhone("");
      setNewClientNotes("");
      setNewClientPin("");
      
      // Show PIN in alert as well
      alert(`Client created successfully!\n\nClient PIN: ${data.pin}\n\nPlease share this PIN with your client. They will use it to log in.`);
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

    if (!newClientPin.trim() || newClientPin.length !== 6 || !/^\d{6}$/.test(newClientPin)) {
      toast.error("Please enter a valid 6-digit PIN");
      return;
    }

    createClientMutation.mutate({
      name: newClientName,
      email: newClientEmail || undefined,
      phone: newClientPhone || undefined,
      notes: newClientNotes || undefined,
      pin: newClientPin,
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
                    Create a new client profile with default nutrition goals
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
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
                    <Label htmlFor="client-pin">PIN Code *</Label>
                    <Input
                      id="client-pin"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="Enter 6-digit PIN"
                      value={newClientPin}
                      onChange={(e) => setNewClientPin(e.target.value.replace(/\D/g, ''))}
                      className="text-center text-xl tracking-widest"
                    />
                    <p className="text-xs text-gray-500 mt-1">This PIN will be used by the client to log in</p>
                  </div>
                  <div>
                    <Label htmlFor="client-email">Email</Label>
                    <Input
                      id="client-email"
                      type="email"
                      placeholder="client@example.com"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                    />
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
