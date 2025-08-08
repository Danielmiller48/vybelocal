import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Pressable, AppState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../utils/supabase';
import { notificationUtils } from '../utils/notifications';
import NotificationModal from './NotificationModal';

export default function AppHeader({ onMenuPress = () => {}, onNotifPress = () => {}, onAvatarPress = () => {} }) {
  const { user } = useAuth();
  const [avatar, setAvatar] = useState(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationSubscription, setNotificationSubscription] = useState(null);

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

  // Load unread notifications count
  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    loadUnreadCount();
    
    // Subscribe to real-time notification changes
    const subscription = notificationUtils.subscribeToNotifications(user.id, () => {
      loadUnreadCount();
    });
    setNotificationSubscription(subscription);

    return () => {
      if (subscription) {
        notificationUtils.unsubscribeFromNotifications(subscription);
      }
    };
  }, [user?.id]);

  // Handle app state changes - refresh notification count when app becomes active
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {

      if (nextAppState === 'active' && user?.id) {

        // Delay to ensure any background notifications have been processed
        setTimeout(() => {
          loadUnreadCount();
        }, 500);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [user?.id]);

  const loadUnreadCount = async () => {
    try {
      const counts = await notificationUtils.getUnreadCounts(user.id);
      setUnreadCount(counts.total || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
      setUnreadCount(0);
    }
  };

  const handleNotificationPress = () => {
    onNotifPress(); // Call the prop function if provided
    setShowNotificationModal(true);
  };

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
        <TouchableOpacity onPress={handleNotificationPress} style={{ marginRight:16, position: 'relative' }} accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={24} color="#fff" />
          {unreadCount > 0 && (
            <View style={{
              position: 'absolute',
              top: -6,
              right: -6,
              backgroundColor: '#dc2626',
              borderRadius: 10,
              minWidth: 20,
              height: 20,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 6
            }}>
              <Text style={{
                color: '#fff',
                fontSize: 11,
                fontWeight: '600',
                lineHeight: 20
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
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

      {/* Notification Modal */}
      <NotificationModal 
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />
    </View>
  );
} 