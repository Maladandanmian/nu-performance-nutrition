import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { Activity, TrendingUp, Users, Lock, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useClientAuth } from "@/hooks/useClientAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { setClientSessionInStorage, clearClientSessionFromStorage } from "@/lib/clientSession";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const { clientSession, loading: clientLoading } = useClientAuth();
  const [, setLocation] = useLocation();
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const utils = trpc.useUtils();
  const loginWithPINMutation = trpc.auth.loginWithPIN.useMutation({
    onSuccess: async (data) => {
      // Store session token in localStorage as fallback for cookies
      if (data.sessionToken) {
        setClientSessionInStorage(data.sessionToken);
        console.log('[Home] Stored session token in localStorage');
      }
      toast.success("Login successful! Redirecting...");
      // Use window.location to ensure proper redirect with cookie
      setTimeout(() => {
        window.location.href = '/client';
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message || "Invalid PIN");
    },
  });

  const loginWithEmailMutation = trpc.emailAuth.loginWithEmail.useMutation({
    onSuccess: async (data) => {
      if (data.sessionToken) {
        setClientSessionInStorage(data.sessionToken);
        console.log('[Home] Stored session token in localStorage');
      }
      toast.success("Login successful! Redirecting...");
      setTimeout(() => {
        window.location.href = '/client';
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message || "Invalid email or password");
    },
  });

  // Redirect authenticated trainers to their dashboard
  // Clients can stay on home page to see login screen
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') {
        setLocation('/trainer');
      }
      // Don't auto-redirect regular users, let them use the page
    }
    // Don't auto-redirect client sessions either
  }, [isAuthenticated, user, setLocation]);

  const handlePINLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) {
      toast.error("PIN must be 6 digits");
      return;
    }
    await loginWithPINMutation.mutateAsync({ pin });
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    await loginWithEmailMutation.mutateAsync({ email, password });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{background: 'linear-gradient(135deg, #86BBD8 0%, #578DB3 100%)'}}>
      {/* Header */}
      <header className="bg-white/95 backdrop-blur shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => setLocation('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <img src="/nu-logo.png" alt="Nu Performance" className="h-12 w-auto" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="bg-white rounded-full px-12 py-4 shadow-lg">
              <img src="/nu-logo.png" alt="Nu Performance" className="h-32 w-auto" />
            </div>
          </div>
          <p className="text-lg max-w-2xl mx-auto" style={{color: '#FFFFFF', opacity: 0.95}}>
            AI-powered nutrition tracking for elite performance
          </p>
        </div>

        {/* Login Sections - Two Column Layout */}
        {/* Show logout option if already logged in */}
        {(isAuthenticated || clientSession) && (
          <div className="max-w-2xl mx-auto mb-8">
            <Card className="bg-white/95 backdrop-blur border-none shadow-lg">
              <CardContent className="p-6 text-center">
                <p className="text-lg mb-4" style={{color: '#2B2A2C'}}>
                  {clientSession ? `Logged in as ${clientSession.name}` : `Logged in as ${user?.name || 'Trainer'}`}
                </p>
                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={() => {
                      if (clientSession) {
                        setLocation('/client');
                      } else if (user?.role === 'admin') {
                        setLocation('/trainer');
                      }
                    }}
                    style={{backgroundColor: '#578DB3'}}
                  >
                    Go to Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm('Are you sure you want to log out and clear your session?')) {
                        // Clear localStorage session
                        clearClientSessionFromStorage();
                        // Clear all cookies
                        document.cookie.split(";").forEach((c) => {
                          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                        });
                        // Reload to clear state
                        window.location.href = '/';
                      }
                    }}
                  >
                    Switch User / Logout
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Always show login forms for easy access */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
            {/* Client Login - LEFT SIDE (Primary) */}
            <Card className="bg-white/95 backdrop-blur border-none shadow-2xl ring-4 ring-white/50">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-4 rounded-full" style={{backgroundColor: '#578DB3', width: 'fit-content'}}>
                  <Lock className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl" style={{color: '#2B2A2C'}}>Client Login</CardTitle>
                <CardDescription className="text-base" style={{color: '#6F6E70'}}>
                  Access your nutrition dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pin" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="pin" className="flex items-center gap-2">
                      <Lock className="h-4 w-4" /> PIN
                    </TabsTrigger>
                    <TabsTrigger value="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Email
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="pin">
                    <form onSubmit={handlePINLogin} className="space-y-4">
                      <div>
                        <Label htmlFor="pin" className="text-base" style={{color: '#2B2A2C'}}>PIN Code</Label>
                        <Input
                          id="pin"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          placeholder="000000"
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                          className="text-center text-3xl tracking-widest font-bold mt-2"
                          style={{borderColor: '#86BBD8', borderWidth: '2px'}}
                        />
                      </div>
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full hover:opacity-90 text-lg"
                        style={{backgroundColor: '#578DB3'}}
                        disabled={loginWithPINMutation.isPending || pin.length !== 6}
                      >
                        {loginWithPINMutation.isPending ? "Logging in..." : "Access Dashboard"}
                      </Button>
                    </form>
                  </TabsContent>
                  
                  <TabsContent value="email">
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div>
                        <Label htmlFor="email" className="text-base" style={{color: '#2B2A2C'}}>Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="mt-2"
                          style={{borderColor: '#86BBD8', borderWidth: '2px'}}
                        />
                      </div>
                      <div>
                        <Label htmlFor="password" className="text-base" style={{color: '#2B2A2C'}}>Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="mt-2"
                          style={{borderColor: '#86BBD8', borderWidth: '2px'}}
                        />
                      </div>
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full hover:opacity-90 text-lg"
                        style={{backgroundColor: '#578DB3'}}
                        disabled={loginWithEmailMutation.isPending || !email || !password}
                      >
                        {loginWithEmailMutation.isPending ? "Logging in..." : "Login with Email"}
                      </Button>
                      <p className="text-xs text-center" style={{color: '#6F6E70'}}>
                        Contact your trainer if you need to set up email login
                      </p>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Trainer OAuth Login - RIGHT SIDE (Secondary) */}
            <Card className="bg-white/90 backdrop-blur border-none shadow-xl">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-4 rounded-full" style={{backgroundColor: '#CE4C27', width: 'fit-content'}}>
                  <Users className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl" style={{color: '#2B2A2C'}}>Trainer Login</CardTitle>
                <CardDescription className="text-base" style={{color: '#6F6E70'}}>
                  Sign in to manage clients and track their progress
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div className="w-full p-3 rounded-lg" style={{backgroundColor: '#FFF3E0', borderLeft: '4px solid #CE4C27'}}>
                  <p className="text-sm font-medium" style={{color: '#CE4C27'}}>
                    ⚠️ Are you a client? Use the PIN login on the left instead.
                  </p>
                </div>
                <Button 
                  size="lg"
                  onClick={() => {
                    if (confirm('Are you a trainer? Click OK to continue to trainer login.\n\nIf you are a client, click Cancel and use the PIN login on the left.')) {
                      window.location.href = getLoginUrl();
                    }
                  }}
                  style={{backgroundColor: '#CE4C27'}}
                  className="w-full hover:opacity-90 text-lg"
                >
                  Sign In as Trainer
                </Button>
                <p className="text-sm text-center" style={{color: '#6F6E70'}}>
                  For gym trainers and nutrition coaches only
                </p>
              </CardContent>
            </Card>
          </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card className="bg-white/95 backdrop-blur border-none shadow-lg">
            <CardHeader>
              <Activity className="h-12 w-12 mb-4" style={{color: '#CE4C27'}} />
              <CardTitle style={{color: '#2B2A2C'}}>AI-Powered Analysis</CardTitle>
              <CardDescription style={{color: '#6F6E70'}}>
                Take a photo of your meal and get instant nutritional breakdown using advanced AI
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white/95 backdrop-blur border-none shadow-lg">
            <CardHeader>
              <TrendingUp className="h-12 w-12 mb-4" style={{color: '#CE4C27'}} />
              <CardTitle style={{color: '#2B2A2C'}}>Track Your Progress</CardTitle>
              <CardDescription style={{color: '#6F6E70'}}>
                Monitor calories, protein, carbs, fat, fiber, and hydration with beautiful charts
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white/95 backdrop-blur border-none shadow-lg">
            <CardHeader>
              <Users className="h-12 w-12 mb-4" style={{color: '#CE4C27'}} />
              <CardTitle style={{color: '#2B2A2C'}}>Trainer Dashboard</CardTitle>
              <CardDescription style={{color: '#6F6E70'}}>
                Trainers can manage clients, set nutrition goals, and track progress
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    </div>
  );
}
