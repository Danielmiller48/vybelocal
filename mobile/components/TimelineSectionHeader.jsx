import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../theme/colors';
import { format, differenceInCalendarDays, isSameDay } from 'date-fns';

export default function TimelineSectionHeader({ date, isToday }) {
  const diffDays = differenceInCalendarDays(date, new Date());
  let prefix = '';
  let emoji = '➡️';
  if (diffDays === 0) { prefix = 'Today · '; emoji = '☀️'; }
  else if (diffDays === 1) { prefix = 'Tomorrow · '; emoji = '🌤️'; }
  else if (diffDays < 0) { prefix = 'Past · '; emoji = '🕑'; }

  const label = prefix + format(date, 'EEE, MMM d');
  return (
    <View style={{ flexDirection:'row', alignItems:'center', marginTop: isToday?0:16, marginBottom:12 }}>
      <View style={styles.emojiWrap}><Text style={{ fontSize:18 }}>{emoji}</Text></View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emojiWrap:{ width:28, height:28, borderRadius:14, backgroundColor: colors.sand, justifyContent:'center', alignItems:'center', marginRight:8 },
  label:{ color:'#001f3f', fontWeight:'700', fontSize:16 },
}); 