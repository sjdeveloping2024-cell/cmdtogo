import React from 'react';
import { Tabs, Link } from 'expo-router';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor:   Colors.accent,
      tabBarInactiveTintColor: Colors.grayLt,
      tabBarStyle: { backgroundColor: Colors.white, borderTopColor: Colors.border, paddingBottom:4, height:60 },
      headerStyle:      { backgroundColor: Colors.navy },
      headerTintColor:  Colors.white,
      headerTitleStyle: { fontWeight:'700' },
    }}>
      <Tabs.Screen name="index" options={{
        title: '📚 Pick-A-Book', tabBarLabel: 'Borrowed',
        tabBarIcon: ({ focused, color, size }) =>
          <Ionicons name={focused?'book':'book-outline'} size={size} color={color} />,
        headerRight: () => (
          <Link href="/modal" asChild>
            <Pressable style={{ marginRight:16 }}>
              <Ionicons name="information-circle-outline" size={22} color={Colors.white} />
            </Pressable>
          </Link>
        ),
      }} />
      <Tabs.Screen name="explore" options={{
        title: 'Borrow History', tabBarLabel: 'History',
        tabBarIcon: ({ focused, color, size }) =>
          <Ionicons name={focused?'time':'time-outline'} size={size} color={color} />,
      }} />
      <Tabs.Screen name="settings" options={{
        title: 'My Profile', tabBarLabel: 'Profile',
        tabBarIcon: ({ focused, color, size }) =>
          <Ionicons name={focused?'person':'person-outline'} size={size} color={color} />,
      }} />
    </Tabs>
  );
}