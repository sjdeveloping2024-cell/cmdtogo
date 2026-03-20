import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SocketStatus } from '@/hooks/useSocket';

export default function SocketIndicator({ status }: { status: SocketStatus }) {
  const color = status === 'connected' ? '#22c55e' : status === 'connecting' ? '#f59e0b' : '#94a3b8';
  const label = status === 'connected' ? 'Live'    : status === 'connecting' ? '...'     : 'Off';
  return (
    <View style={styles.wrap}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  { flexDirection:'row', alignItems:'center', gap:4, marginRight:14 },
  dot:   { width:7, height:7, borderRadius:4 },
  label: { fontSize:11, fontWeight:'700' },
});
