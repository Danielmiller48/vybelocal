// mobile/screens/PastVybesScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import TimelineEvent from '../components/TimelineEvent';
import TimelineSectionHeader from '../components/TimelineSectionHeader';
import { supabase } from '../utils/supabase';
import { useAuth } from '../auth/AuthProvider';
import { format } from 'date-fns';
import AppHeader from '../components/AppHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function PastVybesScreen() {
  const { user } = useAuth();
  const [pastEvents, setPastEvents] = useState([]);
  const [listData, setListData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [first, setFirst] = useState('');
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const loadPastEvents = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get all past events the user attended
      const { data: rows } = await supabase
        .from('events')
        .select('*, rsvps!inner(user_id)')
        .eq('rsvps.user_id', user.id);

      const now = new Date();
      const pastRows = rows?.filter(ev => new Date(ev.starts_at) < now) || [];

      // Enrich with additional data (images, attendee count)
      const pastEventsData = await Promise.all(pastRows.map(async ev => {
        let imageUrl = null;
        if (ev.img_path) {
          try {
            const { data: imgData } = await supabase.storage
              .from('event-images')
              .createSignedUrl(ev.img_path, 3600, {
                transform: { width: 800, height: 600, resize: 'cover' },
              });
            imageUrl = imgData?.signedUrl || null;
          } catch { /* ignore */ }
        }

        // Get attendee avatars (limit 3 for display)
        const { data: avatarRows } = await supabase
          .from('rsvps')
          .select('profiles!inner(avatar_url)')
          .eq('event_id', ev.id)
          .limit(3);

        const avatars = (avatarRows || []).map(r => r.profiles?.avatar_url).filter(Boolean);

        // Get total attendee count
        const { count } = await supabase
          .from('rsvps')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', ev.id);

        return { ...ev, imageUrl, attendees: { avatars, count } };
      }));

      // Sort by most recent first
      pastEventsData.sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
      setPastEvents(pastEventsData);
      
      // Create flat list data with headers
      const flatListData = [];
      pastEventsData.forEach((event, index) => {
        const dateKey = format(new Date(event.starts_at), 'yyyy-MM-dd');
        const prevDateKey = index > 0 ? format(new Date(pastEventsData[index - 1].starts_at), 'yyyy-MM-dd') : null;
        
        // Add header if needed
        if (dateKey !== prevDateKey) {
          flatListData.push({
            type: 'header',
            id: `header-${dateKey}`,
            date: new Date(event.starts_at),
          });
        }
        
        // Add event
        flatListData.push({
          type: 'event',
          id: `event-${event.id}`,
          event: event,
        });
      });
      
      setListData(flatListData);
    } catch (error) {
      console.error('Error loading past events:', error);
      setPastEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReportEvent = useCallback((event) => {
    Alert.alert(
      'Report Event',
      'Report inappropriate behavior or issues with this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement reporting functionality
            Alert.alert('Report Submitted', 'Thank you for your report. Our moderation team will review it shortly.');
          }
        }
      ]
    );
  }, []);

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'header') {
      return <TimelineSectionHeader date={item.date} isToday={false} />;
    }
    
    return (
      <View style={styles.eventContainer}>
        <TimelineEvent 
          event={item.event} 
          onCancel={() => {/* No cancel for past events */}} 
        />
        <TouchableOpacity 
          style={styles.reportButton}
          onPress={() => handleReportEvent(item.event)}
        >
          <Ionicons name="flag-outline" size={16} color="#ef4444" />
          <Text style={styles.reportText}>Report Issue</Text>
        </TouchableOpacity>
      </View>
    );
  }, [handleReportEvent]);

  const keyExtractor = useCallback((item) => item.id, []);

  const getItemLayout = useCallback((data, index) => ({
    length: 200, // Approximate item height
    offset: 200 * index,
    index,
  }), []);

  useEffect(() => {
    if (!user) return;

    // Fetch user's first name
    supabase.from('profiles').select('name').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data?.name) { setFirst(data.name.split(' ')[0]); }
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (isFocused) loadPastEvents();
  }, [isFocused, user?.id]);

  return (
    <LinearGradient 
      colors={['rgba(203,180,227,0.2)', 'rgba(255,200,162,0.4)']} 
      style={{ flex: 1 }} 
      start={{ x: 0, y: 0 }} 
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'left', 'right']}>
        <AppHeader />
        
        {/* Header with back button */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#001f3f" />
          </TouchableOpacity>
          <Text style={styles.title}>Past Vybes</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <Text style={styles.subhead}>Your event history:</Text>

          {loading ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: '#001f3f' }}>Loading your past events...</Text>
            </View>
          ) : listData.length > 0 ? (
            <FlatList
              data={listData}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={5}
              updateCellsBatchingPeriod={50}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          ) : (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="calendar-outline" size={48} color="#001f3f" style={{ opacity: 0.5 }} />
              <Text style={styles.emptyText}>No past events yet.</Text>
              <Text style={styles.emptySubtext}>Events you attend will appear here for reference.</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 31, 63, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    color: '#001f3f',
    fontSize: 20,
    fontWeight: '700',
    textShadowColor: 'rgba(255,255,255,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subhead: {
    color: '#001f3f',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
  },
  eventContainer: {
    marginBottom: 8,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
    marginHorizontal: 4,
  },
  reportText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyText: {
    color: '#001f3f',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#001f3f',
    fontSize: 14,
    opacity: 0.7,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
