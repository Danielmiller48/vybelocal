import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../utils/supabase';
import Constants from 'expo-constants';
import { getSignedUrl } from '../utils/signedUrlCache';

const WAITLIST_URL = Constants.expoConfig?.extra?.waitlistApiBaseUrl || process.env?.EXPO_PUBLIC_WAITLIST_API_BASE_URL || 'https://vybelocal-waitlist.vercel.app';

export default function BlockedUsersScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [items, setItems] = React.useState([]);

  const load = React.useCallback(async () => {
    if (!user?.id) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    try {
      setLoading(true);
      const res = await fetch(`${WAITLIST_URL}/api/blocks`, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data.filter(b => b.target_type === 'user') : [];
      const ids = list.map(b => b.target_id);
      let profilesMap = {};

      if (ids.length) {
        // Try public_user_cards first for public names/avatars
        const { data: puc } = await supabase
          .from('public_user_cards')
          .select('uuid,name,avatar_url')
          .in('uuid', ids);
        for (const p of (puc || [])) {
          profilesMap[p.uuid] = { id: p.uuid, name: p.name || null, avatar_url: p.avatar_url || null, avatar_path: null };
        }
        // Backfill from profiles for any missing entries or avatar_path signing
        const missing = ids.filter(id => !profilesMap[id]);
        if (missing.length || true) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id,name,avatar_url,avatar_path')
            .in('id', ids);
          for (const p of (profs || [])) {
            const existing = profilesMap[p.id] || {};
            profilesMap[p.id] = {
              id: p.id,
              name: existing.name || p.name || null,
              avatar_url: existing.avatar_url || p.avatar_url || null,
              avatar_path: p.avatar_path || null,
            };
          }
        }
      }

      const withProfiles = await Promise.all(list.map(async (b) => {
        const p = profilesMap[b.target_id] || null;
        let avatarResolved = null;
        try {
          const raw = p?.avatar_url || p?.avatar_path || null;
          if (raw) {
            if (typeof raw === 'string' && raw.startsWith('http')) {
              avatarResolved = raw;
            } else {
              const signed = await getSignedUrl(supabase, 'profile-images', raw, 3600);
              avatarResolved = signed || null;
            }
          }
        } catch {}
        return {
          id: b.id,
          target_id: b.target_id,
          created_at: b.created_at,
          profile: p ? { id: p.id, name: p.name || 'Blocked user', avatar_url: avatarResolved } : null,
        };
      }));

      setItems(withProfiles);
    } catch (e) {
      Alert.alert('Error', 'Failed to load blocked users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  React.useEffect(() => { load(); }, [load]);

  const onUnblock = async (targetId) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    try {
      const res = await fetch(`${WAITLIST_URL}/api/blocks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ target_type: 'user', target_id: targetId })
      });
      if (!res.ok) throw new Error('Failed');
      setItems(prev => prev.filter(it => it.target_id !== targetId));
    } catch (e) {
      Alert.alert('Error', 'Unable to unblock. Please try again.');
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <View style={{ flexDirection:'row', alignItems:'center', flex:1 }}>
        {item?.profile?.avatar_url ? (
          <Image source={{ uri: item.profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar,{ backgroundColor:'#eee' }]} />
        )}
        <View style={{ flexShrink:1 }}>
          <Text numberOfLines={1} style={styles.name}>{item?.profile?.name || 'Blocked user'}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.unblockBtn} onPress={() => onUnblock(item.target_id)}>
        <Text style={styles.unblockTxt}>Unblock</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex:1 }}>
      <AppHeader />
      <View style={{ padding:16, flex:1 }}>
        <Text style={{ fontSize:22, fontWeight:'800', marginBottom:12 }}>Blocked Users</Text>
        {loading ? (
          <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => `${it.target_id}`}
            renderItem={renderItem}
            onRefresh={() => { setRefreshing(true); load(); }}
            refreshing={refreshing}
            ListEmptyComponent={<Text style={{ color:'#666' }}>You haven’t blocked anyone.</Text>}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#eee' },
  avatar: { width:40, height:40, borderRadius:20, marginRight:12 },
  name: { fontSize:16, fontWeight:'700' },
  sub: { fontSize:12, color:'#6b7280' },
  unblockBtn: { paddingVertical:8, paddingHorizontal:12, borderRadius:8, borderWidth:1, borderColor:'#BAA4EB' },
  unblockTxt: { color:'#BAA4EB', fontWeight:'700' },
});


