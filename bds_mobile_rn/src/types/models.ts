/** Mirrors GET /api/branches (live data). */
export type Branch = {
  id: number;
  name: string;
  state: string;
  address: string | null;
  phone: string | null;
  placeId?: string | null;
  latitude: number | null;
  longitude: number | null;
  crowdLevel: 'Low' | 'Moderate' | 'High';
  distanceKm: number;
  slotCapacity: number;
  slotBooked: number;
  waitingCount: number;
  bookingDisabled: boolean;
  hasAvailableSlot: boolean;
  isOvercrowded: boolean;
  canBook: boolean;
  estimatedWaitMinutes: number;
  estimateSource: string;
};

export type TimeSlot = {
  label: string;
  capacity: number;
  booked: number;
};

export type QueueTicket = {
  ticketId: number;
  branchId: number;
  branchName: string;
  serviceName: string;
  slotLabel: string;
  queueNumber: string;
};

export function waitLabelFromSource(source: string): string {
  if (source === 'sklearn') return 'ML model';
  if (source === 'logic') return 'no queue';
  return 'estimate';
}
