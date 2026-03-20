import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';
import { Borrow } from './BookCard';

export default function NotificationBanner({ borrows }: { borrows: Borrow[] }) {
  const now = Date.now();
  const ms  = (s: string) => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d,23,59,59).getTime(); };
  const overdue = borrows.filter(b => ms(b.due_date) < now);
  const soon    = borrows.filter(b => { const diff=ms(b.due_date)-now; return diff>0 && diff<=172_800_000; });
  if (!overdue.length && !soon.length) return null;
  return (
    <>
      {overdue.map(b=>(
        <View key={`od-${b.id}`} style={[styles.banner, styles.overdue]}>
          <Text style={styles.icon}>🔴</Text>
          <View style={styles.body}>
            <Text style={[styles.title,{color:Colors.red}]}>Overdue Book!</Text>
            <Text style={[styles.text,{color:Colors.red}]}>"{b.book_title}" was due {b.due_date}. Return immediately!</Text>
          </View>
        </View>
      ))}
      {soon.map(b=>{
        const hrs=Math.ceil((ms(b.due_date)-now)/3_600_000);
        return (
          <View key={`sn-${b.id}`} style={[styles.banner, styles.soon]}>
            <Text style={styles.icon}>⚠️</Text>
            <View style={styles.body}>
              <Text style={[styles.title,{color:'#92400e'}]}>Due Soon!</Text>
              <Text style={[styles.text,{color:'#92400e'}]}>"{b.book_title}" due in ~{hrs}h ({b.due_date}).</Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  banner:  { borderRadius: Radius.md, padding: Spacing.md, flexDirection:'row', alignItems:'flex-start', marginBottom: Spacing.sm, borderWidth:1 },
  overdue: { backgroundColor: Colors.redLt,    borderColor:'#fca5a5' },
  soon:    { backgroundColor: Colors.yellowLt, borderColor:'#fde68a' },
  icon:    { fontSize:20, marginRight: Spacing.sm },
  body:    { flex:1 },
  title:   { fontWeight:'700', fontSize: FontSize.sm, marginBottom:2 },
  text:    { fontSize: FontSize.xs, lineHeight:18 },
});
