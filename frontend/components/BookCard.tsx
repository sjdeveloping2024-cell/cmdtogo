import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';
import { useCountdown } from '@/hooks/useCountdown';

export type Borrow = {
  id: number; book_title: string; author: string;
  borrow_date: string; due_date: string;
  seconds_remaining?: number;
};

export default function BookCard({ borrow }: { borrow: Borrow }) {
  const { formatted, status } = useCountdown(borrow.due_date);

  const borderColor = status==='overdue' ? Colors.red    : status==='soon' ? Colors.yellow    : Colors.green;
  const timerColor  = status==='overdue' ? Colors.red    : status==='soon' ? Colors.yellow    : Colors.green;
  const badgeBg     = status==='overdue' ? Colors.redLt  : status==='soon' ? Colors.yellowLt  : Colors.greenLt;
  const badgeColor  = status==='overdue' ? Colors.red    : status==='soon' ? Colors.yellow    : Colors.green;
  const badgeLabel  = status==='overdue' ? 'Overdue'     : status==='soon' ? 'Due Soon'       : 'On Time';

  return (
    <View style={[styles.card, { borderTopColor: borderColor }]}>
      <Text style={styles.title} numberOfLines={2}>{borrow.book_title}</Text>
      <Text style={styles.author}>{borrow.author}</Text>
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLbl}>Borrowed</Text>
          <Text style={styles.metaVal}>{borrow.borrow_date}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLbl}>Due Date</Text>
          <Text style={styles.metaVal}>{borrow.due_date}</Text>
        </View>
      </View>
      <View style={styles.timerBox}>
        <Text style={styles.timerLbl}>⏱  Time Remaining</Text>
        <Text style={[styles.timerVal, { color: timerColor }]}>{formatted}</Text>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md, borderTopWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width:0, height:2 }, elevation: 3,
  },
  title:   { fontSize: FontSize.md,  fontWeight:'700', color: Colors.navy, marginBottom: 3 },
  author:  { fontSize: FontSize.xs,  color: Colors.gray, marginBottom: Spacing.md },
  metaRow: { flexDirection:'row', gap: Spacing.sm, marginBottom: Spacing.md },
  metaItem:{ flex:1, backgroundColor: Colors.bg, borderRadius: Radius.sm, padding: Spacing.sm+2 },
  metaLbl: { fontSize: 10, color: Colors.gray, textTransform:'uppercase', letterSpacing:.5, marginBottom:3 },
  metaVal: { fontSize: FontSize.sm, fontWeight:'600', color: Colors.navy },
  timerBox:{ backgroundColor:'#f8fafc', borderRadius: Radius.md, padding: Spacing.md, alignItems:'center' },
  timerLbl:{ fontSize: FontSize.xs, color: Colors.gray, textTransform:'uppercase', letterSpacing:.6, marginBottom:6 },
  timerVal:{ fontSize: FontSize.xxl, fontWeight:'700', letterSpacing:1 },
  badge:   { marginTop: Spacing.sm, paddingHorizontal:12, paddingVertical:4, borderRadius: Radius.full },
  badgeText:{ fontSize: FontSize.xs, fontWeight:'700', textTransform:'uppercase', letterSpacing:.5 },
});
