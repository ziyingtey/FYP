import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchBranches, type BranchListItem } from '../api/branchApi';
import type { RootStackParamList } from '../navigation/types';
import type { Branch } from '../types/models';
import { waitLabelFromSource } from '../types/models';
import { userSession } from '../state/userSession';
import { MALAYSIAN_STATES } from '../data/malaysianStates';
import { resolveBestLocation } from '../utils/location';

type Props = NativeStackScreenProps<RootStackParamList, 'BranchDiscovery'>;

function mapBranch(branch: BranchListItem): Branch {
  const crowdLevel: Branch['crowdLevel'] =
    branch.crowdLevel === 'Low' ||
    branch.crowdLevel === 'Moderate' ||
    branch.crowdLevel === 'High'
      ? branch.crowdLevel
      : 'Low';

  return {
    id: branch.id,
    name: branch.name,
    state: branch.state ?? '',
    address: branch.address ?? null,
    phone: branch.phone ?? null,
    placeId: branch.placeId ?? null,
    latitude: branch.latitude ?? null,
    longitude: branch.longitude ?? null,
    distanceKm: branch.distanceKm,
    crowdLevel,
    slotCapacity: branch.slotCapacity,
    slotBooked: branch.slotBooked,
    waitingCount: branch.waitingCount,
    bookingDisabled: branch.bookingDisabled,
    hasAvailableSlot: branch.hasAvailableSlot,
    isOvercrowded: branch.isOvercrowded,
    canBook: branch.canBook,
    estimatedWaitMinutes: branch.estimatedWaitMinutes,
    estimateSource: branch.estimateSource,
  };
}

function formatGeocodedPlace(address: Location.LocationGeocodedAddress): string {
  const chunks = [address.city, address.district, address.subregion, address.region].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );
  const uniq = [...new Set(chunks)];
  if (uniq.length > 0) {
    return uniq.join(' · ');
  }
  if (address.name) {
    return address.name;
  }
  return '';
}

export function BranchDiscoveryScreen({ navigation }: Props) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null);
  const [detectedCoords, setDetectedCoords] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [locationSource, setLocationSource] = useState<'current' | 'lastKnown' | null>(null);
  const [userGps, setUserGps] = useState<{ lat: number; lng: number } | null>(null);
  const [stateFilter, setStateFilter] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const raw = await fetchBranches({
        state: stateFilter,
        userLat: userGps?.lat,
        userLng: userGps?.lng,
      });
      setBranches(raw.map(mapBranch));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [stateFilter, userGps]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLocationLoading(true);
      setLocationHint(null);
      setDetectedLabel(null);
      setDetectedCoords(null);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) {
          return;
        }
        if (status !== Location.PermissionStatus.GRANTED) {
          setLocationSource(null);
          setLocationHint('Allow location to show where you are now.');
          return;
        }

        const servicesOn = await Location.hasServicesEnabledAsync();
        if (!servicesOn) {
          setLocationSource(null);
          setLocationHint('Turn on GPS/location in system settings.');
          return;
        }

        const resolved = await resolveBestLocation();
        if (cancelled) {
          return;
        }

        const { latitude, longitude } = resolved.position.coords;
        setUserGps({ lat: latitude, lng: longitude });
        setLocationSource(resolved.source);
        setDetectedCoords(`${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°`);

        try {
          const places = await Location.reverseGeocodeAsync({ latitude, longitude });
          const first = places[0];
          const place = first ? formatGeocodedPlace(first) : '';
          setDetectedLabel(place || 'Location acquired');
        } catch {
          setDetectedLabel('Location acquired');
        }
      } catch (locationError) {
        if (!cancelled) {
          setLocationSource(null);
          setLocationHint(locationError instanceof Error ? locationError.message : String(locationError));
        }
      } finally {
        if (!cancelled) {
          setLocationLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const waitFor = (branch: Branch) => ({
    mins: Math.round(branch.estimatedWaitMinutes),
    label: waitLabelFromSource(branch.estimateSource),
  });

  const candidates = useMemo(() => branches.filter((branch) => branch.canBook), [branches]);

  const recommended = useMemo(() => {
    if (branches.length === 0) {
      return null;
    }
    const pool = candidates.length > 0 ? candidates : branches;
    return pool.reduce((best, branch) => (waitFor(branch).mins <= waitFor(best).mins ? branch : best));
  }, [branches, candidates]);

  const recWait = recommended ? waitFor(recommended) : null;

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.hi}>Hi, {userSession.userName}</Text>
      <Text style={styles.muted}>Your location (from device GPS):</Text>
      <View style={styles.chip}>
        {locationLoading ? (
          <View style={styles.chipLoadingRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.chipText}> Detecting...</Text>
          </View>
        ) : locationHint ? (
          <Text style={styles.chipText}>{locationHint}</Text>
        ) : (
          <>
            <Text style={styles.chipTitle}>{detectedLabel ?? 'Unknown'}</Text>
            {detectedCoords ? <Text style={styles.chipCoords}>{detectedCoords}</Text> : null}
            {locationSource ? (
              <Text style={styles.chipCoords}>
                Fix source: {locationSource === 'lastKnown' ? 'cached device location' : 'live device location'}
              </Text>
            ) : null}
          </>
        )}
      </View>
      <Text style={styles.locationNote}>
        Distances use your current GPS coordinates when available. If you see "cached device location", refresh the
        screen or set a mock location in the emulator before trusting the nearest branch result.
      </Text>
      <Pressable onPress={() => Linking.openURL('https://www.pbebank.com/en/branch-locator/')}>
        <Text style={styles.officialLink}>Official PBE branch locator (reference for real addresses)</Text>
      </Pressable>

      <Text style={styles.filterLabel}>State / territory</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stateScroll}>
        <Pressable
          style={[styles.stateChip, !stateFilter && styles.stateChipOn]}
          onPress={() => setStateFilter(undefined)}
        >
          <Text style={[styles.stateChipText, !stateFilter && styles.stateChipTextOn]}>All</Text>
        </Pressable>
        {MALAYSIAN_STATES.map((state) => (
          <Pressable
            key={state}
            style={[styles.stateChip, stateFilter === state && styles.stateChipOn]}
            onPress={() => setStateFilter(state)}
          >
            <Text style={[styles.stateChipText, stateFilter === state && styles.stateChipTextOn]}>{state}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.muted}> Loading branches...</Text>
        </View>
      ) : null}

      {error ? (
        <Text style={styles.err}>
          {error}
          {'\n'}
          <Text style={styles.errHint}>Check backend URL and that SQL Server is running.</Text>
        </Text>
      ) : null}

      {recommended && recWait ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Smart Branch Recommendation</Text>
          <Text style={styles.cardSub}>
            {recommended.name} · {recommended.distanceKm.toFixed(1)} km · ~{recWait.mins} mins ({recWait.label})
          </Text>
        </View>
      ) : null}

      <Text style={styles.section}>Branches{stateFilter ? ` - ${stateFilter}` : ' - all states'}</Text>
      {branches.map((branch) => (
        <BranchCard
          key={branch.id}
          branch={branch}
          waitInfo={waitFor(branch)}
          onBook={() => navigation.navigate('SlotBooking', { branch })}
        />
      ))}
    </ScrollView>
  );
}

function BranchCard({
  branch,
  waitInfo,
  onBook,
}: {
  branch: Branch;
  waitInfo: { mins: number; label: string };
  onBook: () => void;
}) {
  const blocked = !branch.canBook;
  let badge = 'Available';
  let badgeBg = '#DFF5E3';
  if (branch.bookingDisabled || branch.isOvercrowded) {
    badge = 'Overcrowded';
    badgeBg = '#FFE0E0';
  } else if (!branch.hasAvailableSlot) {
    badge = 'Slots Full';
    badgeBg = '#FFF3CD';
  }

  return (
    <View style={styles.branchCard}>
      <View style={styles.branchRow}>
        <Text style={styles.branchName}>{branch.name}</Text>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      </View>
      {branch.address ? <Text style={styles.addr}>{branch.address}</Text> : null}
      {branch.phone ? <Text style={styles.phone}>{branch.phone}</Text> : null}
      <Text style={styles.muted}>
        {branch.state ? `${branch.state} · ` : ''}
        {branch.distanceKm.toFixed(1)} km · Waiting: {branch.waitingCount} · Est. wait ~{waitInfo.mins} min (
        {waitInfo.label})
      </Text>
      <Pressable style={[styles.bookBtn, blocked && styles.bookBtnDisabled]} onPress={onBook} disabled={blocked}>
        <Text style={styles.bookBtnText}>
          {branch.bookingDisabled || branch.isOvercrowded
            ? 'Temporarily Unavailable'
            : !branch.hasAvailableSlot
              ? 'All Slots Full'
              : 'Reserve Queue Ticket'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 32 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  err: { color: '#b00020', marginBottom: 12 },
  errHint: { color: '#666', fontSize: 12 },
  hi: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  muted: { color: '#666', marginBottom: 4 },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: '#eee',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 8,
    maxWidth: '100%',
  },
  chipLoadingRow: { flexDirection: 'row', alignItems: 'center' },
  chipText: { color: '#333', fontSize: 14 },
  chipTitle: { fontWeight: '600', fontSize: 14, color: '#111' },
  chipCoords: { fontSize: 12, color: '#555', marginTop: 4 },
  locationNote: { fontSize: 11, color: '#888', marginBottom: 8, fontStyle: 'italic' },
  officialLink: {
    fontSize: 12,
    color: '#3F51B5',
    textDecorationLine: 'underline',
    marginBottom: 14,
  },
  filterLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, color: '#333' },
  stateScroll: { marginBottom: 14, maxHeight: 40 },
  stateChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#eee',
    marginRight: 8,
  },
  stateChipOn: { backgroundColor: '#3F51B5' },
  stateChipText: { fontSize: 13, color: '#444' },
  stateChipTextOn: { color: '#fff', fontWeight: '600' },
  addr: { fontSize: 13, color: '#444', marginBottom: 4 },
  phone: { fontSize: 13, color: '#555', marginBottom: 4 },
  card: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  cardTitle: { fontWeight: '600', marginBottom: 4 },
  cardSub: { color: '#555' },
  section: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  branchCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  branchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  branchName: { fontWeight: '600', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12 },
  bookBtn: {
    marginTop: 10,
    backgroundColor: '#E8EAF6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookBtnDisabled: { opacity: 0.5 },
  bookBtnText: { color: '#3F51B5', fontWeight: '600' },
});
