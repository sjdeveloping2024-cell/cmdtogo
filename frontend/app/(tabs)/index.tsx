import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Redirect } from 'expo-router';
import { io } from 'socket.io-client';

import { API, SOCKET_URL }    from '../../constants/config';
import { Colors, Spacing, Radius, FontSize } from '../../constants/theme';
import { useStudent }          from '../../hooks/useStudentContext';
import BookCard, { Borrow }   from '../../components/BookCard';
import NotificationBanner      from '../../components/NotificationBanner';
import SocketIndicator         from '../../components/SocketStatus';
import { scheduleDueNotifications, BorrowForNotif } from '../../components/notifications';

type SocketStatus = 'connecting' | 'connected' | 'disconnected';

export default function DashboardScreen() {
  const { student }                     = useStudent();
  const [borrows,    setBorrows]        = useState<Borrow[]>([]);
  const [fetching,   setFetching]       = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connecting');
  const socketRef                       = useRef<any>(null);

  const fetchBorrows = useCallback(async (isRefresh = false) => {
    if (!student) return;
    if (isRefresh) setRefreshing(true); else setFetching(true);
    try {
      const res  = await fetch(API.borrows(student.id));
      const data = await res.json();
      if (data.ok) {
        setBorrows(data.borrows);
        await scheduleDueNotifications(data.borrows as BorrowForNotif[]);
      }
    } catch {}
    finally { setFetching(false); setRefreshing(false); }
  }, [student]);

  useEffect(() => { fetchBorrows(); }, [fetchBorrows]);

  useEffect(() => {
    const id = setInterval(() => fetchBorrows(true), 300_000);
    return () => clearInterval(id);
  }, [fetchBorrows]);

  useEffect(() => {
    if (!student) return;
    const socket = io(SOCKET_URL, {
      transports: ['polling'],       // polling only — no WebSocket (Python 3.14 compatible)
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      setSocketStatus('connected');
      socket.emit('join_student_room', { student_id: student.id });
    });
    socket.on('disconnect',    () => setSocketStatus('disconnected'));
    socket.on('connect_error', () => setSocketStatus('disconnected'));
    socket.on('student_borrows_update', (data: { borrows: Borrow[] }) => {
      setBorrows(data.borrows);
      scheduleDueNotifications(data.borrows as BorrowForNotif[]);
    });
    return () => { socket.disconnect(); };
  }, [student]);

  // ── Redirect AFTER all hooks ──
  if (!student) return <Redirect href="/" />;

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading your books…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => fetchBorrows(true)} tintColor={Colors.accent} />
      }
    >
      <View style={{ alignItems:'flex-end', marginBottom: Spacing.xs }}>
        <SocketIndicator status={socketStatus} />
      </View>

      <View style={styles.welcome}>
        <View style={styles.avatarBox}><Text style={styles.avatarEmoji}>🎓</Text></View>
        <View style={styles.welcomeText}>
          <Text style={styles.welcomeName}>Hello, {student.full_name.split(' ')[0]}! 👋</Text>
          <Text style={styles.welcomeSub}>
            {student.student_id}
            {student.course     ? ` · ${student.course}`         : ''}
            {student.year_level ? ` · Year ${student.year_level}` : ''}
          </Text>
        </View>
      </View>

      <NotificationBanner borrows={borrows} />

      <Text style={styles.sectionTitle}>📖 Borrowed Books</Text>

      {borrows.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No borrowed books</Text>
          <Text style={styles.emptySub}>Visit the library to borrow one!</Text>
        </View>
      ) : (
        borrows.map(b => <BookCard key={b.id} borrow={b} />)
      )}

      <Text style={styles.pullHint}>↓ Pull down to refresh</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:       { flex:1, backgroundColor: Colors.bg },
  content:      { padding: Spacing.md, paddingBottom:48 },
  center:       { flex:1, justifyContent:'center', alignItems:'center', backgroundColor: Colors.bg },
  loadingText:  { marginTop:12, color: Colors.gray, fontSize: FontSize.sm },
  welcome:      { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.md, flexDirection:'row', alignItems:'center', marginBottom: Spacing.sm, gap: Spacing.md },
  avatarBox:    { width:52, height:52, borderRadius:26, backgroundColor:'rgba(255,255,255,.15)', alignItems:'center', justifyContent:'center' },
  avatarEmoji:  { fontSize:26 },
  welcomeText:  { flex:1 },
  welcomeName:  { color: Colors.white, fontWeight:'700', fontSize: FontSize.lg },
  welcomeSub:   { color:'rgba(255,255,255,.65)', fontSize: FontSize.xs, marginTop:3 },
  sectionTitle: { fontSize: FontSize.xs, fontWeight:'700', color: Colors.gray, textTransform:'uppercase', letterSpacing:.8, marginBottom:12, marginTop: Spacing.xs },
  emptyCard:    { backgroundColor: Colors.white, borderRadius: Radius.lg, padding:40, alignItems:'center', marginBottom: Spacing.md },
  emptyIcon:    { fontSize:44, marginBottom:10 },
  emptyTitle:   { fontSize: FontSize.md, fontWeight:'700', color: Colors.navy, marginBottom:4 },
  emptySub:     { fontSize: FontSize.sm, color: Colors.gray },
  pullHint:     { textAlign:'center', fontSize: FontSize.xs, color:'#cbd5e1', marginTop:8 },
});