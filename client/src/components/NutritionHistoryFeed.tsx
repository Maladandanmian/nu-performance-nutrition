import { trpc } from "@/lib/trpc";
import { format, isToday, isYesterday, startOfWeek, startOfMonth, subDays } from "date-fns";
import { Calendar, Clock, Edit2, Trash2, Droplet, Utensils } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

interface NutritionHistoryFeedProps {
  clientId: number;
  onEditMeal?: (meal: any) => void;
  onDeleteMeal?: (mealId: number) => void;
  onEditDrink?: (drink: any) => void;
  onDeleteDrink?: (drinkId: number) => void;
}

type TimePeriod = 'week' | 'month' | '30days' | 'all';
type EntryType = 'meal' | 'drink';
type CategoryFilter = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'beverage';

interface NutritionEntry {
  id: number;
  type: EntryType;
  loggedAt: Date;
  data: any;
}

export function NutritionHistoryFeed({ 
  clientId, 
  onEditMeal, 
  onDeleteMeal,
  onEditDrink,
  onDeleteDrink 
}: NutritionHistoryFeedProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const { data: mealsData, isLoading: mealsLoading } = trpc.meals.list.useQuery({ clientId });
  const { data: drinksData, isLoading: drinksLoading } = trpc.drinks.list.useQuery({ clientId });

  // Combine and sort meals and drinks
  const entries = useMemo(() => {
    const combined: NutritionEntry[] = [];
    
    // Add meals
    if (mealsData) {
      mealsData.forEach(meal => {
        combined.push({
          id: meal.id,
          type: 'meal',
          loggedAt: new Date(meal.loggedAt),
          data: meal,
        });
      });
    }
    
    // Add drinks
    if (drinksData) {
      drinksData.forEach(drink => {
        combined.push({
          id: drink.id,
          type: 'drink',
          loggedAt: new Date(drink.loggedAt),
          data: drink,
        });
      });
    }
    
    // Sort by date (most recent first)
    combined.sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime());
    
    // Filter by time period
    const now = new Date();
    let filtered = combined;
    switch (timePeriod) {
      case 'week':
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        filtered = combined.filter(e => e.loggedAt >= weekStart);
        break;
      case 'month':
        const monthStart = startOfMonth(now);
        filtered = combined.filter(e => e.loggedAt >= monthStart);
        break;
      case '30days':
        const thirtyDaysAgo = subDays(now, 30);
        filtered = combined.filter(e => e.loggedAt >= thirtyDaysAgo);
        break;
      case 'all':
      default:
        filtered = combined;
    }
    
    // Filter by category
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'beverage') {
        // Show standalone drinks AND drinks from meals (as separate entries)
        const beverageEntries: NutritionEntry[] = [];
        filtered.forEach(entry => {
          if (entry.type === 'drink') {
            // Standalone drink
            beverageEntries.push(entry);
          } else if (entry.type === 'meal' && entry.data.beverageType) {
            // Meal with beverage - create a drink-only entry
            beverageEntries.push({
              id: entry.id,
              type: 'drink',
              loggedAt: entry.loggedAt,
              data: {
                drinkType: entry.data.beverageType,
                volumeMl: entry.data.beverageVolumeMl,
                calories: entry.data.beverageCalories,
                protein: entry.data.beverageProtein,
                fat: entry.data.beverageFat,
                carbs: entry.data.beverageCarbs,
                fibre: entry.data.beverageFibre,
                loggedAt: entry.data.loggedAt,
              },
            });
          }
        });
        return beverageEntries;
      } else {
        // Filter by meal type
        return filtered.filter(entry => 
          entry.type === 'meal' && entry.data.mealType === categoryFilter
        );
      }
    }
    
    return filtered;
  }, [mealsData, drinksData, timePeriod, categoryFilter]);

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: { date: string; label: string; entries: typeof entries }[] = [];
    
    entries.forEach(entry => {
      const dateStr = format(entry.loggedAt, 'yyyy-MM-dd');
      let existingGroup = groups.find(g => g.date === dateStr);
      
      if (!existingGroup) {
        let label = format(entry.loggedAt, 'MMMM d, yyyy');
        if (isToday(entry.loggedAt)) {
          label = 'Today';
        } else if (isYesterday(entry.loggedAt)) {
          label = 'Yesterday';
        }
        
        existingGroup = { date: dateStr, label, entries: [] };
        groups.push(existingGroup);
      }
      
      existingGroup.entries.push(entry);
    });
    
    return groups;
  }, [entries]);

  if (mealsLoading || drinksLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-6 bg-muted rounded w-32 mb-2"></div>
            <div className="space-y-2">
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No nutrition entries logged yet</p>
        <p className="text-sm text-muted-foreground mt-2">
          Start tracking your meals and drinks to see your history here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Period Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['week', 'month', '30days', 'all'] as TimePeriod[]).map(period => (
          <Button
            key={period}
            variant={timePeriod === period ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimePeriod(period)}
          >
            {period === 'week' && 'This Week'}
            {period === 'month' && 'This Month'}
            {period === '30days' && 'Last 30 Days'}
            {period === 'all' && 'All Time'}
          </Button>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'breakfast', 'lunch', 'dinner', 'snack', 'beverage'] as CategoryFilter[]).map(category => (
          <Button
            key={category}
            variant={categoryFilter === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoryFilter(category)}
          >
            {category === 'all' && 'All'}
            {category === 'breakfast' && 'Breakfast'}
            {category === 'lunch' && 'Lunch'}
            {category === 'dinner' && 'Dinner'}
            {category === 'snack' && 'Snack'}
            {category === 'beverage' && 'Beverages'}
          </Button>
        ))}
      </div>

      {/* Grouped Entries */}
      {groupedEntries.map(group => (
        <div key={group.date} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {group.label}
          </div>
          
          <div className="space-y-2">
            {group.entries.map(entry => (
              <div
                key={`${entry.type}-${entry.id}`}
                className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                {entry.type === 'meal' ? (
                  <MealEntry 
                    meal={entry.data} 
                    onEdit={onEditMeal}
                    onDelete={onDeleteMeal}
                  />
                ) : (
                  <DrinkEntry 
                    drink={entry.data}
                    onEdit={onEditDrink}
                    onDelete={onDeleteDrink}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MealEntry({ 
  meal, 
  onEdit, 
  onDelete 
}: { 
  meal: any; 
  onEdit?: (meal: any) => void;
  onDelete?: (mealId: number) => void;
}) {
  return (
    <div className="flex gap-4">
      {/* Meal Image */}
      {meal.imageUrl && (
        <div className="flex-shrink-0">
          <img
            src={meal.imageUrl}
            alt="Meal"
            className="w-20 h-20 object-cover rounded-md"
          />
        </div>
      )}
      
      {/* Meal Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Utensils className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <div className="font-medium capitalize">{meal.mealType}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(meal.loggedAt).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true,
                  timeZone: 'Asia/Hong_Kong'
                })}
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-1 flex-shrink-0">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(meal)}
                className="h-8 w-8 p-0"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(meal.id)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
          {meal.aiDescription}
        </p>
        
        {/* Nutrition Info */}
        <div className="flex gap-3 text-xs flex-wrap">
          <span className="font-medium">{meal.calories} cal</span>
          <span className="text-muted-foreground">P: {meal.protein}g</span>
          <span className="text-muted-foreground">C: {meal.carbs}g</span>
          <span className="text-muted-foreground">F: {meal.fat}g</span>
          {meal.fibre > 0 && (
            <span className="text-muted-foreground">Fiber: {meal.fibre}g</span>
          )}
          {meal.nutritionScore && (
            <span className="font-medium text-primary">
              Score: {meal.nutritionScore}/10
            </span>
          )}
        </div>
        
        {/* Beverage info if present */}
        {meal.beverageType && (
          <div className="mt-2 pt-2 border-t text-xs text-muted-foreground flex items-center gap-2">
            <Droplet className="h-3 w-3" />
            <span>{meal.beverageType} ({meal.beverageVolumeMl}ml)</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DrinkEntry({
  drink,
  onEdit,
  onDelete
}: {
  drink: any;
  onEdit?: (drink: any) => void;
  onDelete?: (drinkId: number) => void;
}) {
  return (
    <div className="flex gap-4">
      {/* Drink Icon */}
      <div className="flex-shrink-0 w-20 h-20 bg-blue-50 rounded-md flex items-center justify-center">
        <Droplet className="h-8 w-8 text-blue-500" />
      </div>
      
      {/* Drink Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="font-medium">{drink.drinkType}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(drink.loggedAt).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Hong_Kong'
              })}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-1 flex-shrink-0">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(drink)}
                className="h-8 w-8 p-0"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(drink.id)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Nutrition Info */}
        <div className="flex gap-3 text-xs flex-wrap">
          <span className="font-medium">{drink.volumeMl}ml</span>
          <span className="text-muted-foreground">Hydration</span>
        </div>
        
        {/* Show nutrition if available */}
        {drink.calories !== null && drink.calories !== undefined && (
          <div className="flex gap-3 text-xs flex-wrap mt-2">
            <span><strong>{drink.calories}</strong> cal</span>
            <span>P: <strong>{drink.protein || 0}</strong>g</span>
            <span>C: <strong>{drink.carbs || 0}</strong>g</span>
            <span>F: <strong>{drink.fat || 0}</strong>g</span>
            {drink.fibre > 0 && <span>Fiber: <strong>{drink.fibre}</strong>g</span>}
          </div>
        )}
      </div>
    </div>
  );
}
