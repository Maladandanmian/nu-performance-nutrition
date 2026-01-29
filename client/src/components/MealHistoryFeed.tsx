import { trpc } from "@/lib/trpc";
import { format, isToday, isYesterday, startOfWeek, startOfMonth, subDays } from "date-fns";
import { Calendar, Clock, Edit2, Trash2, Star } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

interface MealHistoryFeedProps {
  clientId: number;
  onEditMeal?: (meal: any) => void;
  onDeleteMeal?: (mealId: number) => void;
}

type TimePeriod = 'week' | 'month' | '30days' | 'all';

export function MealHistoryFeed({ clientId, onEditMeal, onDeleteMeal }: MealHistoryFeedProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const { data: mealsData, isLoading, error } = trpc.meals.list.useQuery({ clientId });
  const utils = trpc.useUtils();

  const toggleFavoriteMutation = trpc.meals.toggleFavorite.useMutation({
    onSuccess: () => {
      utils.meals.list.invalidate();
      utils.meals.getFavorites.invalidate();
    },
  });

  // Filter and sort meals
  const meals = useMemo(() => {
    if (!mealsData) return [];

    // Reverse chronological order (most recent first)
    const sorted = [...mealsData].sort((a, b) => 
      new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
    );

    // Filter by time period
    const now = new Date();
    switch (timePeriod) {
      case 'week':
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
        return sorted.filter(m => new Date(m.loggedAt) >= weekStart);
      case 'month':
        const monthStart = startOfMonth(now);
        return sorted.filter(m => new Date(m.loggedAt) >= monthStart);
      case '30days':
        const thirtyDaysAgo = subDays(now, 30);
        return sorted.filter(m => new Date(m.loggedAt) >= thirtyDaysAgo);
      case 'all':
      default:
        return sorted;
    }
  }, [mealsData, timePeriod]);

  // Group meals by date
  const groupedMeals = useMemo(() => {
    const groups: { date: string; label: string; meals: typeof meals }[] = [];
    
    meals.forEach(meal => {
      const mealDate = new Date(meal.loggedAt);
      const dateKey = format(mealDate, 'yyyy-MM-dd');
      
      let dateLabel: string;
      if (isToday(mealDate)) {
        dateLabel = 'Today';
      } else if (isYesterday(mealDate)) {
        dateLabel = 'Yesterday';
      } else {
        dateLabel = format(mealDate, 'EEEE, MMMM d, yyyy');
      }
      
      const existingGroup = groups.find(g => g.date === dateKey);
      if (existingGroup) {
        existingGroup.meals.push(meal);
      } else {
        groups.push({ date: dateKey, label: dateLabel, meals: [meal] });
      }
    });
    
    return groups;
  }, [meals]);

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
        <p>Failed to load meal history: {error.message}</p>
      </div>
    );
  }

  if (!meals || meals.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <span className="text-4xl mb-4 block">🍽️</span>
        <p className="text-lg font-medium">No meals logged yet</p>
        <p className="text-sm mt-2">Start by logging your first meal!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time Period Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={timePeriod === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTimePeriod('week')}
        >
          This Week
        </Button>
        <Button
          variant={timePeriod === 'month' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTimePeriod('month')}
        >
          This Month
        </Button>
        <Button
          variant={timePeriod === '30days' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTimePeriod('30days')}
        >
          Last 30 Days
        </Button>
        <Button
          variant={timePeriod === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTimePeriod('all')}
        >
          All Time
        </Button>
      </div>

      {/* Meal List */}
      <div className="space-y-6 max-h-[600px] overflow-y-auto">
      {groupedMeals.map((group) => (
        <div key={group.date} className="space-y-3">
          {/* Date Header */}
          <div className="sticky top-0 bg-gray-50 px-3 py-2 rounded-md border-l-4 border-blue-500">
            <h3 className="font-semibold text-gray-700">{group.label}</h3>
            <p className="text-xs text-gray-500">{group.meals.length} {group.meals.length === 1 ? 'entry' : 'entries'}</p>
          </div>
          
          {/* Meals for this date */}
          {group.meals.map((meal) => (
        <div
          key={meal.id}
          className="flex gap-3 p-3 border rounded-lg hover:shadow-sm transition-shadow bg-white"
        >
          {/* Meal Image or Icon */}
          {meal.source === 'nutrition_label' ? (
            <div className="flex-shrink-0 w-16 h-16 bg-amber-100 rounded flex items-center justify-center">
              <span className="text-3xl" title="Nutrition label scan">🏷️</span>
            </div>
          ) : meal.imageUrl ? (
            <div className="flex-shrink-0">
              <img
                src={meal.imageUrl}
                alt="Meal"
                className="w-16 h-16 object-cover rounded"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-16 h-16 bg-blue-100 rounded flex items-center justify-center">
              <span className="text-2xl">🥤</span>
            </div>
          )}

          {/* Meal Details */}
          <div className="flex-1 min-w-0">
            {/* Meal Type and Time */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base capitalize">
                {meal.mealType}
              </h3>
              <span className="text-xs text-gray-500">
                {format(new Date(meal.loggedAt), 'h:mm a')}
              </span>
            </div>
            
            {/* Description */}
            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
              {meal.aiDescription}
            </p>
            
            {/* Score */}
            <div className="flex items-center gap-1 text-yellow-500 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className="text-base">
                  {star <= (meal.nutritionScore || 0) ? '⭐' : '☆'}
                </span>
              ))}
              <span className="text-xs text-gray-500 ml-1">
                {meal.nutritionScore}/5
              </span>
            </div>

            {/* Nutrition Info */}
            <div className="grid grid-cols-5 gap-1 text-xs mb-1.5">
              <div className="text-center">
                <div className="font-semibold text-gray-700">{meal.calories}</div>
                <div className="text-xs text-gray-500">kcal</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-700">{meal.protein}g</div>
                <div className="text-xs text-gray-500">protein</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-700">{meal.fat}g</div>
                <div className="text-xs text-gray-500">fat</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-700">{meal.carbs}g</div>
                <div className="text-xs text-gray-500">carbs</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-700">{meal.fibre}g</div>
                <div className="text-xs text-gray-500">fiber</div>
              </div>
            </div>

            {/* Additional Info */}
            {meal.aiConfidence && (
              <div className="text-xs text-gray-500">
                AI Confidence: {meal.aiConfidence}%
              </div>
            )}

            {/* Beverage Info */}
            {meal.beverageType && (
              <div className="mt-1.5 p-1.5 bg-blue-50 border border-blue-200 rounded text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">🥤</span>
                  <span className="font-medium text-blue-900">
                    {meal.beverageType} ({meal.beverageVolumeMl}ml)
                  </span>
                  <span className="text-blue-700">
                    • {meal.beverageCalories} kcal
                  </span>
                  {meal.beverageProtein && meal.beverageProtein > 0 && (
                    <span className="text-blue-700">
                      • {meal.beverageProtein}g protein
                    </span>
                  )}
                  {meal.beverageCarbs && meal.beverageCarbs > 0 && (
                    <span className="text-blue-700">
                      • {meal.beverageCarbs}g carbs
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {meal.notes && (
              <div className="mt-2 text-sm text-gray-600 italic">
                Note: {meal.notes}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleFavoriteMutation.mutate({ mealId: meal.id, clientId })}
                className={meal.isFavorite || meal.sourceType === 'favorite' || meal.sourceType === 'repeat' ? "text-yellow-500 hover:text-yellow-600" : "text-gray-400 hover:text-gray-500"}
                title={meal.isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Star className={`h-4 w-4 ${meal.isFavorite || meal.sourceType === 'favorite' || meal.sourceType === 'repeat' ? 'fill-current' : ''}`} />
              </Button>
              {onEditMeal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditMeal(meal)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
              {onDeleteMeal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDeleteMeal(meal.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
          ))}
        </div>
      ))}
      </div>
    </div>
  );
}
