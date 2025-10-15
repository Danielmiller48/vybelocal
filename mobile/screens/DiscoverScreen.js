import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, SectionList, ActivityIndicator, TouchableOpacity, Modal, Button, Image, Animated, PanResponder, Dimensions } from 'react-native';
import EventCard from '../components/EventCard';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import VibePicker from '../components/VibePicker';
import AppHeader from '../components/AppHeader';
import DateFilterBar from '../components/DateFilterBar';
import colors from '../theme/colors';
import { supabase } from '../utils/supabase';
import { getSignedUrl } from '../utils/signedUrlCache';
import { format, endOfWeek, startOfWeek, addDays, set as setTime } from 'date-fns';
import { useIsFocused } from '@react-navigation/native';
import RSVPButton from '../components/RSVPButton';
import { useAuth } from '../auth/AuthProvider';

// helper to group events into sections
function makeSections(events) {
  const map = {};
  events.forEach(ev => {
    const key = format(new Date(ev.starts_at), 'EEEE, MMMM d');
    if(!map[key]) map[key] = [];
    map[key].push(ev);
  });
  return Object.keys(map).sort((a,b)=> new Date(map[a][0].starts_at)-new Date(map[b][0].starts_at)).map(title=>({ title, data: map[title] }));
}

// Animated Vibe Welcome Banner
function VibeWelcomeBanner({ activeVibe }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [currentVibe, setCurrentVibe] = useState(activeVibe);

  const getVibeMessage = (vibe) => {
    switch(vibe) {
      case 'creative':
        return {
          title: '🎨 Creative',
          subtitle: 'Share something. Make something. Let people see what you\'ve got.'
        };
      case 'chill':
        return {
          title: '🌿 Chill', 
          subtitle: 'No pressure. No hype. Just laid-back Vybes and good company.'
        };
      case 'hype':
        return {
          title: '🔥 Hype',
          subtitle: 'Bring the energy. These Vybes move fast, stay loud.'
        };
      case 'active':
        return {
          title: '🏃 Active',
          subtitle: 'Get moving. These Vybes are about motion, sweat, and play.'
        };
      default:
        return {
          title: 'Your local scene awaits ✨',
          subtitle: 'Swipe left/right to explore different vibes, or use the date filter to peek at what\'s happening soon'
        };
    }
  };

  useEffect(() => {
    if (activeVibe !== currentVibe) {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        // Update content
        setCurrentVibe(activeVibe);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [activeVibe, currentVibe, fadeAnim]);

  const message = getVibeMessage(currentVibe);

  return (
    <Animated.View style={{ 
      paddingHorizontal: 20, 
      paddingVertical: 12, 
      backgroundColor: 'rgba(0,0,0,0.7)', 
      marginHorizontal: 16, 
      marginBottom: 4, 
      borderRadius: 12, 
      borderLeftWidth: 3, 
      borderLeftColor: colors.secondary,
      opacity: fadeAnim
    }}>
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
        {message.title}
      </Text>
      <Text style={{ color: '#ddd', fontSize: 13, fontStyle: 'italic', lineHeight: 18 }}>
        {message.subtitle}
      </Text>
    </Animated.View>
  );
}

// VybeLocal Empty State with Personality
function EmptyStateMessage({ vibe, dateFilter }) {
  const getVibeEmptyMessage = () => {
    switch(vibe) {
      case 'chill':
        return {
          emoji: '🌙',
          title: 'No chill vibes yet...',
          subtitle: 'Perfect time to suggest a cozy coffee hangout or sunset picnic. Be the zen your city needs.'
        };
      case 'hype':
        return {
          emoji: '🎉',
          title: 'Where\'s the party at?',
          subtitle: 'No hype events yet, but someone\'s gotta turn up the energy. Maybe that someone is you?'
        };
      case 'creative':
        return {
          emoji: '🎨',
          title: 'Creativity is taking a coffee break',
          subtitle: 'Art happens when we make it happen. Host a paint night, poetry slam, or maker meetup!'
        };
      case 'active':
        return {
          emoji: '🏃‍♀️',
          title: 'The active scene is... resting?',
          subtitle: 'Time to get those endorphins flowing! Organize a hike, pickup game, or morning yoga session.'
        };
      default:
        return {
          emoji: '🌟',
          title: 'Your local scene is just getting started',
          subtitle: 'Every amazing community starts with one person saying "let\'s do something cool together."'
        };
    }
  };

  const getDateFilterMessage = () => {
    if (dateFilter === 'week') return ' this week';
    if (dateFilter === 'weekend') return ' this weekend';
    return '';
  };

  const message = getVibeEmptyMessage();
  
  return (
    <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 40 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>{message.emoji}</Text>
      <Text style={{ 
        fontSize: 20, 
        fontWeight: '700', 
        color: '#333', 
        textAlign: 'center', 
        marginBottom: 12,
        fontFamily: 'SpaceGrotesk'
      }}>
        {message.title}{getDateFilterMessage()}
      </Text>
      <Text style={{ 
        fontSize: 15, 
        color: '#666', 
        textAlign: 'center', 
        lineHeight: 22,
        fontStyle: 'italic',
        marginBottom: 24
      }}>
        {message.subtitle}
      </Text>
      <View style={{ 
        backgroundColor: 'rgba(0,0,0,0.7)', 
        paddingHorizontal: 20, 
        paddingVertical: 12, 
        borderRadius: 25,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.2)'
      }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
          Try switching vibes or check back later! ✨
        </Text>
      </View>
    </View>
  );
}

export default function DiscoverScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const vibesArr = ['all','active','creative','hype','chill'];
  const [selected, setSelected] = useState(null);
  const [activeVibe, setActiveVibe] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // cache events per vibe for snappy switching
  const eventsCache = useRef({});
  const blockedSetRef = useRef(new Set());

  // refs & anims (unconditional to keep hook order)

  // list sliding animation
  const screenW = Dimensions.get('window').width;
  const listTranslateX = useRef(new Animated.Value(0)).current;

  // keep latest active vibe accessible inside stable callbacks
  const activeRef = useRef(activeVibe);
  useEffect(() => {
    activeRef.current = activeVibe;
  }, [activeVibe]);

  // ref so we can snap the list back to top when vibe changes
  const listRef = useRef(null);

  const scrollToTop = () => {
    if (!listRef.current) return;
    if (typeof listRef.current.scrollToLocation === 'function') {
      listRef.current.scrollToLocation({ sectionIndex:0, itemIndex:0, animated:false });
    } else if (typeof listRef.current.scrollToOffset === 'function') {
      listRef.current.scrollToOffset({ offset:0, animated:false });
    }
  };

  const slideToVibe = (dir) => {
    const idx = vibesArr.indexOf(activeRef.current);
    const nextIdx = (idx + dir + vibesArr.length) % vibesArr.length; // wrap around
    const nextVibe = vibesArr[nextIdx];

    Animated.timing(listTranslateX, { toValue: -dir * screenW, duration: 250, useNativeDriver: true }).start(() => {
      setActiveVibe(nextVibe);
      // after vibe changes, reset list scroll position to top
      scrollToTop();

      // prepare the new list off-screen (opposite side) so it slides in like a card stack
      listTranslateX.setValue(dir * screenW);
      Animated.timing(listTranslateX, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    });
  };

  // PanResponder for global left/right swipe
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 10,
      onPanResponderMove: (_, g) => {
        // Clamp so the sheet never moves more than the width of the screen (nice nudge effect)
        const scaled = g.dx * 0.15; // moderate dampening
        const maxNudge = screenW * 0.07; // 7% of width for visible nudge (~28px on 400px device)
        const clampedDx = Math.max(Math.min(scaled, maxNudge), -maxNudge);
        listTranslateX.setValue(clampedDx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > 60) {
          slideToVibe(-1); // swipe right -> previous
        } else if (g.dx < -60) {
          slideToVibe(1); // swipe left -> next
        } else {
          Animated.timing(listTranslateX, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const fetchEventsFromServer = async (vibe, filterKey) => {
    let query = supabase
        .from('events')
        .select('*')
        .eq('status', 'approved')
        .gte('starts_at', new Date().toISOString());
    if (vibe !== 'all') query = query.eq('vibe', vibe);

    // date filter range
    const now = new Date();
    let rangeStart = null;
    let rangeEnd = null;
    if(filterKey === 'week') {
      rangeStart = now;
      rangeEnd = endOfWeek(now, { weekStartsOn:1 });
    } else if(filterKey === 'weekend') {
      const friday = addDays(startOfWeek(now,{weekStartsOn:1}),4); // Friday this week
      const friFour = setTime(friday,{hours:16,minutes:0,seconds:0,milliseconds:0});
      rangeStart = now > friFour ? now : friFour;
      rangeEnd = endOfWeek(now,{weekStartsOn:1});
    }
    if(rangeStart) query = query.gte('starts_at', rangeStart.toISOString());
    if(rangeEnd) query = query.lte('starts_at', rangeEnd.toISOString());
    const { data: rows, error } = await query.order('starts_at');
    if (error) setError(error.message);
    // Client-side filter to exclude events hosted by users I have blocked
    const filtered = (rows || []).filter(ev => !blockedSetRef.current.has(ev.host_id));

    let eventsWithImgs = await Promise.all(
      filtered.map(async ev => {
        if (ev.img_path) {
          try {
            const signed = await getSignedUrl(
              supabase,
              'event-images',
              ev.img_path,
              3600,
              { transform: { width: 800, height: 600, resize: 'cover' } }
            );
            return { ...ev, imageUrl: signed || null };
          } catch {
            return { ...ev, imageUrl: null };
          }
        }
        return { ...ev, imageUrl: null };
      })
    );

    // Batch fetch RSVP attendee ids for warning badge
    try {
      const eventIds = eventsWithImgs.map(e => e.id);
      if (eventIds.length) {
        const { data: rsvps } = await supabase
          .from('rsvps')
          .select('event_id, user_id')
          .in('event_id', eventIds);
        const map = {};
        (rsvps || []).forEach(r => {
          if (!map[r.event_id]) map[r.event_id] = [];
          map[r.event_id].push(r.user_id);
        });
        eventsWithImgs = eventsWithImgs.map(ev => ({
          ...ev,
          rsvps_attendee_ids: map[ev.id] || [],
        }));
      }
    } catch {}

    eventsCache.current[`${vibe}-${filterKey}`] = eventsWithImgs;
    return eventsWithImgs;
  };

  const loadEvents = useCallback(async (vibe, filterKey, skipLoading = false) => {
    const cacheKey = `${vibe}-${filterKey}`;
    if (eventsCache.current[cacheKey]) {
      setEvents(eventsCache.current[cacheKey]);
      return;
    }
    if (!refreshing && !skipLoading) setLoading(true);
    const res = await fetchEventsFromServer(vibe, filterKey);
    setEvents(res);
    if (!skipLoading) setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadEvents(activeVibe, dateFilter);
  }, [activeVibe, dateFilter, loadEvents]);

  // Refresh when screen gains focus and reset to 'all' vibe
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      // Refresh blocked users set, then load events after it's ready
      (async ()=>{
        try {
          if (!user?.id) { blockedSetRef.current = new Set(); }
          else {
            // Users I blocked
            let myBlocks = [];
            try {
              const { data } = await supabase
                .from('blocks')
                .select('target_id')
                .eq('blocker_id', user.id)
                .eq('target_type', 'user');
              myBlocks = data || [];
            } catch {}

            // Users who blocked me
            let blockedMe = [];
            try {
              const { data } = await supabase
                .from('blocks')
                .select('blocker_id')
                .eq('target_id', user.id)
                .eq('target_type', 'user');
              blockedMe = data || [];
            } catch {}

            const excludeHostIds = new Set([
              ...myBlocks.map(b => b.target_id),
              ...blockedMe.map(b => b.blocker_id),
            ]);
            blockedSetRef.current = excludeHostIds;
          }
        } catch {}
        setActiveVibe('all');
        await loadEvents('all', dateFilter);
      })();
    }
  }, [isFocused, dateFilter, loadEvents, user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEventsFromServer(activeVibe, dateFilter);
    setEvents(eventsCache.current[`${activeVibe}-${dateFilter}`]);
    scrollToTop();
    setRefreshing(false);
  };

  // Keep list mounted to preserve translation; show empty state inside list when no events.

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', marginBottom: 8 }}>Error: {error}</Text>
        <TouchableOpacity onPress={() => setError(null)}>
          <Text style={{ color: 'blue' }}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderItem = ({ item }) => (<EventCard event={item} onPress={() => setSelected(item)} blockedIds={blockedSetRef.current} />);
  const renderSectionHeader = ({ section:{title} }) => (
    <View style={{ paddingHorizontal:16, paddingTop:20 }}>
      <View style={{ alignSelf:'flex-start', backgroundColor:colors.secondary, borderRadius:20, paddingHorizontal:18, paddingVertical:6 }}>
        <Text style={{ color:'#fff', fontSize:14, fontWeight:'700', fontFamily:'SpaceGrotesk' }}>{title}</Text>
      </View>
    </View>
  );

  const DetailModal = () => (
    <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
      {selected && (
        <View style={{ flex:1, padding:20 }}>
          <Text style={{ fontSize:24, fontWeight:'700', marginBottom:8 }}>{selected.title}</Text>
          <Text style={{ color:'#666', marginBottom:4 }}>{format(new Date(selected.starts_at), 'EEEE, MMMM d, yyyy • h:mm a')}</Text>
          <Text style={{ color:'#666', marginBottom:12 }}>Vibe: {selected.vibe}</Text>
          {selected.description ? (
            <Text style={{ marginBottom:12 }}>{selected.description}</Text>
          ) : null}
          {/* RSVP Button */}
          <RSVPButton event={selected} />
          <Button title="Close" onPress={() => setSelected(null)} />
        </View>
      )}
    </Modal>
  );

  return (
    <>
      <LinearGradient
        colors={[ 'rgba(203,180,227,0.2)', 'rgba(255,200,162,0.4)', 'rgba(0,0,0,0)' ]}
        locations={[0,0.7,1]}
        style={{ flex:1 }}
        start={{x:0,y:0}}
        end={{x:0,y:1}}
      >
      <SafeAreaView style={{ flex:1, backgroundColor:'transparent' }} edges={['top','left','right']}>
        <AppHeader />
        
        {/* VybeLocal Welcome Microcopy */}
        <VibeWelcomeBanner activeVibe={activeVibe} />
        
        <DateFilterBar active={dateFilter} onChange={(f)=>{
          setDateFilter(f);
          loadEvents(activeVibe, f, true); // Skip loading screen for date filter changes
        }} />

        <Animated.View style={{ flex:1, transform:[{ translateX: listTranslateX }] }} {...panResponder.panHandlers}>
          <SectionList
          ref={listRef}
          sections={makeSections(events)}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          refreshing={refreshing}
          onRefresh={onRefresh}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal:16, paddingVertical: 16, paddingBottom: 120 }}
          ListEmptyComponent={() => (
            loading ? <View style={{ alignItems:'center', marginTop:40 }}><ActivityIndicator size="large" /></View> :
            events.length === 0 ? <EmptyStateMessage vibe={activeVibe} dateFilter={dateFilter} /> : null
          )}
          />
        </Animated.View>
        <VibePicker active={activeVibe} onChange={setActiveVibe} translateY={new Animated.Value(0)} />
      </SafeAreaView>
      </LinearGradient>
      {loading && (
        <View style={{ position:'absolute', top:0, bottom:0, left:0, right:0, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(255,255,255,0.6)' }}>
          <ActivityIndicator size="large" />
        </View>
      )}
      <DetailModal />
    </>
  );
} 