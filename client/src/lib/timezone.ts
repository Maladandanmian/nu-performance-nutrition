/**
 * Timezone utility for Hong Kong (Asia/Hong_Kong, GMT+8)
 */

/**
 * Get current date/time in Hong Kong timezone formatted for datetime-local input
 * @returns String in format YYYY-MM-DDTHH:mm
 */
export function getHongKongDateTimeLocal(): string {
  const now = new Date();
  // Convert to Hong Kong time (UTC+8)
  const hongKongTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
  
  const year = hongKongTime.getFullYear();
  const month = String(hongKongTime.getMonth() + 1).padStart(2, '0');
  const day = String(hongKongTime.getDate()).padStart(2, '0');
  const hours = String(hongKongTime.getHours()).padStart(2, '0');
  const minutes = String(hongKongTime.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert a Date object to Hong Kong timezone datetime-local format
 * @param date Date object to convert
 * @returns String in format YYYY-MM-DDTHH:mm
 */
export function toHongKongDateTimeLocal(date: Date): string {
  const hongKongTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
  
  const year = hongKongTime.getFullYear();
  const month = String(hongKongTime.getMonth() + 1).padStart(2, '0');
  const day = String(hongKongTime.getDate()).padStart(2, '0');
  const hours = String(hongKongTime.getHours()).padStart(2, '0');
  const minutes = String(hongKongTime.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Format a Date object for display in Hong Kong timezone
 * @param date Date object to format
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatHongKongDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Hong_Kong',
    ...options,
  });
}

/**
 * Get Hong Kong timezone offset in hours
 * @returns Always returns 8 (GMT+8)
 */
export function getHongKongOffset(): number {
  return 8;
}

/**
 * Convert datetime-local string (YYYY-MM-DDTHH:mm) to Date object in Hong Kong timezone
 * @param dateTimeLocal String in format YYYY-MM-DDTHH:mm
 * @returns Date object representing that time in Hong Kong timezone
 */
export function fromHongKongDateTimeLocal(dateTimeLocal: string): Date {
  // Parse the datetime-local string
  const [datePart, timePart] = dateTimeLocal.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  
  // Create a date string in Hong Kong timezone
  // We need to manually adjust for the timezone offset
  const hongKongDate = new Date(year, month - 1, day, hours, minutes);
  
  // Get the timezone offset difference between local and HK time
  const localOffset = hongKongDate.getTimezoneOffset(); // in minutes, negative for ahead of UTC
  const hongKongOffset = -480; // HK is UTC+8, which is -480 minutes from UTC
  
  // Adjust the date by the difference
  const offsetDiff = localOffset - hongKongOffset;
  hongKongDate.setMinutes(hongKongDate.getMinutes() - offsetDiff);
  
  return hongKongDate;
}
