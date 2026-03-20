import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StudentProvider, useStudent } from '@/hooks/useStudentContext';
import { Colors } from '@/constants/theme';

function RootLayoutNav() {
  const { loading } = useStudent();
  if (loading) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor: Colors.navy }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }
  return (
    <Stack>
      <Stack.Screen name="index"  options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal"  options={{ presentation: 'modal', title: 'About' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <StudentProvider>
      <StatusBar style="light" />
      <RootLayoutNav />
    </StudentProvider>
  );
}
