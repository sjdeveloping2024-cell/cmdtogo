import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Redirect } from 'expo-router';
import { API } from '../constants/config';
import { Colors, Radius, Spacing, FontSize } from '../constants/theme';
import { useStudent } from '../hooks/useStudentContext';
import { registerForPushNotifications } from '../components/notifications';

const SID_PATTERN = /^\d{2}-\d{4}-\d{6}$/;

export default function LoginScreen() {
  const { student, login }    = useStudent();
  const [id,      setId]      = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  if (student) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleLogin() {
    const sid = id.trim();
    if (!sid) {
      setError('Please enter your Student ID.'); return;
    }
    if (!SID_PATTERN.test(sid)) {
      setError('Student ID must be in format 00-0000-000000\n(e.g. 24-0001-000001)'); return;
    }
    setLoading(true); setError('');
    try {
      const res  = await fetch(API.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: sid }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? 'Login failed.'); return; }
      await registerForPushNotifications();
      login(data.student);
    } catch {
      setError('Cannot reach the server.\nCheck your WiFi and BASE_URL in constants/config.ts');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBox}>
          <Text style={styles.emoji}>📚</Text>
          <Text style={styles.appName}>Pick-A-Book</Text>
          <Text style={styles.sub}>Student Portal</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome!</Text>
          <Text style={styles.cardSub}>Enter your Student ID to continue</Text>

          {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>⚠️  {error}</Text></View>}

          <Text style={styles.label}>Student ID</Text>
          <View style={styles.inputRow}>
            <Text style={styles.inputIcon}>🎓</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 24-0001-000001"
              placeholderTextColor={Colors.grayLt}
              value={id}
              onChangeText={t => {
                // Auto-insert dashes: 00-0000-000000
                let v = t.replace(/[^0-9]/g, '');
                if (v.length > 2)  v = v.slice(0,2)  + '-' + v.slice(2);
                if (v.length > 7)  v = v.slice(0,7)  + '-' + v.slice(7);
                if (v.length > 14) v = v.slice(0,14);
                setId(v);
                setError('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity style={[styles.btn, loading && { opacity:.6 }]} onPress={handleLogin} disabled={loading} activeOpacity={.85}>
            {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Enter Portal →</Text>}
          </TouchableOpacity>

          <Text style={styles.hint}>Don't have an account? Ask your librarian to register you.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flexGrow:1, backgroundColor: Colors.navy, alignItems:'center', justifyContent:'center', padding: Spacing.lg },
  logoBox:    { alignItems:'center', marginBottom: Spacing.xl },
  emoji:      { fontSize:64, marginBottom: Spacing.sm },
  appName:    { fontSize:28, fontWeight:'700', color: Colors.white, letterSpacing:-.5 },
  sub:        { fontSize: FontSize.sm, color:'rgba(255,255,255,0.6)', marginTop:4 },
  card:       { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg+4, width:'100%', maxWidth:400, shadowColor:'#000', shadowOpacity:.25, shadowRadius:20, shadowOffset:{width:0,height:8}, elevation:10 },
  cardTitle:  { fontSize: FontSize.xl, fontWeight:'700', color: Colors.navy, marginBottom:4 },
  cardSub:    { fontSize: FontSize.xs, color: Colors.gray, marginBottom: Spacing.md },
  errorBox:   { backgroundColor: Colors.redLt, borderRadius: Radius.sm, padding:12, marginBottom: Spacing.md },
  errorText:  { color: Colors.red, fontSize: FontSize.xs, lineHeight:18 },
  label:      { fontSize: FontSize.xs, fontWeight:'600', color: Colors.gray, marginBottom:6, textTransform:'uppercase', letterSpacing:.5 },
  inputRow:   { flexDirection:'row', alignItems:'center', borderWidth:2, borderColor: Colors.border, borderRadius: Radius.sm, marginBottom: Spacing.md, paddingHorizontal:12 },
  inputIcon:  { fontSize:18, marginRight: Spacing.sm },
  input:      { flex:1, paddingVertical:13, fontSize: FontSize.md, color: Colors.navy },
  btn:        { backgroundColor: Colors.accent, borderRadius: Radius.sm, padding:15, alignItems:'center' },
  btnText:    { color: Colors.white, fontWeight:'700', fontSize: FontSize.md },
  hint:       { textAlign:'center', marginTop: Spacing.md, fontSize: FontSize.xs, color: Colors.gray, lineHeight:18 },
});