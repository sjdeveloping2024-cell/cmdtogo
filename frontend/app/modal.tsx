import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';

export default function ModalScreen() {
  return (
    <ScrollView style={{ flex:1, backgroundColor: Colors.bg }} contentContainerStyle={{ padding: Spacing.lg, alignItems:'center', paddingBottom:60 }}>
      <Text style={{ fontSize:56, marginBottom:12, marginTop: Spacing.md }}>📚</Text>
      <Text style={{ fontSize:24, fontWeight:'700', color: Colors.navy }}>Pick-A-Book</Text>
      <Text style={{ fontSize: FontSize.xs, color: Colors.gray, marginBottom: Spacing.lg }}>Student App — v2.0.0 (Socket.IO)</Text>
      {[
        ['About', 'Pick-A-Book is a library management system. Students can track borrowed books, view live due-date countdowns, and get real-time push notifications when books become overdue.'],
        ['Socket.IO', 'The app maintains a live WebSocket connection to the Flask server. When a librarian borrows or returns a book for you, your borrowed list updates instantly — no refresh needed.'],
        ['Features', '📖 View borrowed books\n⏱ Live countdown timers\n🔴 Overdue push notifications\n📋 Borrow history\n✏️ Edit your profile'],
        ['Default Due Period', '14 days from borrow date.'],
      ].map(([heading, body]) => (
        <View key={heading} style={{ backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, width:'100%', marginBottom: Spacing.md, shadowColor:'#000', shadowOpacity:.05, shadowRadius:8, shadowOffset:{width:0,height:2}, elevation:2 }}>
          <Text style={{ fontSize: FontSize.md, fontWeight:'700', color: Colors.navy, marginBottom: Spacing.sm }}>{heading}</Text>
          <Text style={{ fontSize: FontSize.sm, color: Colors.gray, lineHeight:22 }}>{body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
