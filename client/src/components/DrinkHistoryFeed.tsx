import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { Calendar, Clock, Edit2, Trash2, Droplets, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface DrinkHistoryFeedProps {
  clientId: number;
}

export function DrinkHistoryFeed({ clientId }: DrinkHistoryFeedProps) {
  const { data: drinks, isLoading, error } = trpc.drinks.list.useQuery({ clientId });
  const [editingDrink, setEditingDrink] = useState<any>(null);
  const [editDrinkType, setEditDrinkType] = useState("");
  const [editVolumeMl, setEditVolumeMl] = useState("");
  const utils = trpc.useUtils();

  const deleteDrinkMutation = trpc.drinks.delete.useMutation({
    onSuccess: () => {
      toast.success("Drink deleted successfully!");
      utils.drinks.list.invalidate();
      utils.meals.dailyTotals.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete drink: ${error.message}`);
    },
  });

  const updateDrinkMutation = trpc.drinks.update.useMutation({
    onSuccess: () => {
      toast.success("Drink updated successfully!");
      setEditingDrink(null);
      utils.drinks.list.invalidate();
      utils.meals.dailyTotals.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update drink: ${error.message}`);
    },
  });

  const toggleFavoriteMutation = trpc.drinks.toggleFavorite.useMutation({
    onSuccess: (data) => {
      toast.success(data.isFavorite ? "Added to favorites" : "Removed from favorites");
      utils.drinks.list.invalidate();
      utils.drinks.getFavorites.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update favorite: ${error.message}`);
    },
  });

  const handleDelete = async (drinkId: number) => {
    if (confirm("Are you sure you want to delete this drink? This action cannot be undone.")) {
      await deleteDrinkMutation.mutateAsync({ drinkId });
    }
  };

  const handleEdit = (drink: any) => {
    setEditingDrink(drink);
    setEditDrinkType(drink.drinkType);
    setEditVolumeMl(drink.volumeMl.toString());
  };

  const handleSaveEdit = async () => {
    if (!editDrinkType || !editVolumeMl) {
      toast.error("Please fill in all fields");
      return;
    }

    await updateDrinkMutation.mutateAsync({
      drinkId: editingDrink.id,
      drinkType: editDrinkType,
      volumeMl: parseInt(editVolumeMl),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600">
        <p>Failed to load drink history: {error.message}</p>
      </div>
    );
  }

  if (!drinks || drinks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Droplets className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium">No drinks logged yet</p>
        <p className="text-sm mt-2">Start by logging your first beverage!</p>
      </div>
    );
  }

  // Sort drinks by most recent first
  const sortedDrinks = [...drinks].sort((a, b) => 
    new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
  );

  return (
    <>
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {sortedDrinks.map((drink) => (
          <div
            key={drink.id}
            className="flex items-center gap-3 p-3 border rounded-lg hover:shadow-sm transition-shadow bg-white"
          >
            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Droplets className="h-6 w-6 text-blue-600" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg">{drink.drinkType}</h3>
              <p className="text-sm text-gray-600">{drink.volumeMl}ml</p>
              
              {/* Score */}
              <div className="flex items-center gap-1 text-yellow-500 mb-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="text-sm">
                    {star <= (drink.nutritionScore || 0) ? '⭐' : '☆'}
                  </span>
                ))}
                <span className="text-xs text-gray-500 ml-1">
                  {drink.nutritionScore ? `${drink.nutritionScore}/5` : 'N/A'}
                </span>
              </div>

              {/* Nutrition Info */}
              <div className="grid grid-cols-5 gap-1 text-xs mb-1.5">
                <div className="text-center">
                  <div className="font-semibold text-gray-700">{drink.calories}</div>
                  <div className="text-xs text-gray-500">kcal</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-700">{drink.protein}g</div>
                  <div className="text-xs text-gray-500">protein</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-700">{drink.fat}g</div>
                  <div className="text-xs text-gray-500">fat</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-700">{drink.carbs}g</div>
                  <div className="text-xs text-gray-500">carbs</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-700">{drink.fibre}g</div>
                  <div className="text-xs text-gray-500">fiber</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(drink.loggedAt), 'MMM d, yyyy')}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(drink.loggedAt), 'h:mm a')}
                </div>
              </div>

              {drink.notes && (
                <div className="mt-1 text-sm text-gray-600 italic">
                  Note: {drink.notes}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleFavoriteMutation.mutate({ drinkId: drink.id, clientId })}
                className={drink.isFavorite || drink.sourceType === 'favorite' || drink.sourceType === 'repeat' ? "text-yellow-500 hover:text-yellow-600" : "text-gray-400 hover:text-gray-500"}
                title={drink.isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Star className={`h-4 w-4 ${drink.isFavorite || drink.sourceType === 'favorite' || drink.sourceType === 'repeat' ? 'fill-current' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(drink)}
                className="text-blue-600 hover:text-blue-700"
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(drink.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Drink Dialog */}
      <Dialog open={!!editingDrink} onOpenChange={(open) => !open && setEditingDrink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Drink</DialogTitle>
            <DialogDescription>
              Update the drink type or volume
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="edit-drink-type">Drink Type</Label>
              <Input
                id="edit-drink-type"
                value={editDrinkType}
                onChange={(e) => setEditDrinkType(e.target.value)}
                placeholder="e.g., Cappuccino, Water"
              />
            </div>

            <div>
              <Label htmlFor="edit-volume">Volume (ml)</Label>
              <Input
                id="edit-volume"
                type="number"
                value={editVolumeMl}
                onChange={(e) => setEditVolumeMl(e.target.value)}
                placeholder="e.g., 250"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditingDrink(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateDrinkMutation.isPending}
              >
                {updateDrinkMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
