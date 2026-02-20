import * as db from './db';

/**
 * Generate recurring training sessions based on a weekly pattern
 * @param params Configuration for recurring session generation
 * @returns Array of created session IDs
 */
export async function generateRecurringSessions(params: {
  trainerId: number;
  clientId: number;
  sessionType: '1on1_pt' | '2on1_pt' | 'nutrition_initial' | 'nutrition_coaching';
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  paymentStatus: 'paid' | 'unpaid' | 'from_package';
  packageId?: number;
  notes?: string;
  // Recurring pattern
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format
  daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}): Promise<number[]> {
  const sessionIds: number[] = [];
  
  // Parse dates
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);
  
  // Validate dates
  if (start > end) {
    throw new Error('Start date must be before end date');
  }
  
  if (params.daysOfWeek.length === 0) {
    throw new Error('At least one day of the week must be selected');
  }
  
  // Generate sessions for each occurrence
  const current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    
    // Check if this day is in the selected days
    if (params.daysOfWeek.includes(dayOfWeek)) {
      const sessionDate = current.toISOString().split('T')[0];
      
      // Create the session
      const session = await db.createTrainingSession({
        trainerId: params.trainerId,
        clientId: params.clientId,
        sessionType: params.sessionType,
        sessionDate,
        startTime: params.startTime,
        endTime: params.endTime,
        paymentStatus: params.paymentStatus,
        packageId: params.packageId || null,
        notes: params.notes || null,
        recurringRuleId: null, // Will be updated after creating the rule
        cancelled: false,
        cancelledAt: null,
      } as any);
      
      sessionIds.push(session.id);
      
      // If using package, checkout one session
      if (params.paymentStatus === 'from_package' && params.packageId) {
        await db.checkoutSessionFromPackage(params.packageId);
      }
    }
    
    // Move to next day
    current.setDate(current.getDate() + 1);
  }
  
  return sessionIds;
}

/**
 * Generate recurring group classes based on a weekly pattern
 * @param params Configuration for recurring group class generation
 * @returns Array of created class IDs
 */
export async function generateRecurringGroupClasses(params: {
  trainerId: number;
  classType: 'hyrox' | 'mobility' | 'rehab' | 'conditioning' | 'strength_conditioning';
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  capacity: number;
  notes?: string;
  // Recurring pattern
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format
  daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}): Promise<number[]> {
  const classIds: number[] = [];
  
  // Parse dates
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);
  
  // Validate dates
  if (start > end) {
    throw new Error('Start date must be before end date');
  }
  
  if (params.daysOfWeek.length === 0) {
    throw new Error('At least one day of the week must be selected');
  }
  
  // Generate classes for each occurrence
  const current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    
    // Check if this day is in the selected days
    if (params.daysOfWeek.includes(dayOfWeek)) {
      const classDate = current.toISOString().split('T')[0];
      
      // Create the group class
      const groupClass = await db.createGroupClass({
        trainerId: params.trainerId,
        classType: params.classType,
        classDate,
        startTime: params.startTime,
        endTime: params.endTime,
        capacity: params.capacity,
        notes: params.notes || null,
        recurringRuleId: null, // Will be updated after creating the rule
      } as any);
      
      classIds.push(groupClass.id);
    }
    
    // Move to next day
    current.setDate(current.getDate() + 1);
  }
  
  return classIds;
}

/**
 * Helper function to get day names from day numbers
 */
export function getDayNames(daysOfWeek: number[]): string[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return daysOfWeek.map(day => dayNames[day]);
}

/**
 * Helper function to validate time range (5am - 9pm)
 */
export function validateOperatingHours(startTime: string, endTime: string): boolean {
  const [startHour] = startTime.split(':').map(Number);
  const [endHour] = endTime.split(':').map(Number);
  
  // Operating hours: 5am (05:00) to 9pm (21:00)
  if (startHour < 5 || startHour >= 21) {
    return false;
  }
  
  if (endHour < 5 || endHour > 21) {
    return false;
  }
  
  if (startHour >= endHour) {
    return false;
  }
  
  return true;
}
