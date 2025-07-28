import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../utils/supabase';

export default function AppHeader({ onMenuPress = () => {}, onNotifPress = () => {}, onAvatarPress = () => {} }) {
  const { user } = useAuth();
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setAvatar(null); return; }

    (async () => {
      // Attempt to read avatar_url from profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      const path = data?.avatar_url;
      if (!path) { setAvatar(null); return; }

      if (path.startsWith('http')) {
        setAvatar(path);
      } else {
        try {
          const { data: urlData } = await supabase.storage
            .from('profile-images')
            .createSignedUrl(path, 3600);
          setAvatar(urlData?.signedUrl ?? null);
        } catch {
          setAvatar(null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const insets = useSafeAreaInsets();
  const headerHeight = 56; // content area height (approx)

  const toggleMenu = () => setMenuOpen(p=>!p);
  const closeMenu = () => setMenuOpen(false);

  return (
    <View style={{ height: insets.top + headerHeight, marginTop: -insets.top, zIndex:1000, elevation:1000 }}>
      {/* Black background covering status bar and header */}
      <View style={{ position:'absolute', top:0, left:0, right:0, height: insets.top + headerHeight, backgroundColor: '#000' }} />

      <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingTop: insets.top, paddingBottom:12 }}>
        <Text style={{ fontSize:20, fontWeight:'700', flex:1, color:'#fff' }}>VybeLocal</Text>
        <TouchableOpacity onPress={onNotifPress} style={{ marginRight:16 }} accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={24} color="#fff" />
        </TouchableOpacity>
        {avatar && (
          <TouchableOpacity onPress={onAvatarPress} style={{ marginRight:16 }} accessibilityLabel="Profile">
            <Image source={{ uri: avatar }} style={{ width:34, height:34, borderRadius:17, borderWidth:2, borderColor:'#fff' }} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={(e)=>{ e.stopPropagation(); toggleMenu(); onMenuPress(); }} accessibilityLabel="Menu">
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
      {menuOpen && (
        <Pressable style={{ position:'absolute', top:0, left:0, right:0, bottom:0 }} onPress={closeMenu}>
          <View style={{ position:'absolute', top: insets.top + headerHeight + 4, right:16, backgroundColor:'#1f2937', borderRadius:8, paddingVertical:10, paddingHorizontal:16, shadowColor:'#000', shadowOpacity:0.3, shadowRadius:6, shadowOffset:{width:0,height:2} }}>
            <TouchableOpacity onPress={() => { closeMenu(); signOut(); }}>
              <Text style={{ color:'#fff', fontWeight:'600' }}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      )}
    </View>
  );
} 