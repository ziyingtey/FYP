import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import type { RootNavigation } from '../navigation/types';
import { userSession } from '../state/userSession';

export function HomeTabScreen({ navigation }: { navigation: RootNavigation }) {
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Welcome, {userSession.userName}</Text>
      <Text style={styles.sub}>
        Discover branches, view smart recommendations, and reserve tickets.
      </Text>
      <Pressable
        style={[styles.card, styles.cardSpacing]}
        onPress={() => navigation.navigate('BranchMap')}
      >
        <Text style={styles.cardTitle}>Branch Locator Map</Text>
        <Text style={styles.cardSub}>Detect location, show all branches, and jump to nearest</Text>
      </Pressable>
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate('BranchDiscovery')}
      >
        <Text style={styles.cardTitle}>Branch Discovery</Text>
        <Text style={styles.cardSub}>Location, wait times, and smart recommendation</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  sub: { color: '#555', marginBottom: 16 },
  card: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#fafafa',
  },
  cardSpacing: { marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSub: { color: '#666', marginTop: 4 },
});
