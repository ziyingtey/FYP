import { getBackendBaseUrl } from '../config/apiBaseUrl';

export type RouteSummary = {
  branchId: number;
  branchName: string;
  straightLineKm: number;
  roadDistanceKm: number | null;
  roadDurationMinutes: number | null;
  usedGoogleRoutes: boolean;
  source: string;
  googleMapsUrl: string | null;
};

type RouteRequest = {
  branchId: number;
  userLat: number;
  userLng: number;
};

export async function computeRoute(payload: RouteRequest): Promise<RouteSummary> {
  const base = getBackendBaseUrl();
  const res = await fetch(`${base}/api/routes/compute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Route lookup failed (${res.status})`);
  }
  return (await res.json()) as RouteSummary;
}
