import { getBackendBaseUrl } from '../config/apiBaseUrl';

export type BranchListItem = {
  id: number;
  name: string;
  /** Present after backend branch-directory update. */
  state?: string;
  address?: string | null;
  phone?: string | null;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm: number;
  crowdLevel: string;
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

export type BranchTimeSlotRow = {
  label: string;
  capacity: number;
  booked: number;
};

export type FetchBranchesParams = {
  /** Exact state label, e.g. "Johor" (same as PBE branch locator). */
  state?: string;
  userLat?: number;
  userLng?: number;
};

export async function fetchBranches(params?: FetchBranchesParams): Promise<BranchListItem[]> {
  const base = getBackendBaseUrl();
  const q = new URLSearchParams();
  if (params?.state) q.set('state', params.state);
  if (params?.userLat != null) q.set('userLat', String(params.userLat));
  if (params?.userLng != null) q.set('userLng', String(params.userLng));
  const qs = q.toString();
  const res = await fetch(`${base}/api/branches${qs ? `?${qs}` : ''}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Branches failed (${res.status})`);
  }
  return (await res.json()) as BranchListItem[];
}

export async function fetchBranchSlots(branchId: number): Promise<BranchTimeSlotRow[]> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/branches/${branchId}/slots`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Slots failed (${res.status})`);
  }
  return (await res.json()) as BranchTimeSlotRow[];
}
