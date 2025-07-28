// mobile/screens/HomeScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
// Blur moved to HomeDrawerOverlay
import { useNavigation, useIsFocused } from '@react-navigation/native';
import HomeDrawerOverlay from '../components/HomeDrawerOverlay';
import TimelineEvent from '../components/TimelineEvent';
import TimelineSectionHeader from '../components/TimelineSectionHeader';
import { supabase } from '../utils/supabase';
import { useAuth } from '../auth/AuthProvider';
import colors from '../theme/colors';
import { format } from 'date-fns';
import AppHeader from '../components/AppHeader';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState([]);
  // drawer handled by HomeDrawerOverlay
  const [first, setFirst] = useState('');
  const navigation = useNavigation();

  const isFocused = useIsFocused();

  const loadUpcoming = async () => {
      const { data: rows } = await supabase
        .from('events')
        .select('* , rsvps!inner(user_id)')
        .eq('rsvps.user_id', user.id);

      const now = new Date();
      const upcomingRows = rows?.filter(ev=> new Date(ev.starts_at) >= now) || [];

      const upcoming = await Promise.all(upcomingRows.map(async ev => {
        let imageUrl = null;
        if (ev.img_path) {
          try {
            const { data: imgData } = await supabase.storage
              .from('event-images')
              .createSignedUrl(ev.img_path, 3600, {
                transform: { width: 800, height: 600, resize: 'cover' },
              });
            imageUrl = imgData?.signedUrl || null;
          } catch { /* ignore */ }
        }

        // fetch avatars & count (limit 3 avatars)
        const { data: avatarRows } = await supabase
          .from('rsvps')
          .select('profiles!inner(avatar_url)')
          .eq('event_id', ev.id)
          .limit(3);

        const avatars = (avatarRows || []).map(r => r.profiles?.avatar_url).filter(Boolean);

        const { count } = await supabase
          .from('rsvps')
          .select('*', { count:'exact', head:true })
          .eq('event_id', ev.id);

        return { ...ev, imageUrl, attendees:{ avatars, count } };
      }));

      upcoming.sort((a,b)=> new Date(a.starts_at) - new Date(b.starts_at));
      setEvents(upcoming);
  };

  useEffect(()=>{
    if(!user) return;

    // fetch profile name once
    supabase.from('profiles').select('name').eq('id',user.id).maybeSingle().then(({data})=>{
      if(data?.name){ setFirst(data.name.split(' ')[0]); }
    });
  },[user?.id]);

  // load on mount & whenever screen regains focus
  useEffect(()=>{
    if(!user) return;
    if(isFocused) loadUpcoming();
  },[isFocused, user?.id]);

  // no calendar strip toggles needed

  return (
    <LinearGradient colors={[ 'rgba(203,180,227,0.2)', 'rgba(255,200,162,0.4)' ]} style={{ flex:1 }} start={{x:0,y:0}} end={{x:0,y:1}}>
    <SafeAreaView style={{ flex:1, backgroundColor:'transparent' }} edges={['top','left','right']}> 
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding:16 }}>
        <Text style={styles.greet}>Hey {first || 'friend'},</Text>
        <Text style={styles.subhead}>Here’s what’s coming up:</Text>

        {/* Timeline list */}
        {events.length>0 ? (
          events.reduce((acc, ev, idx) => {
            const dateKey = format(new Date(ev.starts_at), 'yyyy-MM-dd');
            const prevDateKey = idx>0 ? format(new Date(events[idx-1].starts_at), 'yyyy-MM-dd') : null;
            const headerNeeded = dateKey !== prevDateKey;
            if(headerNeeded){
              acc.push(
                <TimelineSectionHeader key={'hdr-'+dateKey} date={new Date(ev.starts_at)} isToday={idx===0} />
              );
            }
            acc.push(<TimelineEvent key={ev.id} event={ev} onCancel={(e)=>{/* TODO cancel */}} />);
            return acc;
          }, [])
        ): null}

        {events.length===0 && (
          <View style={{ alignItems:'center', marginTop:40 }}>
            <Text style={{ color:'#fff' }}>You haven’t RSVP’d to anything yet.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
    <HomeDrawerOverlay />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  greet:{ color:'#001f3f', fontSize:22, fontWeight:'600', marginBottom:8, textShadowColor:'rgba(255,255,255,0.2)', textShadowOffset:{ width:0, height:1 }, textShadowRadius:2 },
  subhead:{ color:'#001f3f', fontSize:18, fontWeight:'500', marginBottom:20 },
  rowText:{ color:'#fff', fontSize:18, fontWeight:'600', textShadowColor:'rgba(0,0,0,0.15)', textShadowOffset:{ width:0, height:1 }, textShadowRadius:2 },
  // removed drawer-specific styles
}); 