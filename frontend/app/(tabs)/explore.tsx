import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { API } from '../../constants/config';
import { Colors, Spacing, Radius, FontSize } from '../../constants/theme';
import { useStudent } from '../../hooks/useStudentContext';

type HistoryItem = {
  id: number; book_title: string; author: string;
  borrow_date: string; due_date: string;
  return_date: string | null; status: string;
};

export default function ExploreScreen() {
  const { student }                 = useStudent();
  const [history,    setHistory]    = useState<HistoryItem[]>([]);
  const [fetching,   setFetching]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch_ = useCallback(async (isRefresh = false) => {
    if (!student) return;
    if (isRefresh) setRefreshing(true); else setFetching(true);
    try {
      const res  = await fetch(API.history(student.id));
      const data = await res.json();
      if (data.ok) setHistory(data.history);
    } catch {}
    finally { setFetching(false); setRefreshing(false); }
  }, [student]);

  useEffect(() => { fetch_(); }, [fetch_]);

  // ── Redirect AFTER all hooks ──
  if (!student) return <Redirect href="/" />;

  if (fetching) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={styles.loadingText}>Loading history…</Text>
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>fetch_(true)} tintColor={Colors.accent}/>}>
      <Text style={styles.pageTitle}>📋 Borrow History</Text>
      <Text style={styles.pageSub}>{history.length} returned book{history.length!==1?'s':''}</Text>

      {history.length===0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📜</Text>
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptySub}>Returned books will appear here.</Text>
        </View>
      ) : history.map(b => {
        const onTime = !b.return_date || b.return_date <= b.due_date;
        return (
          <View key={b.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle} numberOfLines={2}>{b.book_title}</Text>
                <Text style={styles.cardAuthor}>{b.author}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: onTime ? Colors.greenLt : Colors.redLt }]}>
                <Text style={[styles.badgeText, { color: onTime ? Colors.green : Colors.red }]}>
                  {onTime ? '✓ On Time' : '⚠ Late'}
                </Text>
              </View>
            </View>
            <View style={styles.metaGrid}>
              {[['Borrowed', b.borrow_date],['Due Date', b.due_date],['Returned', b.return_date ?? '—']].map(([lbl, val], i) => (
                <View key={lbl} style={styles.metaItem}>
                  <Text style={styles.metaLbl}>{lbl}</Text>
                  <Text style={[styles.metaVal, i===2 && {color: onTime ? Colors.green : Colors.red}]}>{val}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex:1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, paddingBottom:48 },
  center:  { flex:1, justifyContent:'center', alignItems:'center', backgroundColor: Colors.bg },
  loadingText: { marginTop:12, color: Colors.gray, fontSize: FontSize.sm },
  pageTitle: { fontSize: FontSize.xl,  fontWeight:'700', color: Colors.navy, marginBottom:2 },
  pageSub:   { fontSize: FontSize.sm, color: Colors.gray, marginBottom: Spacing.md },
  empty:     { backgroundColor: Colors.white, borderRadius: Radius.lg, padding:40, alignItems:'center' },
  emptyIcon: { fontSize:44, marginBottom:10 },
  emptyTitle:{ fontSize: FontSize.md, fontWeight:'700', color: Colors.navy, marginBottom:4 },
  emptySub:  { fontSize: FontSize.sm, color: Colors.gray },
  card:      { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm, shadowColor:'#000', shadowOpacity:.06, shadowRadius:8, shadowOffset:{width:0,height:2}, elevation:2 },
  cardHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 },
  cardTitleWrap:{ flex:1, marginRight:10 },
  cardTitle: { fontSize: FontSize.sm, fontWeight:'700', color: Colors.navy },
  cardAuthor:{ fontSize: FontSize.xs, color: Colors.gray, marginTop:2 },
  badge:     { paddingHorizontal:10, paddingVertical:4, borderRadius: Radius.full },
  badgeText: { fontSize: FontSize.xs, fontWeight:'700' },
  metaGrid:  { flexDirection:'row', gap: Spacing.sm },
  metaItem:  { flex:1, backgroundColor: Colors.bg, borderRadius: Radius.sm, padding: Spacing.sm },
  metaLbl:   { fontSize:10, color: Colors.gray, textTransform:'uppercase', letterSpacing:.4, marginBottom:3 },
  metaVal:   { fontSize: FontSize.xs, fontWeight:'600', color: Colors.navy },
});