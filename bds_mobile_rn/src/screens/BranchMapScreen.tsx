import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  Linking,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import type { RootStackParamList } from '../navigation/types';
import { branchPins, type BranchPin } from '../data/branches';
import { fetchBranches, type BranchListItem } from '../api/branchApi';
import { computeRoute, type RouteSummary } from '../api/routesApi';
import { getDistance } from '../utils/distance';
import { resolveBestLocation } from '../utils/location';
import type { Branch } from '../types/models';
import { waitLabelFromSource } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'BranchMap'>;

type LatLng = { latitude: number; longitude: number };

function mapApiBranch(branch: BranchListItem): Branch {
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
    crowdLevel,
    distanceKm: branch.distanceKm,
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

function fallbackBranchFromPin(pin: BranchPin): Branch {
  return {
    id: pin.id,
    name: pin.name,
    state: '',
    address: null,
    phone: null,
    placeId: null,
    latitude: pin.latitude,
    longitude: pin.longitude,
    crowdLevel: 'Low',
    distanceKm: 0,
    slotCapacity: 0,
    slotBooked: 0,
    waitingCount: 0,
    bookingDisabled: false,
    hasAvailableSlot: true,
    isOvercrowded: false,
    canBook: true,
    estimatedWaitMinutes: 0,
    estimateSource: 'logic',
  };
}

function defaultRegionFromBranches(branches: Branch[]): Region {
  const geocoded = branches.filter((branch) => branch.latitude != null && branch.longitude != null);
  if (geocoded.length === 0) {
    return { latitude: 3.14, longitude: 101.69, latitudeDelta: 0.35, longitudeDelta: 0.35 };
  }

  const latitude = geocoded.reduce((sum, branch) => sum + (branch.latitude as number), 0) / geocoded.length;
  const longitude =
    geocoded.reduce((sum, branch) => sum + (branch.longitude as number), 0) / geocoded.length;

  return {
    latitude,
    longitude,
    latitudeDelta: 4.2,
    longitudeDelta: 4.2,
  };
}

function distanceForBranch(branch: Branch, location: LatLng | null): number {
  if (location && branch.latitude != null && branch.longitude != null) {
    return getDistance(location.latitude, location.longitude, branch.latitude, branch.longitude);
  }
  return branch.distanceKm;
}

function findNearestBranch(branches: Branch[], location: LatLng | null): Branch | null {
  if (!location) {
    return null;
  }

  const geocoded = branches.filter((branch) => branch.latitude != null && branch.longitude != null);
  if (geocoded.length === 0) {
    return null;
  }

  return geocoded.reduce((best, branch) =>
    distanceForBranch(branch, location) < distanceForBranch(best, location) ? branch : best
  );
}

function fallbackGoogleMapsUrl(branch: Branch, location: LatLng | null): string | null {
  if (branch.latitude == null || branch.longitude == null) {
    return null;
  }

  const origin = location ? `&origin=${location.latitude},${location.longitude}` : '';
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${branch.latitude},${branch.longitude}&travelmode=driving`;
}

export function BranchMapScreen({ navigation }: Props) {
  const mapRef = useRef<MapView>(null);
  const [branches, setBranches] = useState<Branch[]>(branchPins.map(fallbackBranchFromPin));
  const [branchLoading, setBranchLoading] = useState(true);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [servicesOff, setServicesOff] = useState(false);
  const [locationSource, setLocationSource] = useState<'current' | 'lastKnown' | null>(null);
  const [search, setSearch] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const initialMapRegion = useMemo(() => defaultRegionFromBranches(branches), [branches]);

  const applyPosition = useCallback((latitude: number, longitude: number) => {
    setLocation({ latitude, longitude });
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      },
      600
    );
  }, []);

  const loadBranches = useCallback(async (userLocation?: LatLng | null) => {
    setBranchError(null);
    setBranchLoading(true);
    try {
      const list = await fetchBranches({
        userLat: userLocation?.latitude,
        userLng: userLocation?.longitude,
      });
      const mapped = list.map(mapApiBranch);
      if (mapped.length > 0) {
        setBranches(mapped);
        setSelectedBranchId((current) => current ?? mapped[0].id);
      } else {
        setBranches([]);
      }
    } catch (error) {
      setBranchError(error instanceof Error ? error.message : String(error));
      setBranches(branchPins.map(fallbackBranchFromPin));
      setSelectedBranchId((current) => current ?? branchPins[0]?.id ?? null);
    } finally {
      setBranchLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBranches(null);
  }, [loadBranches]);

  const loadLocation = useCallback(async () => {
    setLocationError(null);
    setServicesOff(false);
    setPermissionDenied(false);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        setPermissionGranted(false);
        setPermissionDenied(true);
        setLocationSource(null);
        setLocation(null);
        return;
      }
      setPermissionGranted(true);

      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setServicesOff(true);
        setLocationSource(null);
        setLocation(null);
        return;
      }

      const resolved = await resolveBestLocation();
      const nextLocation = {
        latitude: resolved.position.coords.latitude,
        longitude: resolved.position.coords.longitude,
      };
      setLocationSource(resolved.source);
      applyPosition(nextLocation.latitude, nextLocation.longitude);
      await loadBranches(nextLocation);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : String(error));
      setLocationSource(null);
      setLocation(null);
    } finally {
      setLocating(false);
    }
  }, [applyPosition, loadBranches]);

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  const nearestBranch = useMemo(() => findNearestBranch(branches, location), [branches, location]);

  useEffect(() => {
    if (selectedBranchId != null) {
      return;
    }
    if (nearestBranch) {
      setSelectedBranchId(nearestBranch.id);
    } else if (branches[0]) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, nearestBranch, selectedBranchId]);

  const filteredBranches = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const withDistance = branches.map((branch) => ({
      branch,
      distanceKm: distanceForBranch(branch, location),
    }));

    withDistance.sort(
      (left, right) => left.distanceKm - right.distanceKm || left.branch.name.localeCompare(right.branch.name)
    );

    if (!normalized) {
      return withDistance;
    }

    return withDistance.filter(({ branch }) =>
      [branch.name, branch.state, branch.address ?? '', branch.phone ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [branches, location, search]);

  const selectedBranch =
    branches.find((branch) => branch.id === selectedBranchId) ?? nearestBranch ?? branches[0] ?? null;

  const focusBranch = useCallback((branch: Branch) => {
    setSelectedBranchId(branch.id);
    if (branch.latitude != null && branch.longitude != null) {
      mapRef.current?.animateToRegion(
        {
          latitude: branch.latitude,
          longitude: branch.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        },
        600
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRoute = async () => {
      if (!selectedBranch || !location || selectedBranch.latitude == null || selectedBranch.longitude == null) {
        setRouteSummary(null);
        setRouteError(null);
        return;
      }

      setRouteLoading(true);
      setRouteError(null);
      try {
        const summary = await computeRoute({
          branchId: selectedBranch.id,
          userLat: location.latitude,
          userLng: location.longitude,
        });
        if (!cancelled) {
          setRouteSummary(summary);
        }
      } catch (error) {
        if (!cancelled) {
          setRouteSummary(null);
          setRouteError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setRouteLoading(false);
        }
      }
    };

    loadRoute();
    return () => {
      cancelled = true;
    };
  }, [location, selectedBranch]);

  const openGoogleMaps = useCallback(async () => {
    if (!selectedBranch) {
      return;
    }

    const url = routeSummary?.googleMapsUrl ?? fallbackGoogleMapsUrl(selectedBranch, location);
    if (!url) {
      return;
    }
    await Linking.openURL(url);
  }, [location, routeSummary, selectedBranch]);

  const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={mapProvider}
        initialRegion={initialMapRegion}
        showsUserLocation={permissionGranted}
        showsMyLocationButton={permissionGranted}
      >
        {location ? <Marker coordinate={location} title="You are here" pinColor="#1565C0" /> : null}
        {branches
          .filter((branch) => branch.latitude != null && branch.longitude != null)
          .map((branch) => {
            const pinColor =
              branch.id === selectedBranch?.id ? '#D84315' : branch.id === nearestBranch?.id ? '#2E7D32' : undefined;

            return (
              <Marker
                key={branch.id}
                coordinate={{ latitude: branch.latitude as number, longitude: branch.longitude as number }}
                title={branch.name}
                description={branch.address ?? branch.state}
                pinColor={pinColor}
                onPress={() => focusBranch(branch)}
              />
            );
          })}
      </MapView>

      <View style={styles.topPanel}>
        <Text style={styles.panelTitle}>Branch Locator</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search branch, state, address"
          placeholderTextColor="#888"
          style={styles.searchInput}
        />
        <View style={styles.actionRow}>
          <Pressable style={styles.primaryBtn} onPress={loadLocation}>
            <Text style={styles.primaryBtnText}>Detect My Location</Text>
          </Pressable>
          {nearestBranch ? (
            <Pressable style={styles.secondaryBtn} onPress={() => focusBranch(nearestBranch)}>
              <Text style={styles.secondaryBtnText}>Go to Nearest</Text>
            </Pressable>
          ) : null}
        </View>
        {locating ? (
          <View style={styles.inlineRow}>
            <ActivityIndicator color="#3F51B5" />
            <Text style={styles.inlineText}>Finding your location...</Text>
          </View>
        ) : null}
        {location ? (
          <Text style={styles.helperText}>
            GPS: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} ·{' '}
            {locationSource === 'lastKnown' ? 'cached device location' : 'live device location'}
          </Text>
        ) : null}
        {permissionDenied ? <Text style={styles.errorText}>Location permission is off.</Text> : null}
        {servicesOff ? <Text style={styles.errorText}>Turn on device GPS/location services.</Text> : null}
        {locationError && !permissionDenied && !servicesOff ? <Text style={styles.errorText}>{locationError}</Text> : null}
        {branchError ? <Text style={styles.errorText}>API fallback mode: {branchError}</Text> : null}
      </View>

      <View style={styles.bottomSheet}>
        {selectedBranch ? (
          <View style={styles.selectedCard}>
            <Text style={styles.selectedTitle}>{selectedBranch.name}</Text>
            <Text style={styles.selectedMeta}>
              {(selectedBranch.address ?? selectedBranch.state) || 'Branch details available after import'}
            </Text>
            <Text style={styles.selectedMeta}>
              Straight line: {distanceForBranch(selectedBranch, location).toFixed(2)} km · wait ~
              {Math.round(selectedBranch.estimatedWaitMinutes)} min ({waitLabelFromSource(selectedBranch.estimateSource)})
            </Text>
            {routeLoading ? <Text style={styles.selectedMeta}>Loading route distance...</Text> : null}
            {routeSummary ? (
              <>
                <Text style={styles.selectedMeta}>
                  Road: {(routeSummary.roadDistanceKm ?? routeSummary.straightLineKm).toFixed(2)} km ·{' '}
                  {routeSummary.roadDurationMinutes != null
                    ? `${Math.round(routeSummary.roadDurationMinutes)} min`
                    : 'duration unavailable'}
                </Text>
                <Text style={styles.selectedMeta}>
                  Route source: {routeSummary.usedGoogleRoutes ? 'Google Routes' : 'Fallback straight-line distance'}
                </Text>
              </>
            ) : null}
            {routeError ? <Text style={styles.errorText}>Route info: {routeError}</Text> : null}
            <View style={styles.actionRow}>
              {nearestBranch && selectedBranch.id !== nearestBranch.id ? (
                <Pressable style={styles.secondaryBtn} onPress={() => focusBranch(nearestBranch)}>
                  <Text style={styles.secondaryBtnText}>Use Nearest</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.secondaryBtn} onPress={openGoogleMaps}>
                <Text style={styles.secondaryBtnText}>Open in Google Maps</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, !selectedBranch.canBook && styles.disabledBtn]}
                disabled={!selectedBranch.canBook}
                onPress={() => navigation.navigate('SlotBooking', { branch: selectedBranch })}
              >
                <Text style={styles.primaryBtnText}>
                  {selectedBranch.canBook ? 'Choose This Branch' : 'Booking Unavailable'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={styles.listTitle}>
          {branchLoading ? 'Loading branches...' : `All branches on map (${filteredBranches.length})`}
        </Text>
        <ScrollView style={styles.branchList} contentContainerStyle={styles.branchListContent}>
          {filteredBranches.map(({ branch, distanceKm }) => (
            <Pressable
              key={branch.id}
              style={[styles.branchRow, branch.id === selectedBranch?.id && styles.branchRowActive]}
              onPress={() => focusBranch(branch)}
            >
              <View style={styles.branchRowText}>
                <Text style={styles.branchName}>{branch.name}</Text>
                <Text style={styles.branchMeta}>
                  {branch.state ? `${branch.state} · ` : ''}
                  {distanceKm.toFixed(2)} km
                  {branch.address ? ` · ${branch.address}` : ''}
                </Text>
              </View>
              {nearestBranch?.id === branch.id ? <Text style={styles.nearestBadge}>Nearest</Text> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  topPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.97)',
    padding: 12,
    borderRadius: 14,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  panelTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#111' },
  searchInput: {
    backgroundColor: '#F4F6FB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111',
    marginBottom: 10,
  },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  primaryBtn: {
    backgroundColor: '#3F51B5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
  secondaryBtn: {
    backgroundColor: '#E8EAF6',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryBtnText: { color: '#3F51B5', fontWeight: '600' },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  inlineText: { color: '#333', fontSize: 13 },
  helperText: { color: '#555', fontSize: 12, marginTop: 8 },
  errorText: { color: '#B00020', fontSize: 12, marginTop: 8 },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    maxHeight: '50%',
  },
  selectedCard: {
    backgroundColor: '#F8F9FD',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  selectedTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4 },
  selectedMeta: { color: '#555', fontSize: 13, marginTop: 2 },
  listTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 8 },
  branchList: { flexGrow: 0 },
  branchListContent: { paddingBottom: 24 },
  branchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  branchRowActive: { backgroundColor: '#F4F6FB' },
  branchRowText: { flex: 1, paddingRight: 8 },
  branchName: { fontSize: 14, fontWeight: '600', color: '#111' },
  branchMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  nearestBadge: {
    color: '#2E7D32',
    fontWeight: '700',
    fontSize: 12,
  },
  disabledBtn: { opacity: 0.5 },
});
