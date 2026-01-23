import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { MealHistoryFeed } from "@/components/MealHistoryFeed";
import { MealEditDialog } from "@/components/MealEditDialog";
import { NutrientTrendGraphs } from "@/components/NutrientTrendGraphs";
import { ArrowLeft, Edit, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ClientDetail() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/trainer/client/:id");
  const clientId = params?.id ? parseInt(params.id) : null;

  const [isEditGoalsOpen, setIsEditGoalsOpen] = useState(false);
  const [caloriesTarget, setCaloriesTarget] = useState("");
  const [proteinTarget, setProteinTarget] = useState("");
  const [fatTarget, setFatTarget] = useState("");
  const [carbsTarget, setCarbsTarget] = useState("");
  const [fibreTarget, setFibreTarget] = useState("");
  const [hydrationTarget, setHydrationTarget] = useState("");
  const [weightTarget, setWeightTarget] = useState("");
  const [timeRange, setTimeRange] = useState<"today" | "7days" | "30days" | "all">("30days");
  const [editingMeal, setEditingMeal] = useState<any | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const utils = trpc.useUtils();
  const { data: client } = trpc.clients.get.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId }
  );
  const { data: goals } = trpc.nutritionGoals.get.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId }
  );
  const { data: meals } = trpc.meals.list.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId }
  );
  const { data: bodyMetrics } = trpc.bodyMetrics.list.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId }
  );

  const updateGoalsMutation = trpc.nutritionGoals.update.useMutation({
    onSuccess: () => {
      toast.success("Nutrition goals updated");
      utils.nutritionGoals.get.invalidate({ clientId: clientId! });
      setIsEditGoalsOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to update goals: ${error.message}`);
    },
  });

  const deleteMealMutation = trpc.meals.delete.useMutation({
    onSuccess: () => {
      toast.success("Meal deleted successfully!");
      utils.meals.list.invalidate({ clientId: clientId! });
    },
    onError: (error) => {
      toast.error(`Failed to delete meal: ${error.message}`);
    },
  });

  // Redirect non-authenticated users
  if (!loading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  // Redirect non-trainers
  if (user && user.role !== 'admin') {
    setLocation('/client');
    return null;
  }

  if (loading || !client || !goals) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const handleEditGoals = () => {
    setCaloriesTarget(goals.caloriesTarget.toString());
    setProteinTarget(goals.proteinTarget.toString());
    setFatTarget(goals.fatTarget.toString());
    setCarbsTarget(goals.carbsTarget.toString());
    setFibreTarget(goals.fibreTarget.toString());
    setHydrationTarget(goals.hydrationTarget.toString());
    setWeightTarget(goals.weightTarget ? goals.weightTarget.toString() : "");
    setIsEditGoalsOpen(true);
  };

  const handleSaveGoals = async () => {
    await updateGoalsMutation.mutateAsync({
      clientId: clientId!,
      caloriesTarget: parseInt(caloriesTarget),
      proteinTarget: parseInt(proteinTarget),
      fatTarget: parseInt(fatTarget),
      carbsTarget: parseInt(carbsTarget),
      fibreTarget: parseInt(fibreTarget),
      hydrationTarget: parseInt(hydrationTarget),
      weightTarget: weightTarget ? parseFloat(weightTarget) : undefined,
    });
  };

  const handleEditMeal = (meal: any) => {
    setEditingMeal(meal);
    setShowEditDialog(true);
  };

  const handleDeleteMeal = async (mealId: number) => {
    if (confirm("Are you sure you want to delete this meal? This action cannot be undone.")) {
      await deleteMealMutation.mutateAsync({ mealId });
    }
  };

  // Prepare chart data for nutrition trends
  const nutritionChartData = meals?.slice(-7).map((meal) => ({
    date: new Date(meal.loggedAt).toLocaleDateString(),
    calories: meal.calories || 0,
    protein: meal.protein || 0,
    fat: meal.fat || 0,
    carbs: meal.carbs || 0,
    fibre: meal.fibre || 0,
    score: meal.nutritionScore || 0,
  })) || [];

  // Prepare chart data for body metrics
  const bodyMetricsChartData = bodyMetrics?.slice(-7).map((metric) => ({
    date: new Date(metric.recordedAt).toLocaleDateString(),
    weight: metric.weight ? metric.weight / 10 : 0, // Convert back from integer storage
    hydration: metric.hydration || 0,
  })) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation('/trainer')}
              style={{color: '#578DB3'}}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold" style={{color: '#2B2A2C'}}>{client.name}</h1>
              <p className="text-sm" style={{color: '#6F6E70'}}>{client.email || "No email"}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Nutrition Goals Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Nutrition Goals</CardTitle>
                  <CardDescription>Daily targets for this client</CardDescription>
                </div>
                <Dialog open={isEditGoalsOpen} onOpenChange={setIsEditGoalsOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleEditGoals}
                      style={{borderColor: '#578DB3', color: '#578DB3'}}
                      className="hover:bg-blue-50"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Goals
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Nutrition Goals</DialogTitle>
                      <DialogDescription>
                        Update daily nutrition targets for {client.name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="calories">Calories</Label>
                        <Input
                          id="calories"
                          type="number"
                          value={caloriesTarget}
                          onChange={(e) => setCaloriesTarget(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="protein">Protein (g)</Label>
                        <Input
                          id="protein"
                          type="number"
                          value={proteinTarget}
                          onChange={(e) => setProteinTarget(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="fat">Fat (g)</Label>
                        <Input
                          id="fat"
                          type="number"
                          value={fatTarget}
                          onChange={(e) => setFatTarget(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="carbs">Carbs (g)</Label>
                        <Input
                          id="carbs"
                          type="number"
                          value={carbsTarget}
                          onChange={(e) => setCarbsTarget(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="fibre">Fibre (g)</Label>
                        <Input
                          id="fibre"
                          type="number"
                          value={fibreTarget}
                          onChange={(e) => setFibreTarget(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="hydration">Hydration (ml)</Label>
                        <Input
                          id="hydration"
                          type="number"
                          value={hydrationTarget}
                          onChange={(e) => setHydrationTarget(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="weight">Target Weight (kg) - Optional</Label>
                        <Input
                          id="weight"
                          type="number"
                          step="0.1"
                          placeholder="e.g., 75.5"
                          value={weightTarget}
                          onChange={(e) => setWeightTarget(e.target.value)}
                        />
                      </div>
                      <Button 
                        onClick={handleSaveGoals} 
                        className="w-full hover:opacity-90"
                        style={{backgroundColor: '#578DB3'}}
                        disabled={updateGoalsMutation.isPending}
                      >
                        {updateGoalsMutation.isPending ? "Saving..." : "Save Goals"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Calories</p>
                  <p className="text-2xl font-bold">{goals.caloriesTarget}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Protein</p>
                  <p className="text-2xl font-bold">{goals.proteinTarget}g</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fat</p>
                  <p className="text-2xl font-bold">{goals.fatTarget}g</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Carbs</p>
                  <p className="text-2xl font-bold">{goals.carbsTarget}g</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fibre</p>
                  <p className="text-2xl font-bold">{goals.fibreTarget}g</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Hydration</p>
                  <p className="text-2xl font-bold">{goals.hydrationTarget}ml</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Visualization */}
          <Tabs defaultValue="nutrition" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="nutrition">Nutrition Trends</TabsTrigger>
              <TabsTrigger value="history">Meal History</TabsTrigger>
              <TabsTrigger value="trends">Daily Trends</TabsTrigger>
              <TabsTrigger value="body">Body Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="nutrition" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Nutrition Score Trend</CardTitle>
                  <CardDescription>Last 7 meals</CardDescription>
                </CardHeader>
                <CardContent>
                  {nutritionChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={nutritionChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={[0, 5]} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="score" stroke="#578DB3" strokeWidth={2} name="Score (1-5)" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-500 py-8">No meal data yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Macronutrient Breakdown</CardTitle>
                  <CardDescription>Last 7 meals</CardDescription>
                </CardHeader>
                <CardContent>
                  {nutritionChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={nutritionChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="protein" fill="#578DB3" name="Protein (g)" />
                        <Bar dataKey="fat" fill="#CE4C27" name="Fat (g)" />
                        <Bar dataKey="carbs" fill="#86BBD8" name="Carbs (g)" />
                        <Bar dataKey="fibre" fill="#6F6E70" name="Fibre (g)" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-500 py-8">No meal data yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-xl">📋</span>
                    Meal History
                  </CardTitle>
                  <CardDescription>
                    All meals logged by {client.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MealHistoryFeed 
                    clientId={clientId!} 
                    onEditMeal={handleEditMeal}
                    onDeleteMeal={handleDeleteMeal}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-xl">📈</span>
                        Daily Nutrient Trends
                      </CardTitle>
                      <CardDescription>
                        {client.name}'s daily consumption vs targets
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={timeRange === "today" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange("today")}
                        style={timeRange === "today" ? {backgroundColor: '#578DB3'} : {}}
                      >
                        Today
                      </Button>
                      <Button
                        variant={timeRange === "7days" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange("7days")}
                        style={timeRange === "7days" ? {backgroundColor: '#578DB3'} : {}}
                      >
                        7 Days
                      </Button>
                      <Button
                        variant={timeRange === "30days" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange("30days")}
                        style={timeRange === "30days" ? {backgroundColor: '#578DB3'} : {}}
                      >
                        30 Days
                      </Button>
                      <Button
                        variant={timeRange === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange("all")}
                        style={timeRange === "all" ? {backgroundColor: '#578DB3'} : {}}
                      >
                        All Time
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <NutrientTrendGraphs clientId={clientId!} days={timeRange === "today" ? 1 : timeRange === "7days" ? 7 : timeRange === "30days" ? 30 : 365} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="body" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Weight Trend</CardTitle>
                  <CardDescription>Last 7 recordings</CardDescription>
                </CardHeader>
                <CardContent>
                  {bodyMetricsChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={bodyMetricsChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="weight" stroke="#CE4C27" strokeWidth={2} name="Weight (kg)" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-500 py-8">No body metrics data yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Hydration Trend</CardTitle>
                  <CardDescription>Last 7 recordings</CardDescription>
                </CardHeader>
                <CardContent>
                  {bodyMetricsChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={bodyMetricsChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="hydration" fill="#86BBD8" name="Hydration (ml)" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-500 py-8">No hydration data yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Meal Edit Dialog */}
      <MealEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        meal={editingMeal}
        clientId={clientId!}
        onSuccess={() => {
          utils.meals.list.invalidate({ clientId: clientId! });
        }}
      />
    </div>
  );
}
