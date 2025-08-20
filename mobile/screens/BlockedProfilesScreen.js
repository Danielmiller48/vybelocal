// mobile/screens/BlockedProfilesScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import { supabase } from '../utils/supabase';
import Constants from 'expo-constants';
import { useAuth } from '../auth/AuthProvider';

export default function BlockedProfilesScreen(){
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true); setError(null);
    // Expect a view `v_blocked_profiles` or fallback to `blocks`
    const { data, error } = await supabase
      .from('v_blocked_profiles')
      .select('*')
      .eq('user_id', user.id);
    if (error) {
      // Fallback: join blocks(target_type='user') -> profiles
      const { data: fb, error: fbErr } = await supabase
        .from('blocks')
        .select('target_id, target_type, created_at')
        .eq('blocker_id', user.id)
        .eq('target_type', 'user');
      if (fbErr) { setError('Failed to load'); setLoading(false); return; }
      // Fetch profiles for blocked ids
      const ids = (fb || []).map(r => r.target_id);
      if (ids.length === 0) { setRows([]); setLoading(false); return; }
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', ids);
      const map = new Map((profs||[]).map(p => [p.id, p]));
      setRows(ids.map(id => ({ id, name: map.get(id)?.name || 'Hidden user', avatar_url: map.get(id)?.avatar_url })));
      setLoading(false); return;
    }
    setRows(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const unblock = async (blockedId) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;
      const API_BASE_URL = (globalThis?.Constants?.expoConfig?.extra?.apiBaseUrl) || (typeof Constants !== 'undefined' ? Constants.expoConfig?.extra?.apiBaseUrl : undefined) || process.env?.EXPO_PUBLIC_API_BASE_URL || 'https://vybelocal.com';
      const url = `${API_BASE_URL}/api/blocks?target_id=${encodeURIComponent(blockedId)}`;
      const resp = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error('Failed to unblock');
      setRows(prev => prev.filter(r => (r.id || r.blocked_id) !== blockedId));
    } catch {}
  };

  const renderItem = ({ item }) => {
    const id = item.id || item.blocked_id;
    const name = item.name || 'Hidden user';
    return (
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#eee' }}>
        <Text style={{ color:'#111827', fontWeight:'600' }}>{name}</Text>
        <TouchableOpacity onPress={() => unblock(id)} style={{ backgroundColor:'#ef4444', paddingHorizontal:12, paddingVertical:6, borderRadius:8 }}>
          <Text style={{ color:'#fff', fontWeight:'700' }}>Unblock</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor: 'transparent' }} edges={['top','left','right']}>
      <AppHeader />
      <View style={{ padding:16, flex:1 }}>
        <Text style={{ fontSize:22, fontWeight:'800', marginBottom:12 }}>Blocked Profiles</Text>
        {loading ? (
          <ActivityIndicator />
        ) : error ? (
          <Text style={{ color:'#ef4444' }}>{error}</Text>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id || item.blocked_id)}
            renderItem={renderItem}
            ListEmptyComponent={<Text style={{ color:'#6b7280' }}>No blocked users.</Text>}
          />
        )}
      </View>
    </SafeAreaView>
  );
}


