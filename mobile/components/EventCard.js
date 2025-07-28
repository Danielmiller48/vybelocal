import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { format } from 'date-fns';
import { supabase } from '../utils/supabase';
import ProfileModal from './ProfileModal';
import RSVPButton from './RSVPButton';
// pastel colors for vibe pills
const VIBE_COLORS = {
  chill: '#b5ccb5',
  hype:  '#9fb4e5',
  creative: '#e8b0d4',
  active: '#ffbc8b',
  all: '#f0d89e',
};

const hostProfileCache = {};
const hostStatsCache = {};

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

export default function EventCard({ event, onPress }) {
  const [loading, setLoading] = useState(true);
  const [hostProfile, setHostProfile] = useState(null);
  const [hostStats, setHostStats] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      const hostId = event.host_id;
      if (!hostId) { setLoading(false); return; }

      // profile
      if (hostProfileCache[hostId]) {
        setHostProfile(hostProfileCache[hostId]);
      } else {
        let { data } = await supabase
          .from('public_user_cards')
          .select('*')
          .eq('uuid', hostId)
          .maybeSingle();

        if (!data) {
          // Nothing in public_user_cards – grab basics from profiles table
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id as id, name, avatar_url')
            .eq('id', hostId)
            .maybeSingle();
          data = profileData || null;
        } else if (data && !data.avatar_url) {
          // Avatar missing – fetch just the avatar
          const { data: avatarRow } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', hostId)
            .maybeSingle();
          if (avatarRow?.avatar_url) data.avatar_url = avatarRow.avatar_url;
        }

        if (isMounted) {
          setHostProfile(data);
          hostProfileCache[hostId] = data;
        }
      }

      // stats
      if (hostStatsCache[hostId]) {
        setHostStats(hostStatsCache[hostId]);
      } else {
        const { count: completed } = await supabase
          .from('v_past_events')
          .select('id', { count: 'exact', head: true })
          .eq('host_id', hostId);
        // Fallback to events table if view not accessible
        let completedCount = completed;
        if (completedCount === null || completedCount === undefined) {
          const { count: alt } = await supabase
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('host_id', hostId)
            .lt('starts_at', new Date().toISOString());
          completedCount = alt || 0;
        }

        const { data: strikeRow } = await supabase
          .from('v_host_strikes_last6mo')
          .select('strike_count')
          .eq('host_id', hostId)
          .maybeSingle();

        const stats = { completed: completedCount || 0, cancels: Number(strikeRow?.strike_count ?? 0) };
        if (isMounted) {
          setHostStats(stats);
          hostStatsCache[hostId] = stats;
        }
      }
      if (isMounted) setLoading(false);
    }
    fetchData();
    return () => { isMounted = false; };
  }, [event.host_id]);

  const imageUrl = event.imageUrl || 'https://placehold.co/400x300';

  const avatarUrl = useAvatarUrl(hostProfile?.avatar_url);

  return (
    <>
      <TouchableOpacity
        onPress={() => onPress?.(event)}
        style={styles.card}
        activeOpacity={0.9}
      >
        <Image source={{ uri: imageUrl }} style={styles.image} />
        <View style={{ padding:12 }}>
          <View style={styles.rowWrap}>
            {/* LEFT COLUMN */}
            <View style={styles.leftCol}>
              <Text style={styles.title}>{event.title}</Text>
              <Text style={styles.meta}>{format(new Date(event.starts_at), 'EEE, MMM d • h:mm a')}</Text>
              <View style={[styles.pill, { backgroundColor: VIBE_COLORS[event.vibe] || '#ffffff55' }]}> 
                <Text style={styles.pillText}>{event.vibe.charAt(0).toUpperCase() + event.vibe.slice(1)}</Text>
              </View>
            </View>

            {/* RIGHT COLUMN */}
            <View style={styles.rightCol}>
              {event.description ? (
                <Text style={styles.blurb} numberOfLines={3} ellipsizeMode="tail">
                  “{event.description}”
                </Text>
              ) : (
                <Text style={styles.icon}>📍</Text>
              )}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Host row */}
          <TouchableOpacity
            style={styles.hostRow}
            onPress={(e) => { e.stopPropagation(); if (hostProfile) setModalOpen(true); }}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator style={{ width: 32, height: 32, marginRight: 8 }} />
            ) : (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.hostName}>{hostProfile?.name || 'Host'}</Text>
              {hostProfile?.pronouns ? (
                <Text style={styles.pronouns}>{hostProfile.pronouns}</Text>
              ) : null}
              {hostStats ? (
                <Text style={styles.statLine}>
                  {hostStats.completed} completed • {hostStats.cancels} cancels
                </Text>
              ) : null}
            </View>
            <RSVPButton event={event} compact />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <ProfileModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        profile={hostProfile}
        stats={hostStats}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom:20, backgroundColor:'rgba(0,0,0,0.4)', borderRadius:16, shadowColor:'#000', shadowOpacity:0.1, shadowRadius:10, shadowOffset:{width:0,height:2}, elevation:4 },
  image: { width:'100%', height:200, borderTopLeftRadius:16, borderTopRightRadius:16 },
  title: { fontSize:18, fontWeight:'700', marginBottom:6, color:'#fff' },
  meta: { color:'#e0e0e0', fontSize:12, marginBottom:8 },
  pill:{ alignSelf:'flex-start', paddingHorizontal:10, paddingVertical:4, borderRadius:12, marginBottom:8 },
  pillText:{ fontSize:12, color:'#222', fontWeight:'600' },
  hostRow: { flexDirection:'row', alignItems:'center', marginTop:16 },
  avatar: { width:32, height:32, borderRadius:16, marginRight:8 },
  hostName: { fontSize:14, fontWeight:'500', color:'#fff' },
  pronouns: { fontSize:10, color:'#d0d0d0' },
  statLine: { fontSize:10, color:'#d0d0d0' },
  divider:{ height:1, backgroundColor:'rgba(255,255,255,0.25)', marginTop:12 },
  rowWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leftCol: { flex: 1, marginRight: 10 },
  rightCol: { flex: 1 },
  blurb: { fontSize: 14, color: '#d0d0d0', fontStyle:'italic' },
  icon: { fontSize: 16, color: '#e0e0e0' },
}); 