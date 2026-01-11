# Nu Performance Nutrition - TODO

## Database Schema & Backend
- [x] Extend user table with role field (admin/user)
- [x] Create clients table with PIN field for authentication
- [x] Create nutrition_goals table (per client, editable by trainer)
- [x] Create meals table (food entries with AI analysis)
- [x] Create drinks table (manual entries)
- [x] Create body_metrics table (weight and hydration tracking)
- [x] Add database query helpers in server/db.ts
- [x] Create tRPC procedures for client management (trainer only)
- [x] Create tRPC procedures for nutrition goal management (trainer only)
- [x] Create tRPC procedures for meal logging with AI analysis
- [x] Create tRPC procedures for drink logging
- [x] Create tRPC procedures for body metrics logging
- [x] Create tRPC procedures for daily totals aggregation

## AI Integration
- [x] Create Qwen-VL API client wrapper using Manus Forge API
- [x] Implement image upload to S3
- [x] Implement AI image analysis for food recognition
- [x] Implement AI nutritional value extraction
- [x] Implement hybrid scoring algorithm (60% quality + 40% progress)
- [x] Add error handling for AI API failures

## Authentication System
- [x] Add PIN field to clients table in database schema
- [x] Create PIN generation function (6-digit unique codes)
- [x] Create PIN authentication endpoint (separate from OAuth)
- [x] Create client session management for PIN auth
- [x] Create authenticatedProcedure middleware for both auth types
- [x] Update login page to show PIN entry option
- [x] Create PIN login UI component with two-column layout

## Client Interface
- [x] Create meal logging page with photo upload
- [x] Create detailed nutrition breakdown modal
- [x] Display nutrition score (1-5 stars) after meal analysis
- [x] Create drink logging form (type and volume)
- [x] Create body metrics logging form (weight and hydration)
- [x] Create meal history feed component
- [x] Create today's summary widget with circular progress indicators
- [x] Create nutrient trend graphs (14-day view for clients)
- [x] Pre-populate target lines in trend graphs

## Trainer Interface
- [x] Create client management page (create, view, list, delete clients)
- [x] Create nutrition goal editing interface
- [x] Create trainer dashboard showing all clients
- [x] Create client detail page with 30-day analytics
- [x] Add charts for Calories, Protein, Fat, Carbs, Fiber
- [x] Add charts for Hydration and Bodyweight trends
- [x] Add meal history view for trainers

## UI/UX & Design
- [x] Apply Nu Performance Nutrition branding colors
- [x] Set up typography (Outfit for headings, Inter for body)
- [x] Design and implement responsive layouts
- [x] Add loading states for AI analysis
- [x] Add error handling and user feedback
- [x] Implement role-based navigation
- [x] Make PIN login prominent on home page
- [x] Add confirmation dialog for trainer login

## Testing & Deployment
- [x] Test meal photo upload and AI analysis
- [x] Test PIN authentication flow
- [x] Test OAuth authentication for trainers
- [x] Test data visualization charts
- [x] Test role-based access control
- [x] Verify mobile responsiveness
- [x] Create initial checkpoint
- [x] Provide deployment instructions

## Logo Update
- [x] Copy Nu Performance logo to public assets
- [x] Update homepage to display logo in white circle
- [x] Update favicon with logo
- [x] Test logo display on all pages

## Multi-Trainer Support
- [x] Add Luke@nuperformancecoaching.com as additional trainer
- [x] Update authentication to support multiple admin users
- [x] Test Luke's login and trainer access

## Image Upload Enhancement
- [x] Update meal photo input to support both camera and gallery
- [x] Test on iOS devices
- [x] Test on Android devices

## AI Re-Analysis for Edited Components
- [x] Create tRPC endpoint for AI-powered component re-estimation
- [x] Update ComponentEditor to call AI re-analysis when description changes
- [x] Pass image context to AI for accurate portion estimation
- [x] Display loading state during re-analysis
- [x] Test with various food substitutions (milk types, protein sources, etc.)

## AI-Powered Add Component
- [x] Create AI endpoint to estimate nutrition from food name + quantity
- [x] Update AddComponentForm to use food name and quantity inputs
- [x] Remove manual nutrition entry fields from add component form
- [x] Recalculate meal score after adding components
- [x] Update improvement advice based on complete edited meal
- [x] Save updated meal to database (replace original)
- [x] Test with various food items and quantities

## Hydration in Today's Summary
- [x] Add hydration indicator to TodaysSummary component
- [x] Display current hydration vs target (ml)
- [x] Show circular progress indicator for hydration
- [x] Ensure hydration data is fetched from body_metrics table
- [x] Test hydration display with various intake levels

## Form Reset After Meal Logging
- [x] Clear meal photo input after successful submission
- [x] Reset meal type to default value
- [x] Clear notes textarea
- [x] Clear drink type and volume fields
- [x] Test form reset with various meal logging scenarios

## Drink Volume Reference Guide
- [x] Add common drink container volumes beneath drink entry section
- [x] Include 6 typical containers with ml equivalents
- [x] Style as compact reference list
- [x] Test visibility and usability

## Scaling Reference Card Detection
- [x] Update AI prompt to include credit card, business card, and Octopus card
- [x] Add Octopus card detection instruction (look for figure-8 logo)
- [x] Update UI hints to mention all three card types
- [x] Test with images containing different reference cards

## Hydration Tracking Bug
- [x] Investigate why logged drinks don't appear in Today's Summary
- [x] Check if drinks are being saved to database correctly
- [x] Verify dailyTotals hydration aggregation logic
- [x] Fix the hydration display issue
- [x] Test with multiple drink entries

## Hydration Still Not Displaying After Fix
- [x] Check if drinks were logged before or after the fix was deployed
- [x] Verify body_metrics entries exist in database
- [x] Found root cause: drink logging was never implemented (TODO comment)
- [x] Implement drink logging functionality
- [x] Implement body metrics logging functionality
- [x] Test with fresh drink entry after implementation

## Duplicate Drink Entries Bug (Jan 5, 2026)
- [x] Identified root cause: saveMeal creates meal entries with beverage data but doesn't create drinks/body_metrics entries
- [x] Fixed saveMeal procedure to create drinks and body_metrics entries when beverage is included
- [x] Test fix with fresh drink entry
- [x] Clean up duplicate meal entries in database (removed 6 beverage-only entries)

## Meal and Drink History Editing/Deletion (Jan 5, 2026)
- [x] Add edit and delete buttons to MealHistoryFeed component
- [ ] Create meal editing modal that reuses existing meal analysis interface
- [x] Implement backend deleteMeal procedure
- [x] Implement backend updateMeal procedure with AI re-evaluation
- [x] Add drink history view in client dashboard
- [x] Add edit and delete buttons to drink history entries
- [x] Implement backend deleteDrink procedure
- [x] Implement backend updateDrink procedure
- [x] Ensure daily totals recalculate after edits/deletions
- [x] Test meal editing with AI re-evaluation
- [x] Test meal deletion
- [x] Test drink editing
- [x] Test drink deletion

## Logout Redirect Fix (Jan 5, 2026)
- [x] Update ClientDashboard logout to redirect to home page instead of Manus OAuth
- [x] Remove auto-redirect from home page for client sessions
- [x] Test logout flow from client dashboard

## React Hooks Order Error Fix (Jan 5, 2026)
- [x] Move deleteMealMutation and other hooks to top of ClientDashboard
- [x] Ensure all hooks are called before any conditional returns
- [x] Test that error is resolved

## Hydration Display and Tab Merge (Jan 5, 2026)
- [x] Investigate why hydration circle in Today's Summary is empty despite logged drinks
- [x] Fix hydration tracking to display correctly (changed from body_metrics to drinks table)
- [x] Merge Meals and Drinks tabs into unified Nutrition tab
- [x] Create NutritionHistoryFeed to show both meals and drinks chronologically
- [x] Test hydration display and unified nutrition view

## Meal Editing and Beverage Hydration (Jan 5, 2026)
- [x] Fix hydration tracking to include beverages logged with meals (beverageVolumeMl field)
- [x] Implement meal editing modal to allow modifying meal entries
- [x] Add beverage editing capability in meal edit flow
- [x] Test that meal beverages contribute to hydration circle
- [x] Test meal editing functionality end-to-end

## Fix Meal Editing Modal (Jan 5, 2026)
- [x] Show meal type selector in edit modal
- [x] Show beverage section in edit modal
- [x] Pre-populate beverage fields with existing data
- [x] Allow changing meal type from dropdown
- [x] Allow modifying beverage volume and type
- [x] Test editing meal type and beverage volume

## iOS Webapp Login & Beverage Estimation Fixes (Jan 5, 2026)
- [x] Add client PIN login section to home page (already exists)
- [x] Add trainer login button to home page (already exists)
- [x] Always show login forms even when session exists
- [x] Add Switch User/Logout button for existing sessions
- [x] Fix beverage nutrition estimation returning 0 calories for "english breakfast tea with milk" (added example to prompt)
- [x] Test client PIN login on iOS webapp (login forms now always visible)
- [x] Test trainer login on iOS webapp (login forms now always visible)
- [ ] Test beverage estimation with tea and milk (needs user testing)

## AI Returning 0 Calories for Tea with Milk (Jan 5, 2026)
- [x] Improve prompt to explicitly prevent 0-calorie estimates for milk-based drinks
- [x] Add validation to reject suspicious 0-calorie responses
- [x] Implement fallback calculation for common milk-based beverages
- [ ] Test with "english breakfast tea with milk"
- [ ] Update existing 0-calorie tea entries in database

## Tea with Milk Calorie Overestimation (Jan 5, 2026)
- [x] Refine prompt with specific milk ratios (30ml per 250ml, 40ml per 350ml)
- [x] Adjust fallback calculation to 12% of drink volume (conservative estimate)
- [ ] Test with 350ml tea with milk (should be ~27 kcal, not 42)

## Duplicate Beverage Entries (Jan 5, 2026)
- [x] Investigate why logging beverages creates both meal and drink entries
- [x] Fix to create only drink entries for beverage-only logs (removed saveMealMutation call)
- [x] Ensure beverage nutrition is saved correctly (drinks now use logDrinkMutation)
- [x] Test beverage logging to verify single entry (ready for user testing)
- [x] Clean up duplicate beverage entries in database (deleted beverage-only meal entries)

## Drink Nutrition Data Display (Jan 5, 2026)
- [x] Add nutrition columns (calories, protein, fat, carbs, fibre) to drinks table schema
- [x] Update drink creation to estimate and save nutrition data
- [x] Update NutritionHistoryFeed to display drink nutrition like meals
- [x] Migrate existing drinks to have nutrition data (28 cal for 350ml tea with milk)
- [x] Test drink nutrition display (28 cal showing for tea with milk)

## Include Drink Nutrition in Daily Totals (Jan 5, 2026)
- [x] Update dailyTotals procedure to sum drink nutrition from drinks table
- [x] Test that standalone drink calories/macros appear in Today's Summary
- [x] Verify drink nutrition is included in trends (code updated, ready for user testing)

## Drink Logging Regression (Jan 5, 2026)
- [x] Restore drink summary page with nutrition score after logging
- [x] Restore drink editing functionality in nutrition history
- [ ] Test drink logging shows summary with score
- [ ] Test drink editing works from history

## Drink Estimation Error (Jan 5, 2026)
- [x] Fix "error logging drink" when clicking Analyse button (removed double estimation)
- [x] Prevent form from clearing if estimation fails (now requires pre-estimated nutrition)

## Test Database Separation (Jan 5, 2026)
- [x] Add cleanup function to delete test clients after tests
- [x] Update test files to use cleanup in afterEach
- [x] Verify main database remains clean after test runs

## Water Logging Bug (Jan 5, 2026)
- [x] Fix "beverage could not be logged" error for plain water
- [x] Add special handling to skip estimation for water
- [x] Allow logging water directly without Analyse button

## Trends Section Update (Jan 5, 2026)
- [x] Create combined nutrients chart (protein, fat, carbs, fiber) with target lines
- [x] Keep calorie trend at top
- [x] Add bodyweight trend chart with weight persistence (no drop to 0)

## Bodyweight Target Feature (Jan 5, 2026)
- [x] Add weightTarget field to nutrition goals schema
- [x] Update trainer UI to allow setting weight target
- [x] Add dotted target line to bodyweight chart
- [x] Push database migration

## Hydration Tracking Chart (Jan 5, 2026)
- [x] Add hydration chart similar to calories chart with target line
- [x] Position between macronutrients and bodyweight charts
- [x] Include summary stats showing average vs target

## Time Range Selector for Trends (Jan 5, 2026)
- [x] Add time range selector UI (Today, Last 7 Days, Last 30 Days, All Time)
- [x] Update NutrientTrendGraphs to accept and use selected time range
- [x] Apply time range to all charts (calories, macronutrients, hydration, bodyweight)
- [x] Update chart descriptions to reflect selected time range

## Beverage Logging Error (Jan 5, 2026)
- [x] Fix "can't access property 'calories', beverageNutrition is null" error
- [x] Add validation to ensure beverageNutrition exists before logging
- [x] Test beverage logging flow

## Water Logging Validation Error (Jan 6, 2026)
- [x] Fix undefined nutrition values when logging plain water
- [x] Ensure water gets proper zero nutrition values
- [x] Test water logging flow

## Beverage Summary Modal Issue (Jan 6, 2026)
- [x] Hide "Meal Type" section in summary modal for drink-only logging
- [x] Hide "Beverage (Optional)" section in summary modal for drink-only logging
- [x] Show simplified drink summary instead

## Drink Summary Modal Missing Features (Jan 6, 2026)
- [x] Add volume display in drink summary modal
- [x] Add volume editor to change drink amount
- [x] Add date/time picker to change when drink was consumed
- [x] Add Save/Update button to apply changes
- [x] Show drink type and volume prominently in modal

## Datetime and Timezone Issues (Jan 6, 2026)
- [x] Fix datetime-local input to allow time editing (split into separate date/time inputs)
- [x] Implement Hong Kong timezone (Asia/Hong_Kong, GMT+8) throughout app
- [x] Ensure all timestamps display in Hong Kong time
- [x] Store timestamps with timezone awareness

## Drink Date/Time Update Bug (Jan 6, 2026)
- [x] Fix updateDrinkMutation to include loggedAt timestamp
- [x] Convert drinkDateTime string to proper timestamp format
- [x] Verify date/time changes persist in database
- [x] Test drink date/time editing in UI

## Meal Date/Time Editing (Jan 6, 2026)
- [x] Add mealDateTime state variable to ClientDashboard
- [x] Add date/time picker inputs to meal editing modal
- [x] Update meals.update procedure to accept loggedAt field
- [x] Update updateMealMutation call to include loggedAt timestamp
- [x] Test meal date/time editing in UI

## Trend View Toggle (Jan 6, 2026)
- [x] Add view state (graph/table) to NutrientTrendGraphs component
- [x] Add toggle button in top right of trend section
- [x] Implement table view for Calories trend
- [x] Implement table view for Macronutrients trend
- [x] Implement table view for Hydration trend
- [x] Ensure toggle state persists across all three charts
- [x] Test switching between graph and table views

## Date Range Selector for Trends (Jan 6, 2026)
- [x] Add date range state to NutrientTrendGraphs component
- [x] Add Select dropdown for date range (All Time, Last 30 Days, Last 7 Days, Today)
- [x] Update dailyTotals query to accept dynamic days parameter
- [x] Implement "All Time" option to fetch all available data
- [x] Implement "Today" option to show only current day
- [x] Update chart data generation to handle variable date ranges
- [x] Test all date range options

## Nutrition History Category Filters (Jan 6, 2026)
- [x] Add category filter state to NutritionHistoryFeed component
- [x] Add filter buttons UI (All, Breakfast, Lunch, Dinner, Snack, Beverage)
- [x] Implement filtering logic for meal types
- [x] Implement beverage filtering to show standalone drinks
- [x] Include drinks logged with meals in beverage filter (show only drink portion)
- [x] Update NutritionHistoryFeed to accept and apply category filter
- [x] Test all category filters

## Smart Meal Type Pre-selection (Jan 6, 2026)
- [x] Create time-based meal type logic function
- [x] Define time ranges for each meal type (breakfast: 5am-10am, lunch: 11am-2pm, dinner: 5pm-9pm, snack: other times)
- [x] Update mealType state initialization to use smart pre-selection
- [x] Ensure user can still manually change the pre-selected meal type
- [x] Test pre-selection at different times of day

## Nutrition History Time Period Filter UI Update (Jan 6, 2026)
- [x] Replace time period buttons with Select dropdown in NutritionHistoryFeed
- [x] Update time period options to match Trends tab (Today, Last 7 Days, Last 30 Days, All Time)
- [x] Keep category filter buttons unchanged
- [x] Test dropdown functionality

## Remove Obsolete Hydration Metric (Jan 6, 2026)
- [x] Remove "Total Hydration Today" metric from Metrics tab
- [x] Verify Metrics tab displays correctly without hydration metric

## Move Bodyweight Trend to Metrics Tab (Jan 6, 2026)
- [x] Find and extract bodyweight trend graph code from Trends tab
- [x] Add bodyweight trend graph to Metrics tab below weight input
- [x] Add time span dropdown (Today, Last 7 Days, Last 30 Days, All Time)
- [x] Add table view toggle button
- [x] Implement table view for bodyweight data
- [x] Remove bodyweight trend from Trends tab
- [x] Test time span filtering and view toggle

## Mug Volume Correction (Jan 6, 2026)
- [x] Update mug volume reference from 350ml to 250ml in drink logging guide

## Reference Card Detection Indicator (Jan 6, 2026)
- [x] Update AI meal analysis prompt to detect and report reference card presence
- [x] Modify analysis response schema to include `referenceCardDetected` boolean field
- [x] Add checkbox indicator UI below meal description showing card detection status
- [x] Update meal analysis modal to display the indicator
- [x] Test with images containing reference cards

## Logo White Oval Width Adjustment (Jan 6, 2026)
- [x] Find logo file in project
- [x] Widen white oval background to fully contain "NU PERFORMANCE" text
- [x] Verify logo displays correctly

## Beverage Logging Error Fix (Jan 6, 2026)
- [x] Find where drink logging sends nutrition data
- [x] Add default values (0) for calories, protein, fat, carbs, fibre when undefined
- [x] Test logging zero-calorie beverages like tea

## Zero-Calorie Drink Default Values (Jan 6, 2026)
- [x] Check drinks table schema for nutrition field defaults
- [x] Ensure drinks.create procedure defaults nutrition fields to 0
- [x] Verify beverage estimation returns 0 (not null) for water, black coffee, tea
- [x] Test hydration tracking with zero-calorie beverages

## Beverage Logging Modal Fix (Jan 6, 2026)
- [x] Populate drink type and volume fields in success modal for beverage-only entries
- [x] Remove "Jasmine Tea" text (meal analysis description) for beverage-only entries
- [x] Hide "Card Detected for Portion Estimation" checkbox for beverage-only entries
- [x] Test beverage logging modal displays correctly

## Drink Details Population Fix (Jan 6, 2026)
- [x] Initialize drinkType and volumeMl state when beverage modal opens
- [x] Verify drink type and volume display in modal

## Weight Logging Graph Issue (Jan 6, 2026)
- [x] Investigate weight logging success but graph remains empty
- [x] Fix weight data fetching or display in BodyweightTrendChart
- [x] Test weight logging appears in graph

## React Error #321 Fix (Jan 7, 2026)
- [x] Fix React error when logging weight (calling useUtils inside mutation callback)
- [x] Move trpc.useUtils() call to component level instead of inside onSuccess handler
- [x] Verify weight logging works without React errors
- [x] Test query invalidation properly refreshes bodyweight graph

## Weight Rounding Issue (Jan 7, 2026)
- [x] Identify root cause: weight stored as INT, decimals truncated (68.4 -> 68)
- [x] Fix weight storage by multiplying by 10 before saving (68.4 -> 684)
- [x] Fix weight display by dividing by 10 when showing (684 -> 68.4)
- [x] Update createBodyMetric function to convert weight values
- [x] Update BodyweightTrendChart to convert stored values for display
- [x] Test weight logging preserves decimal places (68.4 displays as 68.4)
- [x] Verify all tests pass with weight conversion logic

## Meal with Drink Logging Bug (Jan 7, 2026)
- [x] Investigate why drinks added to meals during photo analysis are not being saved
- [x] Check if drink data is being sent from frontend to backend
- [x] Verify saveMeal procedure properly handles beverageVolumeMl and drink data
- [x] Check if hydration is being updated when meal with drink is logged
- [x] Fix drink data not appearing in nutrition history for meals
- [x] Test meal with drink logging end-to-end
- [x] Root cause: saveMeal was not passing nutrition data to createDrink function
- [x] Fixed by adding beverage nutrition fields to createDrink call in saveMeal procedure

## Drink Estimation Broken for Meal + Drink Logging (Jan 7, 2026)
- [x] Trace where drink estimation is called when logging meal with drink
- [x] Check if estimateBeverageMutation is being called correctly
- [x] Verify drink nutrition is being calculated before saveMeal is called
- [x] Check if beverageNutrition state is properly populated
- [x] Fix drink estimation to work correctly with meal logging
- [x] Ensure drink nutrition is saved to database
- [x] Test meal + drink logging end-to-end
- [x] Root cause: uploadAndAnalyze didn't accept or pass drink data to backend
- [x] Fixed by: (1) Adding drink fields to uploadAndAnalyze input schema, (2) Sending drink data from frontend with meal upload, (3) Ensuring drink estimation happens before meal upload

## Score Display Format Fix (Jan 7, 2026)
- [x] Find where nutrition history displays scores
- [x] Change score display from "X/10" to "X/5" format
- [x] Ensure consistency with post-analysis summary page
- [x] Test score display on nutrition history
- [x] Fixed NutritionHistoryFeed to display scores as /5 instead of /10

## Meal Logging Flow Redesign (Jan 7, 2026)
- [x] Create new AI procedure for item identification (returns list of items only)
- [x] Create meal item editing UI allowing users to modify detected items
- [x] Add beverage selection UI in the item editing screen
- [x] Create combined meal + drink analysis procedure
- [x] Implement final score calculation for complete meal
- [x] Update meal logging UI to follow new 6-step flow
- [x] Test new flow end-to-end
- [x] Verify meal and drink data are correctly logged to separate tables
- [x] Ensure final score reflects both meal and drink quality
- [x] All 4 unit tests passing (identifyItems, analyzeMealWithDrink with/without drink, separate table storage)

## Remove Beverage Estimation Popup (Jan 7, 2026)
- [x] Find where "Beverage estimation complete" popup is triggered
- [x] Remove the popup to make flow consistent with meal logging
- [x] Beverage estimation now works silently like meal logging
