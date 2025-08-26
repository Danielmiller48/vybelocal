// mobile/components/RSVPButton.js
import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../utils/supabase';
import Constants from 'expo-constants';
import realTimeChatManager from '../utils/realTimeChat';
import colors from '../theme/colors';

export default function RSVPButton({ event, onCountChange, compact = false }) {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rsvpCount, setRsvpCount] = useState(0);
  const capacity = event?.rsvp_capacity ?? null;
  const isHost = user?.id === event?.host_id;

  const MAIN_API_BASE_URL = Constants.expoConfig?.extra?.mainApiBaseUrl || process.env?.EXPO_PUBLIC_MAIN_API_BASE_URL;
  const API_BASE_URL = MAIN_API_BASE_URL || Constants.expoConfig?.extra?.apiBaseUrl || process.env?.EXPO_PUBLIC_API_BASE_URL || 'https://vybelocal.com';
  const WRITE_API_BASE_URL = Constants.expoConfig?.extra?.waitlistApiBaseUrl || process.env?.EXPO_PUBLIC_WAITLIST_API_BASE_URL || 'https://vybelocal-waitlist.vercel.app';
  const debug = (...args) => { try { console.log('[mobile][RSVP]', ...args); } catch {} };
  debug('config', { MAIN_API_BASE_URL: !!MAIN_API_BASE_URL ? MAIN_API_BASE_URL : null, API_BASE_URL, WRITE_API_BASE_URL });

  // Fetch whether current user already RSVP'd
  useEffect(() => {
    if (!user) { setJoined(false); return; }
    let cancelled = false;

    const fetchJoined = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const url = `${WRITE_API_BASE_URL}/api/rsvps?eventId=${encodeURIComponent(event.id)}&joinedForMe=1`;
      debug('GET joined start', { url, hasToken: !!token });
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        const text = await res.text();
        debug('GET joined response', { status: res.status, body: (text || '').slice(0, 200) });
        let json;
        try { json = JSON.parse(text); } catch { json = {}; }
        if (!cancelled) setJoined(!!json?.joined);
      } catch (e) {
        debug('GET joined error', e?.message || e);
        if (!cancelled) setJoined(false);
      }
    };
    fetchJoined();
    return () => { cancelled = true; };
  }, [user, event.id]);

  // Fetch RSVP count
  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      const url = `${WRITE_API_BASE_URL}/api/rsvps?eventId=${encodeURIComponent(event.id)}`;
      debug('GET count start', { url });
      try {
        const res = await fetch(url, { method: 'GET' });
        const text = await res.text();
        debug('GET count response', { status: res.status, body: (text || '').slice(0, 200) });
        let json;
        try { json = JSON.parse(text); } catch { json = {}; }
        if (!cancelled) {
          const count = json?.count ?? 0;
          setRsvpCount(count);
          if (typeof onCountChange === 'function') onCountChange(count);
        }
      } catch (e) {
        debug('GET count error', e?.message || e);
        if (!cancelled) {
          setRsvpCount(0);
          if (typeof onCountChange === 'function') onCountChange(0);
        }
      }
    };
    fetchCount();
    return () => { cancelled = true; };
  }, [event.id]);

  const handlePress = async () => {
    if (busy) { debug('press ignored: busy'); return; }

    if (!user) {
      // Redirect unauthenticated users to login screen
      navigation.navigate('Login');
      return;
    }

    // Hosts can't RSVP to their own events
    if (isHost) { debug('press ignored: isHost'); return; }

    if (!joined && capacity && rsvpCount >= capacity) {
      Alert.alert('Capacity reached', 'This event is at maximum capacity.');
      debug('press blocked: capacity reached', { capacity, rsvpCount });
      return;
    }

    setBusy(true);
    if (!joined) {
      // Insert RSVP via API
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const url = `${WRITE_API_BASE_URL}/api/rsvps`;
        const body = JSON.stringify({ event_id: event.id });
        debug('POST start', { url, hasToken: !!token, body });
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body,
        });
        const text = await res.text();
        debug('POST response', { status: res.status, body: (text || '').slice(0, 200) });
        if (!res.ok) throw new Error(text || 'Failed');
        setJoined(true);
        const newCount = rsvpCount + 1;
        setRsvpCount(newCount);
        if (typeof onCountChange === 'function') onCountChange(newCount);
      } catch (e) {
        debug('POST error', e?.message || e);
        Alert.alert('Error', 'Something went wrong.');
      } finally {
        setBusy(false);
      }
    } else {
      // Confirm cancellation
      Alert.alert('Cancel RSVP', 'Are you sure you want to cancel?', [
        {
          text: 'No',
          style: 'cancel',
          onPress: () => setBusy(false),
        },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const token = session?.access_token;
              const url = `${WRITE_API_BASE_URL}/api/rsvps`;
              const body = JSON.stringify({ event_id: event.id });
              debug('DELETE start', { url, hasToken: !!token, body });
              const res = await fetch(url, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body,
              });
              const text = await res.text();
              debug('DELETE response', { status: res.status, body: (text || '').slice(0, 200) });
              if (!res.ok) throw new Error(text || 'Failed');
              setJoined(false);
              const newCount = Math.max(0, rsvpCount - 1);
              setRsvpCount(newCount);
              if (typeof onCountChange === 'function') onCountChange(newCount);
            } catch (e) {
              debug('DELETE error', e?.message || e);
              Alert.alert('Error', 'Something went wrong.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    }
  };

  const disabled = (!joined && capacity && rsvpCount >= capacity) || busy;

  let label;
  if (isHost) {
    label = 'Hosting';
  } else if (busy) {
    label = '…';
  } else if (joined) {
    label = 'Cancel RSVP';
  } else if (!joined && capacity && rsvpCount >= capacity) {
    label = 'Max capacity';
  } else {
    label = 'RSVP';
  }

  const dynamicStyle = compact
    ? {
        width: 'auto',
        paddingVertical: 6,
        paddingHorizontal: 16,
        marginTop: 0,
      }
    : {};

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isHost ? styles.hosting : (joined ? styles.joined : styles.notJoined),
        disabled && styles.disabled,
        dynamicStyle,
      ]}
      onPress={(e) => { e.stopPropagation?.(); handlePress(); }}
      disabled={disabled || isHost}
      activeOpacity={isHost ? 1 : 0.8}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.text}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  joined: {
    backgroundColor: colors.accent,
  },
  notJoined: {
    backgroundColor: colors.primary,
  },
  hosting: {
    backgroundColor: '#BAA4EB',
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
}); 