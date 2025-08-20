import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Pressable, AppState, ScrollView, Animated, Dimensions, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Linking } from 'react-native';
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
  const navigation = useNavigation();
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
  const [menuMounted, setMenuMounted] = useState(false);
  const menuOpacity = React.useRef(new Animated.Value(0)).current;
  const anchorRef = React.useRef(null);
  const [menuTop, setMenuTop] = useState(0);

  const insets = useSafeAreaInsets();
  const headerHeight = 56; // content area height (approx)

  const calcMenuTop = React.useCallback(() => {
    if (!anchorRef.current) return;
    try {
      anchorRef.current.measureInWindow((x, y, width, height) => {
        if (typeof y === 'number' && typeof height === 'number') {
          setMenuTop(y + height + 6);
        }
      });
    } catch {}
  }, []);

  const toggleMenu = () => {
    if (!menuOpen) {
      // recalc position before opening
      setTimeout(calcMenuTop, 0);
    }
    setMenuOpen(p=>!p);
  };
  const closeMenu = () => setMenuOpen(false);

  // Fade in/out the hamburger dropdown
  React.useEffect(() => {
    if (menuOpen) {
      if (!menuMounted) setMenuMounted(true);
      Animated.timing(menuOpacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
    } else if (menuMounted) {
      Animated.timing(menuOpacity, { toValue: 0, duration: 100, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMenuMounted(false);
      });
    }
  }, [menuOpen, menuMounted, menuOpacity]);

  React.useEffect(() => {
    // recalc on safe area changes (orientation/notch)
    calcMenuTop();
  }, [insets.top, calcMenuTop]);

  const baseTop = insets.top + headerHeight;
  const offsetDown = 16; // universal downward shift (moved up 4px)
  const adjustedTop = menuTop + offsetDown;
  const menuMaxHeight = Math.min(520, Dimensions.get('window').height - adjustedTop - 16);

  return (
    <View style={{ height: insets.top + headerHeight, marginTop: -insets.top, zIndex:1000, elevation:1000 }}>
      {/* Black background covering status bar and header */}
      <View style={{ position:'absolute', top:0, left:0, right:0, height: insets.top + headerHeight, backgroundColor: '#000' }} />

      <View ref={anchorRef} style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingTop: insets.top, paddingBottom:12 }}>
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
          <TouchableOpacity onPress={() => { onAvatarPress(); navigation.navigate('Home', { screen: 'ProfileSettings' }); }} style={{ marginRight:16 }} accessibilityLabel="Profile">
            <Image source={{ uri: avatar }} style={{ width:34, height:34, borderRadius:17, borderWidth:2, borderColor:'#fff' }} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={(e)=>{ e.stopPropagation(); toggleMenu(); onMenuPress(); }} accessibilityLabel="Menu">
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
      {menuMounted && (
        <Modal visible transparent animationType="none" onRequestClose={closeMenu}>
          <Animated.View style={{ flex:1, opacity: menuOpacity }} pointerEvents="box-none">
            {/* Outside close area */}
            <Pressable style={{ position:'absolute', top:0, left:0, right:0, height: adjustedTop }} onPress={closeMenu} />
            <Pressable style={{ position:'absolute', top: adjustedTop + menuMaxHeight + 16, left:0, right:0, bottom:0 }} onPress={closeMenu} />
            <Pressable style={{ position:'absolute', top: adjustedTop, left:0, width:12, height: menuMaxHeight + 16 }} onPress={closeMenu} />
            <Pressable style={{ position:'absolute', top: adjustedTop, right:0, width:12, height: menuMaxHeight + 16 }} onPress={closeMenu} />
            {/* Menu container */}
            <View style={{ position:'absolute', top: adjustedTop, right:12, left:12 }} pointerEvents="box-none">
              <View style={{ backgroundColor:'#111827', borderRadius:12, paddingVertical:8, paddingHorizontal:0, shadowColor:'#000', shadowOpacity:0.35, shadowRadius:10, shadowOffset:{width:0,height:6}, maxHeight: menuMaxHeight, elevation: 20 }}>
                <ScrollView contentContainerStyle={{ paddingVertical:6 }} showsVerticalScrollIndicator nestedScrollEnabled>
              {/* Quick Actions */}
              <Text style={{ color:'#9CA3AF', fontSize:12, fontWeight:'700', paddingHorizontal:16, paddingTop:6, paddingBottom:4 }}>Quick Actions</Text>
              <MenuItem icon="search" label="Find a Vybe" onPress={() => { closeMenu(); navigation.navigate('Discover'); }} />
              <MenuItem icon="add-circle-outline" label="Host a Vybe" onPress={() => { closeMenu(); globalThis?.HostDrawerToggle?.(); navigation.navigate('Host'); }} />
              <MenuItem icon="calendar-outline" label="Upcoming Vybes" onPress={() => { closeMenu(); navigation.navigate('Home', { screen: 'HomeMain' }); }} />

              {/* Account & Tools */}
              <SectionDivider />
              <Text style={{ color:'#9CA3AF', fontSize:12, fontWeight:'700', paddingHorizontal:16, paddingBottom:4 }}>Account & Tools</Text>
              <MenuItem icon="person-circle-outline" label="Profile & Settings" onPress={() => { closeMenu(); onAvatarPress(); navigation.navigate('Home', { screen: 'ProfileSettings' }); }} />
              <MenuItem icon="ban-outline" label="Blocked profiles" onPress={() => { closeMenu(); navigation.navigate('Home', { screen: 'BlockedProfiles' }); }} />
              <MenuItem icon="card-outline" label="Payment Methods" onPress={() => { closeMenu(); Linking.openURL((Constants?.expoConfig?.extra?.apiBaseUrl || 'https://vybelocal.com') + '/app/payments'); }} />

              {/* Info & Support */}
              <SectionDivider />
              <Text style={{ color:'#9CA3AF', fontSize:12, fontWeight:'700', paddingHorizontal:16, paddingBottom:4 }}>Info & Support</Text>
              <MenuItem icon="information-circle-outline" label="About VybeLocal" onPress={() => { closeMenu(); Linking.openURL((Constants?.expoConfig?.extra?.apiBaseUrl || 'https://vybelocal.com') + '/learn'); }} />
              <MenuItem icon="shield-checkmark-outline" label="Trust & Safety" onPress={() => { closeMenu(); navigation.navigate('Guidelines'); }} />
              <MenuItem icon="refresh-circle-outline" label="Refund Policy" onPress={() => { closeMenu(); Linking.openURL((Constants?.expoConfig?.extra?.apiBaseUrl || 'https://vybelocal.com') + '/refund'); }} />
              <MenuItem icon="lock-closed-outline" label="Privacy Policy" onPress={() => { closeMenu(); Linking.openURL((Constants?.expoConfig?.extra?.apiBaseUrl || 'https://vybelocal.com') + '/privacy'); }} />
              <MenuItem icon="help-buoy-outline" label="Contact Support" onPress={() => { closeMenu(); Linking.openURL('mailto:support@vybelocal.com'); }} />

              {/* Brand / Extra */}
              <SectionDivider />
              <Text style={{ color:'#9CA3AF', fontSize:12, fontWeight:'700', paddingHorizontal:16, paddingBottom:4 }}>Extra</Text>
              <MenuItem icon="star-outline" label="Become a paid event Host" onPress={() => { closeMenu(); navigation.navigate('Host'); }} />
              <MenuItem icon="heart-outline" label="Support VybeLocal" onPress={() => { closeMenu(); Linking.openURL((Constants?.expoConfig?.extra?.apiBaseUrl || 'https://vybelocal.com') + '/patron'); }} />
              <MenuItem icon="logo-instagram" label="Follow Us" onPress={() => { closeMenu(); Linking.openURL('https://instagram.com/joinvybelocal'); }} />

              {/* Sign out */}
              <SectionDivider />
              <View style={{ paddingHorizontal:16, paddingTop:2, paddingBottom:8 }}>
                <TouchableOpacity onPress={() => { closeMenu(); signOut(); }} style={{ backgroundColor:'#dc2626', borderRadius:10, paddingVertical:12, alignItems:'center' }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Sign out</Text>
                </TouchableOpacity>
              </View>
                </ScrollView>
              </View>
            </View>
          </Animated.View>
        </Modal>
      )}

      {/* Notification Modal (mount only when needed) */}
      {showNotificationModal && (
        <NotificationModal 
          visible
          onClose={() => setShowNotificationModal(false)}
        />
      )}
    </View>
  );
} 

function SectionDivider(){
  return <View style={{ height:1, backgroundColor:'#374151', marginVertical:8, opacity:0.6 }} />
}

function MenuItem({ icon, label, onPress }){
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:10 }}>
      <Ionicons name={icon} size={20} color="#E5E7EB" style={{ marginRight:12 }} />
      <Text style={{ color:'#E5E7EB', fontSize:14, fontWeight:'600', flex:1 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );
}