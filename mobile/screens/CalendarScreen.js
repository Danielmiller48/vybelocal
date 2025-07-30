// mobile/screens/CalendarScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, LayoutAnimation, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import HomeDrawerOverlay from '../components/HomeDrawerOverlay';
import { format, startOfDay, addDays, isSameDay } from 'date-fns';
import { supabase } from '../utils/supabase';
import { useAuth } from '../auth/AuthProvider';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

export default function CalendarScreen() {
  const { user } = useAuth();
  const [upcoming, setUpcoming] = useState([]); // [{ date:'yyyy-MM-dd', events:[] }]
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: rows } = await supabase
        .from('events')
        .select('* , rsvps!inner(user_id)')
        .eq('rsvps.user_id', user.id);

      const now = new Date();
      const upcomingMap = {};
      rows?.forEach(ev => {
        const dateKey = format(new Date(ev.starts_at), 'yyyy-MM-dd');
        if (new Date(ev.starts_at) >= now) {
          if (!upcomingMap[dateKey]) upcomingMap[dateKey] = [];
          upcomingMap[dateKey].push(ev);
        }
      });
      setUpcoming(Object.entries(upcomingMap).map(([k, v]) => ({ date: k, events: v })));
    })();
  }, [user?.id]);

  const today = startOfDay(new Date());
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i));
  const monthLabel = format(today, 'MMMM');

  const toggle = (key) => {
    LayoutAnimation.easeInEaseOut();
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'left', 'right']}>
      <HomeDrawerOverlay />
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Month */}
        <Text style={styles.monthLabel}>{monthLabel}</Text>

        {/* Calendar Strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripWrap}>
          {days.map(d => {
            const has = upcoming.some(sec => isSameDay(new Date(sec.date), d));
            return (
              <View key={d.toISOString()} style={styles.dayCircle}>
                <Text style={styles.dayText}>{format(d, 'd')}</Text>
                {has && <View style={styles.dot} />}
              </View>
            );
          })}
        </ScrollView>

        {/* Upcoming by date */}
        {upcoming.map(sec => {
          const dateLabel = format(new Date(sec.date), 'EEEE, MMM d');
          const key = sec.date;
          const open = expanded[key];
          return (
            <View key={key} style={{ marginTop: 20 }}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggle(key)}>
                <Text style={styles.sectionText}>{dateLabel}</Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#fff" />
              </TouchableOpacity>
              {open && sec.events.map(ev => (
                <View key={ev.id} style={styles.eventRow}>
                  <View style={[styles.vibePill, { backgroundColor: '#ffffff33' }]}><Text style={styles.vibeText}>{ev.vibe}</Text></View>
                  <Text style={styles.rowText}>{format(new Date(ev.starts_at), 'h:mm a')}</Text>
                  <Text style={[styles.rowText, { flex: 1, marginLeft: 6 }]} numberOfLines={1}>{ev.title}</Text>
                </View>
              ))}
            </View>
          );
        })}

        {upcoming.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: '#fff' }}>No upcoming events yet.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  stripWrap: { paddingVertical: 8 },
  monthLabel: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 4 },
  dayCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#00000022' },
  dayText: { color: '#ffffff', fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffbc8b', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.sand, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  sectionText: { color: '#000', fontWeight: '600' },
  eventRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 10, marginTop: 6, borderRadius: 12 },
  vibePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginRight: 8 },
  vibeText: { color: '#fff', fontSize: 10 },
  rowText: { color: '#fff', fontSize: 12 }
}); 