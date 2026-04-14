import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './src/navigation/types';
import { AuthScreen } from './src/screens/AuthScreen';
import { MainShellScreen } from './src/screens/MainShellScreen';
import { BranchMapScreen } from './src/screens/BranchMapScreen';
import { BranchDiscoveryScreen } from './src/screens/BranchDiscoveryScreen';
import { SlotBookingScreen } from './src/screens/SlotBookingScreen';
import { QueueMonitoringScreen } from './src/screens/QueueMonitoringScreen';
import { ProfileEditScreen } from './src/screens/ProfileEditScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName="Auth"
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerShadowVisible: true,
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="MainTabs"
          component={MainShellScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BranchMap"
          component={BranchMapScreen}
          options={{ title: 'Branch Locator' }}
        />
        <Stack.Screen
          name="BranchDiscovery"
          component={BranchDiscoveryScreen}
          options={{ title: 'Discover Branches' }}
        />
        <Stack.Screen
          name="SlotBooking"
          component={SlotBookingScreen}
          options={({ route }) => ({ title: route.params.branch.name })}
        />
        <Stack.Screen
          name="QueueMonitoring"
          component={QueueMonitoringScreen}
          options={{ title: 'Queue Monitoring' }}
        />
        <Stack.Screen name="Profile" component={ProfileEditScreen} options={{ title: 'Profile' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
