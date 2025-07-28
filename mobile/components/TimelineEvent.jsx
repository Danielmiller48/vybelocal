import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Switch, Alert } from 'react-native';
import { format, differenceInMinutes } from 'date-fns';
import colors from '../theme/colors';
import RSVPButton from './RSVPButton';

export default function TimelineEvent({ event, onCancel }) {
  const minutesAway = differenceInMinutes(new Date(event.starts_at), new Date());
  const countdown = minutesAway <= 0 ? null : minutesAway < 60 ? `Starts in ${minutesAway}m` : `Starts in ${Math.round(minutesAway/60)}h`;
  const [remind, setRemind] = useState(true);

  const handleCancel = () => {
    Alert.alert('Cancel RSVP', 'Are you sure you want to cancel? Fees may apply.', [
      { text:'No' },
      { text:'Yes, cancel', style:'destructive', onPress:()=> onCancel?.(event) }
    ]);
  };

  return (
    <View style={styles.card}> 
      {/* Row 1 - thumbnail & title */}
      <View style={{ flexDirection:'row', alignItems:'center' }}>
        {event.imageUrl ? (
          <Image source={{ uri:event.imageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.circle,{ backgroundColor:'#ddd' }]} />
        )}
        <View style={{ marginLeft:12, flex:1 }}>
          <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
          <Text style={styles.time}>{format(new Date(event.starts_at), 'h:mm a')}</Text>
        </View>
      </View>
      {/* Description */}
      {event.description ? (
        <Text style={styles.desc} numberOfLines={2}>
          “{event.description}”
        </Text>
      ) : null}
      {/* Attendee Row */}
      <View style={styles.statusRow}>
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          {event.attendees?.avatars?.length ? (
            <View style={{ flexDirection:'row', marginRight:8 }}>
              {event.attendees.avatars.slice(0,3).map((url,idx)=>(
                <Image key={idx} source={{ uri:url||'https://placehold.co/24x24' }} style={[styles.attAvatar,{ marginLeft: idx===0?0:-10, zIndex: 10-idx }]} />
              ))}
            </View>
          ) : null }
          <Text style={styles.statusText}>You + {Math.max(0,(event.attendees?.count||1)-1)} others going</Text>
        </View>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelTxt}>Cancel RSVP</Text>
        </TouchableOpacity>
      </View>
      {/* Footer row toggle */}
      <View style={styles.footerRow}>
        {countdown && <Text style={styles.countdown}>{countdown}</Text>}
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <Text style={{ color:'#fff', marginRight:6, fontSize:12 }}>Reminders</Text>
          <Switch value={remind} onValueChange={setRemind} thumbColor={remind? colors.secondary: '#888'} trackColor={{ true: colors.secondary+'88', false:'#666' }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card:{ backgroundColor:'rgba(255,255,255,0.15)', borderRadius:20, padding:16, marginBottom:24 },
  thumb:{ width:36, height:36, borderRadius:18 },
  circle:{ width:36, height:36, borderRadius:18 },
  title:{ fontSize:16, fontWeight:'700', color:'#fff' },
  time:{ color:'#e0e0e0', fontSize:12 },
  desc:{ color:'#fff', marginTop:8, fontStyle:'italic', fontSize:14 },
  statusRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderTopWidth:1, borderColor:'rgba(255,255,255,0.12)', marginTop:12, paddingTop:12 },
  statusText:{ color:'#ffffffcc', fontSize:14 },
  attAvatar:{ width:24, height:24, borderRadius:12, borderWidth:2, borderColor:'#000', backgroundColor:'#555' },
  cancelBtn:{ backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:12, paddingVertical:6, borderRadius:12 },
  cancelTxt:{ color:'#fff', fontSize:12 },
  footerRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:12 },
  countdown:{ color:'#ffbc8b', fontSize:12, fontWeight:'600' },
}); 