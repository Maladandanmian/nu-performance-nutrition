import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Bell,
  LogOut,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Check,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { NotificationBell } from "@/components/NotificationBell";

export default function TrainerNotifications() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();

  const utils = trpc.useUtils();

  // Fetch notifications
  const { data: allNotifications = [] } = trpc.notifications.getAll.useQuery({
    limit: 100,
  });

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } =
    trpc.notifications.getSettings.useQuery();

  const [nutritionDeviationEnabled, setNutritionDeviationEnabled] = useState(
    settings?.nutritionDeviationEnabled ?? true
  );
  const [nutritionDeviationThreshold, setNutritionDeviationThreshold] = useState(
    settings?.nutritionDeviationThreshold ?? 20
  );
  const [nutritionDeviationDays, setNutritionDeviationDays] = useState(
    settings?.nutritionDeviationDays ?? 5
  );
  const [wellnessAlertsEnabled, setWellnessAlertsEnabled] = useState(
    settings?.wellnessAlertsEnabled ?? true
  );
  const [wellnessPoorScoreThreshold, setWellnessPoorScoreThreshold] = useState(
    settings?.wellnessPoorScoreThreshold ?? 2
  );
  const [wellnessPoorScoreDays, setWellnessPoorScoreDays] = useState(
    settings?.wellnessPoorScoreDays ?? 5
  );

  // Update state when settings load
  useState(() => {
    if (settings) {
      setNutritionDeviationEnabled(settings.nutritionDeviationEnabled);
      setNutritionDeviationThreshold(settings.nutritionDeviationThreshold);
      setNutritionDeviationDays(settings.nutritionDeviationDays);
      setWellnessAlertsEnabled(settings.wellnessAlertsEnabled);
      setWellnessPoorScoreThreshold(settings.wellnessPoorScoreThreshold);
      setWellnessPoorScoreDays(settings.wellnessPoorScoreDays);
    }
  });

  // Mutations
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getAll.invalidate();
      utils.notifications.getUnread.invalidate();
    },
  });

  const dismissMutation = trpc.notifications.dismiss.useMutation({
    onSuccess: () => {
      utils.notifications.getAll.invalidate();
      utils.notifications.getUnread.invalidate();
      toast.success("Notification dismissed");
    },
  });

  const updateSettingsMutation = trpc.notifications.updateSettings.useMutation({
    onSuccess: () => {
      utils.notifications.getSettings.invalidate();
      toast.success("Settings saved successfully");
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  const checkAllClientsMutation = trpc.notifications.checkAllClients.useMutation({
    onSuccess: () => {
      utils.notifications.getAll.invalidate();
      utils.notifications.getUnread.invalidate();
      toast.success("Pattern check completed");
    },
    onError: (error) => {
      toast.error(`Failed to check patterns: ${error.message}`);
    },
  });

  const handleLogout = async () => {
    await logout();
    window.location.href = getLoginUrl();
  };

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      nutritionDeviationEnabled,
      nutritionDeviationThreshold,
      nutritionDeviationDays,
      wellnessAlertsEnabled,
      wellnessPoorScoreThreshold,
      wellnessPoorScoreDays,
    });
  };

  const handleNotificationClick = async (notificationId: number, clientId: number) => {
    await markAsReadMutation.mutateAsync({ notificationId });
    setLocation(`/trainer/client/${clientId}`);
  };

  const handleDismiss = async (notificationId: number) => {
    await dismissMutation.mutateAsync({ notificationId });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "border-l-4 border-l-red-500";
      case "warning":
        return "border-l-4 border-l-yellow-500";
      default:
        return "border-l-4 border-l-blue-500";
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  };

  // Redirect non-authenticated users
  if (!loading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  // Redirect non-trainers
  if (user && user.role !== "admin") {
    setLocation("/client");
    return null;
  }

  if (loading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const unreadNotifications = allNotifications.filter((n) => !n.isRead && !n.isDismissed);
  const readNotifications = allNotifications.filter((n) => n.isRead || n.isDismissed);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/nu-logo.png" alt="Nu Performance" className="h-12 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <span className="text-sm" style={{ color: "#6F6E70" }}>
              {user?.name}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              style={{ borderColor: "#578DB3", color: "#578DB3" }}
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
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/trainer")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <h1 className="text-3xl font-bold mb-2">Notifications</h1>
          <p className="text-gray-600 mb-6">
            Manage your client alerts and notification preferences
          </p>

          <Tabs defaultValue="notifications" className="space-y-6">
            <TabsList>
              <TabsTrigger value="notifications">
                Notifications
                {unreadNotifications.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {unreadNotifications.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">All Notifications</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => checkAllClientsMutation.mutate()}
                  disabled={checkAllClientsMutation.isPending}
                >
                  {checkAllClientsMutation.isPending ? "Checking..." : "Check Now"}
                </Button>
              </div>

              {allNotifications.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Bell className="h-16 w-16 text-gray-300 mb-4" />
                    <p className="text-gray-500">No notifications yet</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Unread Notifications */}
                  {unreadNotifications.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase">Unread</h3>
                      {unreadNotifications.map((notification) => (
                        <Card
                          key={notification.id}
                          className={`cursor-pointer hover:bg-accent/50 transition-colors ${getSeverityColor(
                            notification.severity
                          )}`}
                          onClick={() =>
                            handleNotificationClick(notification.id, notification.clientId)
                          }
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">{getSeverityIcon(notification.severity)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <h4 className="font-semibold">{notification.title}</h4>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markAsReadMutation.mutate({
                                          notificationId: notification.id,
                                        });
                                      }}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDismiss(notification.id);
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground">{notification.message}</p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  {formatTimeAgo(notification.createdAt)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Read Notifications */}
                  {readNotifications.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase">Read</h3>
                      {readNotifications.map((notification) => (
                        <Card
                          key={notification.id}
                          className={`opacity-60 cursor-pointer hover:opacity-100 transition-opacity ${getSeverityColor(
                            notification.severity
                          )}`}
                          onClick={() =>
                            handleNotificationClick(notification.id, notification.clientId)
                          }
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">{getSeverityIcon(notification.severity)}</div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold">{notification.title}</h4>
                                <p className="text-sm text-muted-foreground">{notification.message}</p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  {formatTimeAgo(notification.createdAt)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Nutrition Deviation Alerts</CardTitle>
                  <CardDescription>
                    Get notified when clients consistently deviate from their nutrition targets
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="nutrition-enabled">Enable nutrition deviation alerts</Label>
                    <Switch
                      id="nutrition-enabled"
                      checked={nutritionDeviationEnabled}
                      onCheckedChange={setNutritionDeviationEnabled}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="nutrition-threshold">
                      Deviation threshold (%)
                      <span className="text-sm text-muted-foreground ml-2">
                        Alert when {nutritionDeviationThreshold}% above/below target
                      </span>
                    </Label>
                    <Input
                      id="nutrition-threshold"
                      type="number"
                      min="10"
                      max="100"
                      value={nutritionDeviationThreshold}
                      onChange={(e) => setNutritionDeviationThreshold(Number(e.target.value))}
                      disabled={!nutritionDeviationEnabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nutrition-days">
                      Consecutive days
                      <span className="text-sm text-muted-foreground ml-2">
                        Alert after {nutritionDeviationDays} consecutive days
                      </span>
                    </Label>
                    <Input
                      id="nutrition-days"
                      type="number"
                      min="1"
                      max="30"
                      value={nutritionDeviationDays}
                      onChange={(e) => setNutritionDeviationDays(Number(e.target.value))}
                      disabled={!nutritionDeviationEnabled}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Wellness Questionnaire Alerts</CardTitle>
                  <CardDescription>
                    Get notified when clients report consistently poor wellness scores
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="wellness-enabled">Enable wellness alerts</Label>
                    <Switch
                      id="wellness-enabled"
                      checked={wellnessAlertsEnabled}
                      onCheckedChange={setWellnessAlertsEnabled}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="wellness-threshold">
                      Poor score threshold (1-5 scale)
                      <span className="text-sm text-muted-foreground ml-2">
                        Alert when score is {wellnessPoorScoreThreshold} or below
                      </span>
                    </Label>
                    <Input
                      id="wellness-threshold"
                      type="number"
                      min="1"
                      max="4"
                      value={wellnessPoorScoreThreshold}
                      onChange={(e) => setWellnessPoorScoreThreshold(Number(e.target.value))}
                      disabled={!wellnessAlertsEnabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wellness-days">
                      Consecutive days
                      <span className="text-sm text-muted-foreground ml-2">
                        Alert after {wellnessPoorScoreDays} consecutive days
                      </span>
                    </Label>
                    <Input
                      id="wellness-days"
                      type="number"
                      min="1"
                      max="30"
                      value={wellnessPoorScoreDays}
                      onChange={(e) => setWellnessPoorScoreDays(Number(e.target.value))}
                      disabled={!wellnessAlertsEnabled}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                  style={{ backgroundColor: "#578DB3" }}
                  className="hover:opacity-90"
                >
                  {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
