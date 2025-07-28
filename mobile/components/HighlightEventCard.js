import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { format } from 'date-fns';
import { supabase } from '../utils/supabase';
import ProfileModal from './ProfileModal';
import RSVPButton from './RSVPButton';

const VIBE_COLORS = {
  chill: '#b5ccb5',
  hype:  '#9fb4e5',
  creative: '#e8b0d4',
  active: '#ffbc8b',
  all: '#f0d89e',
};

function useAvatarUrl(path) {
  const [url, setUrl] = useState('https://placehold.co/40x40');
  useEffect(() => {
    if (!path) { setUrl('https://placehold.co/40x40'); return; }
    if (path.startsWith('http')) { setUrl(path); return; }
    supabase.storage.from('profile-images').createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
      });
  }, [path]);
  return url;
}

export default function HighlightEventCard({ event, onPress }) {
  const [loading, setLoading] = useState(true);
  const [hostProfile, setHostProfile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchData(){
      if(!event.host_id){ setLoading(false); return; }
      const { data } = await supabase.from('profiles').select('id,name,avatar_url').eq('id', event.host_id).maybeSingle();
      if(isMounted){ setHostProfile(data); setLoading(false); }
    }
    fetchData();
    return ()=>{ isMounted=false; };
  }, [event.host_id]);

  const imageUrl = event.imageUrl || 'https://placehold.co/600x400';
  const avatarUrl = useAvatarUrl(hostProfile?.avatar_url);

  return (
    <TouchableOpacity onPress={()=>onPress?.(event)} activeOpacity={0.9} style={styles.wrapper}>
      <View style={styles.card}>
        <Image source={{uri:imageUrl}} style={styles.image} />
        <View style={{padding:16}}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.meta}>{format(new Date(event.starts_at),'EEE, MMM d • h:mm a')}</Text>
          <View style={[styles.pill,{backgroundColor: VIBE_COLORS[event.vibe] || '#ffffff55'}]}>
            <Text style={styles.pillText}>{event.vibe.charAt(0).toUpperCase()+event.vibe.slice(1)}</Text>
          </View>
          {/* host row minimal */}
          {loading ? null : hostProfile && (
            <View style={styles.hostRow}>
              <Image source={{uri:avatarUrl}} style={styles.avatar} />
              <Text style={styles.hostName}>{hostProfile.name}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper:{ marginBottom:24 },
  card:{ borderRadius:20, overflow:'hidden', shadowColor:'#ffbc8b', shadowOpacity:0.6, shadowRadius:20, shadowOffset:{width:0,height:6}, elevation:6, borderWidth:2, borderColor:'#ffbc8b' },
  image:{ width:'100%', height:260 },
  title:{ fontSize:22, fontWeight:'700', color:'#fff', marginBottom:6 },
  meta:{ color:'#e0e0e0', fontSize:14, marginBottom:8 },
  pill:{ alignSelf:'flex-start', paddingHorizontal:12, paddingVertical:6, borderRadius:14, marginBottom:12 },
  pillText:{ fontSize:14, color:'#222', fontWeight:'600' },
  hostRow:{ flexDirection:'row', alignItems:'center', marginTop:8 },
  avatar:{ width:28, height:28, borderRadius:14, marginRight:8 },
  hostName:{ color:'#fff', fontSize:14, fontWeight:'500' },
}); 