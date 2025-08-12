import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, SafeAreaView } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import TimelineEvent from '../components/TimelineEvent';
import TimelineSectionHeader from '../components/TimelineSectionHeader';
import AppHeader from '../components/AppHeader';
import HomeDrawerOverlay from '../components/HomeDrawerOverlay';
import { supabase } from '../utils/supabase';
import { useAuth } from '../auth/AuthProvider';
import { format } from 'date-fns';

export default function TrackedHostsScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [listData, setListData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrackedHostEvents = useCallback(async () => {
    if (!user) return;

    try {
      // First get the host IDs that the user is following
      const { data: followedHosts, error: followError } = await supabase
        .from('host_follows')
        .select('host_id')
        .eq('follower_id', user.id);

      if (followError) {
        console.error('Error fetching followed hosts:', followError);
        return;
      }

      if (!followedHosts || followedHosts.length === 0) {
        setEvents([]);
        setListData([]);
        return;
      }

      // Extract the host IDs
      const hostIds = followedHosts.map(follow => follow.host_id);

      // Debug: Check what events exist for the followed host (without filters)
      const { data: allHostEvents } = await supabase
        .from('events')
        .select('id')
        .in('host_id', hostIds);

      // Now get events from those hosts (without join first)
      const { data: trackedEvents, error } = await supabase
        .from('events')
        .select(`
          *,
          rsvps (
            user_id,
            paid
          )
        `)
        .eq('status', 'approved')
        .gte('starts_at', new Date().toISOString())
        .in('host_id', hostIds)
        .order('starts_at', { ascending: true });

      if (error) {
        console.error('Error fetching tracked host events:', error);
        return;
      }

      // Process events with image URLs, host profiles, and attendee counts
      const processedEvents = await Promise.all(
        (trackedEvents || []).map(async (event) => {
          // Get host profile data
          const { data: hostProfile } = await supabase
            .from('profiles')
            .select('id, name, avatar_url, is_trusted')
            .eq('id', event.host_id)
            .single();

          // Resolve image URL from img_path (storage)
          let imageUrl = null;
          if (event.img_path) {
            try {
              if (event.img_path.startsWith('http')) {
                imageUrl = event.img_path;
              } else {
                const { data: imgData } = await supabase.storage
                  .from('event-images')
                  .createSignedUrl(event.img_path, 3600, {
                    transform: { width: 800, height: 600, resize: 'cover' },
                  });
                imageUrl = imgData?.signedUrl || null;
              }
            } catch {}
          }

          // Process attendees with avatars
          const attendeesWithAvatars = await Promise.all(
            (event.rsvps || []).slice(0, 3).map(async (rsvp) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, name, avatar_url')
                .eq('id', rsvp.user_id)
                .single();

              if (profile) {
                let avatarUrl = 'https://placehold.co/40x40';
                if (profile.avatar_url) {
                  if (profile.avatar_url.startsWith('http')) {
                    avatarUrl = profile.avatar_url;
                  } else {
                    const { data } = await supabase.storage
                      .from('profile-images')
                      .createSignedUrl(profile.avatar_url, 3600);
                    if (data?.signedUrl) avatarUrl = data.signedUrl;
                  }
                }
                return { ...profile, avatarUrl };
              }
              return null;
            })
          );

          // Ensure date is in proper format
          let formattedStartsAt = event.starts_at;
          try {
            formattedStartsAt = new Date(event.starts_at).toISOString();
          } catch (dateError) {
            console.error('Error formatting date for event:', event.id, event.starts_at);
            formattedStartsAt = new Date().toISOString(); // Fallback to current time
          }

          return {
            ...event,
            profiles: hostProfile, // Add the host profile data
            starts_at: formattedStartsAt,
            imageUrl,
            attendees: {
              avatars: attendeesWithAvatars.filter(Boolean),
              count: event.rsvps?.length || 0
            }
          };
        })
      );

      setEvents(processedEvents);
      
      // Create flat list data with section headers (match HomeScreen logic)
      const flatListData = [];
      // Ensure events are sorted by start time
      processedEvents.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      let prevDateKey = null;

      processedEvents.forEach((ev, idx) => {
        try {
          const d = new Date(ev.starts_at);
          if (isNaN(d.getTime())) return; // skip invalid dates
          const dateKey = format(d, 'yyyy-MM-dd');
          if (dateKey !== prevDateKey) {
            flatListData.push({ type: 'header', id: `hdr-${dateKey}`, date: d.toISOString(), isToday: idx === 0 });
            prevDateKey = dateKey;
          }
          flatListData.push({ type: 'event', ...ev, id: ev.id });
        } catch (e) {
          console.error('Error grouping event by date:', ev.id, ev.starts_at, e);
        }
      });

      setListData(flatListData);
    } catch (error) {
      console.error('Error loading tracked host events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (isFocused) {
      loadTrackedHostEvents();
    }
  }, [isFocused, loadTrackedHostEvents]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadTrackedHostEvents();
  }, [loadTrackedHostEvents]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'header') {
      const headerDate = new Date(item.date);
      return <TimelineSectionHeader date={headerDate} isToday={item.isToday} />;
    }
    return <TimelineEvent event={item} />;
  }, []);

  const keyExtractor = useCallback((item) => item.id, []);

  const getItemLayout = useCallback((data, index) => {
    const HEADER_HEIGHT = 60;
    const EVENT_HEIGHT = 300;
    
    let offset = 0;
    let itemHeight = EVENT_HEIGHT;
    
    for (let i = 0; i < index; i++) {
      if (data[i]?.type === 'header') {
        offset += HEADER_HEIGHT;
      } else {
        offset += EVENT_HEIGHT;
      }
    }
    
    if (data[index]?.type === 'header') {
      itemHeight = HEADER_HEIGHT;
    }
    
    return { length: itemHeight, offset, index };
  }, []);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#FFFFFF', '#FFE5D9']} style={styles.container}>
          <AppHeader title="Tracked Hosts" />
          <View style={styles.emptyContainer}>
            <Ionicons name="person-outline" size={64} color="#BAA4EB" />
            <Text style={styles.emptyText}>Please log in to see tracked hosts</Text>
          </View>
          <HomeDrawerOverlay />
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#FFFFFF', '#FFE5D9']} style={styles.container}>
        <AppHeader title="Tracked Hosts" />
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading tracked events...</Text>
          </View>
        ) : listData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#BAA4EB" />
            <Text style={styles.emptyTitle}>No Tracked Hosts</Text>
            <Text style={styles.emptyText}>
              Follow hosts from their profiles to see their upcoming events here
            </Text>
          </View>
        ) : (
          <FlatList
            data={listData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#BAA4EB']}
                tintColor="#BAA4EB"
              />
            }
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={5}
            updateCellsBatchingPeriod={50}
          />
        )}
        
        <HomeDrawerOverlay />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  listContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
});
