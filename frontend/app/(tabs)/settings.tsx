import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { API } from '../../constants/config';
import { Colors, Spacing, Radius, FontSize } from '../../constants/theme';
import { useStudent } from '../../hooks/useStudentContext';

const SID_PATTERN = /^\d{2}-\d{4}-\d{6}$/;

function formatSid(v: string): string {
  const digits = v.replace(/[^0-9]/g, '');
  if (digits.length <= 2)  return digits;
  if (digits.length <= 6)  return digits.slice(0,2) + '-' + digits.slice(2);
  return digits.slice(0,2) + '-' + digits.slice(2,6) + '-' + digits.slice(6,12);
}

export default function SettingsScreen() {
  const { student, logout, update } = useStudent();

  const [form, setForm] = useState({
    full_name:  student?.full_name  ?? '',
    student_id: student?.student_id ?? '',
    email:      student?.email      ?? '',
    course:     student?.course     ?? '',
    year_level: student?.year_level ? String(student.year_level) : '',
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  function setF(k: keyof typeof form, v: string) {
    setForm(f=>({...f,[k]:v})); setError(''); setSuccess('');
  }

  async function handleSave() {
    if (!form.full_name.trim() || !form.student_id.trim()) {
      setError('Full Name and Student ID are required.'); return;
    }
    if (!SID_PATTERN.test(form.student_id.trim())) {
      setError('Student ID must be in format 00-0000-000000\n(e.g. 24-0001-000001)'); return;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res  = await fetch(API.update(student!.id), {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          full_name:  form.full_name.trim(),
          student_id: form.student_id.trim(),
          email:      form.email.trim(),
          course:     form.course.trim(),
          year_level: form.year_level ? parseInt(form.year_level,10) : null,
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? 'Update failed.'); return; }
      update(data.student);
      setSuccess('✅ Profile updated successfully!');
    } catch { setError('Cannot reach the server. Check your WiFi.'); }
    finally { setSaving(false); }
  }

  function confirmLogout() {
    Alert.alert('Log Out','Are you sure you want to log out?',[
      { text:'Cancel', style:'cancel' },
      { text:'Log Out', style:'destructive', onPress: () => logout() },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.profileCard}>
          <View style={styles.avatarBox}><Text style={{fontSize:26}}>👤</Text></View>
          <View>
            <Text style={styles.profileName}>{student?.full_name}</Text>
            <Text style={styles.profileId}>{student?.student_id}</Text>
          </View>
        </View>

        {!!error   && <View style={styles.errorBox}><Text style={styles.errorText}>⚠️  {error}</Text></View>}
        {!!success && <View style={styles.successBox}><Text style={styles.successText}>{success}</Text></View>}

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>✏️  Edit Profile</Text>

          {/* Full Name */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={form.full_name}
              onChangeText={v => setF('full_name', v)}
              placeholder="Your full name"
              placeholderTextColor={Colors.grayLt}
            />
          </View>

          {/* Student ID — auto-dash format */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Student ID *</Text>
            <TextInput
              style={styles.input}
              value={form.student_id}
              onChangeText={v => setF('student_id', formatSid(v))}
              placeholder="e.g. 24-0001-000001"
              placeholderTextColor={Colors.grayLt}
              keyboardType="numeric"
              maxLength={14}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.sidHint}>Format: 00-0000-000000</Text>
          </View>

          {/* Email */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={v => setF('email', v)}
              placeholder="you@school.edu"
              placeholderTextColor={Colors.grayLt}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Course */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Course</Text>
            <TextInput
              style={styles.input}
              value={form.course}
              onChangeText={v => setF('course', v)}
              placeholder="e.g. BSIT"
              placeholderTextColor={Colors.grayLt}
            />
          </View>

          {/* Year Level */}
          <Text style={styles.label}>Year Level</Text>
          <View style={styles.yearRow}>
            {['',1,2,3,4,5].map(y=>{
              const val=String(y), active=form.year_level===val;
              return (
                <TouchableOpacity key={val} style={[styles.yearBtn, active&&styles.yearBtnActive]}
                  onPress={()=>setF('year_level',val)} activeOpacity={.7}>
                  <Text style={[styles.yearBtnText, active&&styles.yearBtnTextActive]}>
                    {y===''?'—':`Y${y}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving&&{opacity:.6}]}
            onPress={handleSave} disabled={saving} activeOpacity={.85}>
            {saving ? <ActivityIndicator color={Colors.white}/> : <Text style={styles.saveBtnText}>💾  Save Changes</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={.8}>
          <Text style={styles.logoutText}>🚪  Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:      { flex:1, backgroundColor: Colors.bg },
  content:     { padding: Spacing.md, paddingBottom:60 },
  profileCard: { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.md, flexDirection:'row', alignItems:'center', gap: Spacing.md, marginBottom: Spacing.md },
  avatarBox:   { width:52, height:52, borderRadius:26, backgroundColor:'rgba(255,255,255,.15)', alignItems:'center', justifyContent:'center' },
  profileName: { color: Colors.white, fontWeight:'700', fontSize: FontSize.md },
  profileId:   { color:'rgba(255,255,255,.6)', fontSize: FontSize.xs, marginTop:2 },
  errorBox:    { backgroundColor: Colors.redLt,   borderRadius: Radius.sm, padding:12, marginBottom: Spacing.sm, borderWidth:1, borderColor:'#fca5a5' },
  errorText:   { color: Colors.red,   fontSize: FontSize.xs },
  successBox:  { backgroundColor: Colors.greenLt, borderRadius: Radius.sm, padding:12, marginBottom: Spacing.sm, borderWidth:1, borderColor:'#86efac' },
  successText: { color: Colors.green, fontSize: FontSize.xs },
  formCard:    { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, shadowColor:'#000', shadowOpacity:.06, shadowRadius:10, elevation:3 },
  formTitle:   { fontSize: FontSize.md, fontWeight:'700', color: Colors.navy, marginBottom: Spacing.md },
  fieldWrap:   { marginBottom: Spacing.md },
  label:       { fontSize: FontSize.xs-1, fontWeight:'600', color: Colors.gray, textTransform:'uppercase', letterSpacing:.5, marginBottom:6 },
  input:       { borderWidth:2, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal:14, paddingVertical:12, fontSize: FontSize.sm, color: Colors.navy },
  sidHint:     { fontSize: FontSize.xs - 1, color: Colors.grayLt, marginTop:4 },
  yearRow:         { flexDirection:'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap:'wrap' },
  yearBtn:         { paddingHorizontal:16, paddingVertical:9, borderRadius: Radius.sm, borderWidth:2, borderColor: Colors.border, backgroundColor: Colors.bg },
  yearBtnActive:   { borderColor: Colors.accent, backgroundColor: Colors.accentLt },
  yearBtnText:     { fontSize: FontSize.sm, fontWeight:'600', color: Colors.gray },
  yearBtnTextActive:{ color: Colors.accent },
  saveBtn:     { backgroundColor: Colors.accent, borderRadius: Radius.sm, padding:14, alignItems:'center', marginTop: Spacing.xs },
  saveBtnText: { color: Colors.white, fontWeight:'700', fontSize: FontSize.md },
  logoutBtn:   { backgroundColor: Colors.white, borderRadius: Radius.md, padding:16, alignItems:'center', borderWidth:2, borderColor:'#fca5a5' },
  logoutText:  { color: Colors.red, fontWeight:'700', fontSize: FontSize.md },
});