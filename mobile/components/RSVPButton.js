// mobile/components/RSVPButton.js
import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../utils/supabase';
import realTimeChatManager from '../utils/realTimeChat';
import colors from '../theme/colors';

export default function RSVPButton({ event, onCountChange, compact = false }) {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rsvpCount, setRsvpCount] = useState(0);
  const capacity = event?.rsvp_capacity ?? null;

  // Fetch whether current user already RSVP'd
  useEffect(() => {
    if (!user) { setJoined(false); return; }
    let cancelled = false;

    const fetchJoined = async () => {
      const { data, error } = await supabase
        .from('rsvps')
        .select('user_id')
        .eq('event_id', event.id)
        .eq('user_id', user.id);
      if (!cancelled) {
        if (error) console.error('RSVPButton: fetchJoined error', error);
        setJoined((data?.length ?? 0) > 0);
      }
    };
    fetchJoined();
    return () => { cancelled = true; };
  }, [user, event.id]);

  // Fetch RSVP count
  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      const { count, error } = await supabase
        .from('rsvps')
        .select('event_id', { count: 'exact' })
        .eq('event_id', event.id);
      if (!cancelled) {
        if (error) console.error('RSVPButton: fetchCount error', error);
        setRsvpCount(count ?? 0);
        if (typeof onCountChange === 'function') onCountChange(count ?? 0);
      }
    };
    fetchCount();
    return () => { cancelled = true; };
  }, [event.id]);

  const handlePress = async () => {
    if (busy) return;

    if (!user) {
      // Redirect unauthenticated users to login screen
      navigation.navigate('Login');
      return;
    }

    if (!joined && capacity && rsvpCount >= capacity) {
      Alert.alert('Capacity reached', 'This event is at maximum capacity.');
      return;
    }

    setBusy(true);
    if (!joined) {
      // Insert RSVP row
      const { error } = await supabase.from('rsvps').insert({ event_id: event.id, user_id: user.id }, { ignoreDuplicates: true });
      if (error) {
        console.error('RSVPButton: join error', error);
        Alert.alert('Error', 'Something went wrong.');
      } else {
        setJoined(true);
        const newCount = rsvpCount + 1;
        setRsvpCount(newCount);
        if (typeof onCountChange === 'function') onCountChange(newCount);

        // Removed background auto-subscribe to conserve resources
      }
      setBusy(false);
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
            const { error } = await supabase.from('rsvps').delete().match({ event_id: event.id, user_id: user.id });
            if (error) {
              console.error('RSVPButton: cancel error', error);
              Alert.alert('Error', 'Something went wrong.');
            } else {
              setJoined(false);
              const newCount = rsvpCount - 1;
              setRsvpCount(newCount);
              if (typeof onCountChange === 'function') onCountChange(newCount);

              // Removed background auto-unsubscribe (connection no longer created)
            }
            setBusy(false);
          },
        },
      ]);
    }
  };

  const disabled = (!joined && capacity && rsvpCount >= capacity) || busy;

  let label;
  if (busy) {
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
        joined ? styles.joined : styles.notJoined,
        disabled && styles.disabled,
        dynamicStyle,
      ]}
      onPress={(e) => { e.stopPropagation?.(); handlePress(); }}
      disabled={disabled}
      activeOpacity={0.8}
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
  disabled: {
    opacity: 0.55,
  },
  text: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
}); 