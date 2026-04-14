import * as Location from 'expo-location';

const LOCATION_TIMEOUT_MS = 20000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      }
    );
  });
}

export type ResolvedLocation = {
  position: Location.LocationObject;
  source: 'current' | 'lastKnown';
};

/**
 * Prefer a fresh GPS/network fix first, then fall back to a recent cached fix.
 * This reduces "nearest branch" errors caused by stale emulator/device coordinates.
 */
export async function resolveBestLocation(): Promise<ResolvedLocation> {
  try {
    const current = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }),
      LOCATION_TIMEOUT_MS,
      'Location timed out. Try outdoors, enable device location, or set a mock location on the emulator.'
    );
    return { position: current, source: 'current' };
  } catch {
    const fallback = await Location.getLastKnownPositionAsync({
      maxAge: 120_000,
      requiredAccuracy: 500,
    });

    if (fallback) {
      return { position: fallback, source: 'lastKnown' };
    }

    const lowAccuracy = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      LOCATION_TIMEOUT_MS,
      'Location still unavailable.'
    );

    return { position: lowAccuracy, source: 'current' };
  }
}
