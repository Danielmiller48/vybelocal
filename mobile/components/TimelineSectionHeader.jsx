import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../theme/colors';
import { format } from 'date-fns';

export default function TimelineSectionHeader({ date, isToday }) {
  const label = isToday ? 'Today · ' + format(date, 'EEE, MMM d') : 'Coming Up · ' + format(date, 'MMM d');
  const emoji = isToday ? '☀️' : '➡️';
  return (
    <View style={{ flexDirection:'row', alignItems:'center', marginTop: isToday?0:16, marginBottom:12 }}>
      <View style={styles.emojiWrap}><Text style={{ fontSize:18 }}>{emoji}</Text></View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emojiWrap:{ width:28, height:28, borderRadius:14, backgroundColor: colors.sand, justifyContent:'center', alignItems:'center', marginRight:8 },
  label:{ color:'#fdfdfd', fontWeight:'700', fontSize:16 },
}); 