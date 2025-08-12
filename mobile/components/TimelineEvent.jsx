import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Switch, Alert, ScrollView, LayoutAnimation, Platform, Animated } from 'react-native';
import { format, differenceInMinutes } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import RSVPButton from './RSVPButton';
import { supabase } from '../utils/supabase';
import ProfileModal from './ProfileModal';
import EventChatModal from './EventChatModal';
import { notificationUtils } from '../utils/notifications';
import { notifBus } from '../utils/notifications';
import { useAuth } from '../auth/AuthProvider';

function TimelineEvent({ event, onCancel }) {
  const { user } = useAuth();
  const isHost = user?.id === event?.host_id;
  // Safely parse event start time to avoid "Invalid time value" errors
  const eventStart = (() => {
    try {
      if (!event?.starts_at) return null;
      const d = new Date(event.starts_at);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  })();

  const minutesAway = eventStart ? differenceInMinutes(eventStart, new Date()) : 0;
  const countdown = eventStart && minutesAway > 0
    ? (minutesAway < 60 ? `Starts in ${minutesAway}m` : `Starts in ${Math.round(minutesAway/60)}h`)
    : null;
  const [remind, setRemind] = useState(true);
  const [avatars, setAvatars] = useState([]);
  
  // Layout animations enabled

  const [expanded, setExpanded] = useState(false);
  const [attendees, setAttendees] = useState([]); // full list
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [profileModal, setProfileModal] = useState({ visible:false, profile:null, stats:{} });
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationSubscription, setNotificationSubscription] = useState(null);

  // helper to resolve avatar path to signed URL
  const resolveAvatarUrl = async (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    try {
      const { data } = await supabase.storage
        .from('profile-images')
        .createSignedUrl(path, 3600, {
          transform: { width: 64, height: 64, resize: 'cover', quality: 60 },
        });
      return data?.signedUrl || null;
    } catch {
      return null;
    }
  };

  // load initial avatars from event payload (if any)
  useEffect(() => {
    (async () => {
      const raw = event.attendees?.avatars?.slice(0,4) || [];
      if (!raw.length) return;
      const urls = await Promise.all(raw.map(resolveAvatarUrl));
      setAvatars(urls.filter(Boolean));
    })();
  }, [event.attendees?.avatars]);

  // Fetch avatars via public_user_cards view if not provided or empty
  useEffect(() => {
    if (avatars.length || !event.id) return;
    (async () => {
      try {
        // Get up to 4 user_ids who RSVP'd
        const { data: rRows } = await supabase
          .from('rsvps')
          .select('user_id')
          .eq('event_id', event.id)
          .limit(4);
        const userIds = (rRows || []).map(r => r.user_id);
        if (!userIds.length) return;

        const { data: profRows } = await supabase
          .from('public_user_cards')
          .select('avatar_url')
          .in('uuid', userIds);

        const urls = await Promise.all(
          (profRows || []).map(p => resolveAvatarUrl(p.avatar_url))
        );
        setAvatars(urls.filter(Boolean));
      } catch {
        /* ignore */
      }
    })();
  }, [event.id, avatars.length]);

  /* load attendee list when expanded first time */
  useEffect(() => {
    if (!expanded || attendees.length || !event.id) return;
    (async () => {
      try {
        const { data: rows } = await supabase
          .from('rsvps')
          .select('user_id')
          .eq('event_id', event.id);
        const ids = (rows || []).map(r => r.user_id);
        if (!ids.length) return;
        const { data: profiles } = await supabase
          .from('public_user_cards')
          .select('uuid,name,avatar_url')
          .in('uuid', ids);
        const items = await Promise.all(
          (profiles || []).map(async p => ({
            name: p.name,
            avatar: await resolveAvatarUrl(p.avatar_url),
          }))
        );
        setAttendees(items.filter(i=>i.avatar));
      } catch {
        /* ignore */
      }
    })();
  }, [expanded, event.id]);

  useEffect(() => {
    if (expanded && attendees.length) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue:1, duration:250, useNativeDriver:true }).start();
    }
  }, [expanded, attendees.length]);

  // Load unread count from Supabase notifications
  useEffect(() => {
    if (event?.id && user?.id) {
      loadUnreadCount();
    }
  }, [event?.id, user?.id]);

  // Listen to global unread update events
  useEffect(() => {
    const handler = ({ eventId, count }) => {
      if (eventId === event.id) setUnreadCount(count);
    };
    notifBus.on('chat_unread', handler);
    return () => notifBus.off('chat_unread', handler);
  }, [event.id]);



  const toggleExpand = () => {
    LayoutAnimation.configureNext({ duration:300, update:{ type:'easeInEaseOut' } });
    const next = !expanded;
    setExpanded(next);
    if (!next) {
      fadeAnim.setValue(0);
    }
  };

  const openChatModal = async () => {
    // Mark notifications as read in Supabase when opening chat
    if (user?.id) {
      await notificationUtils.markChatNotificationsRead(user.id, event.id);
    }
    setUnreadCount(0); // Reset local count
    setChatModalVisible(true);
  };

  const loadUnreadCount = async () => {
    if (!user?.id) return;
    
    try {
      const count = await notificationUtils.getEventUnreadCount(user.id, event.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const openProfile = async (uuid) => {
    try {
      const { data: prof } = await supabase
        .from('public_user_cards')
        .select('*')
        .eq('uuid', uuid)
        .single();
      // stats: completed & cancels reuse same queries as earlier minimal
      const [{ count: completed }, { data: strikeRow }] = await Promise.all([
        supabase.from('v_past_events').select('id', { count:'exact', head:true }).eq('host_id', uuid),
        supabase.from('v_host_strikes_last6mo').select('strike_count').eq('host_id', uuid).maybeSingle(),
      ]);
      setProfileModal({ visible:true, profile: prof, stats:{ completed: completed||0, cancels: Number(strikeRow?.strike_count||0) } });
    } catch {
      // ignore
    }
  };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={toggleExpand} style={styles.card}> 
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 200, 162, 0.8)']}
        start={{x: 0, y: 0}}
        end={{x: 0, y: 1}}
        style={styles.gradientCard}
      >
        {/* Row 1 - thumbnail & title */}
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          {event.imageUrl ? (
            <Image source={{ uri:event.imageUrl }} style={styles.thumb} />
          ) : (
            <View style={[styles.circle,{ backgroundColor: 'rgba(186, 164, 235, 0.3)' }]} />
          )}
          <View style={{ marginLeft:12, flex:1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
              {!!eventStart && (
                <Text style={styles.time}>{format(eventStart, 'h:mm a')}</Text>
              )}
            </View>
            <TouchableOpacity onPress={openChatModal} style={styles.chatBubble}>
              <Text style={styles.chatBubbleEmoji}>💬</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {unreadCount > 99 ? '99+' : unreadCount.toString()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      {/* Description */}
      {event.description ? (
        <Text style={styles.desc} numberOfLines={2}>
          “{event.description}”
        </Text>
      ) : null}
      {/* Attendee Row / Expandable */}
      <View style={styles.statusRow}>
        {!expanded && (
          <TouchableOpacity style={{ flexDirection:'row', alignItems:'center' }} onPress={toggleExpand} activeOpacity={0.8}>
            {avatars.length ? (
              <View style={{ flexDirection:'row', marginRight:8 }}>
                {avatars.slice(0,4).map((url,idx)=>(
                  <Image
                    key={idx}
                    source={{ uri:url || 'https://placehold.co/28x28' }}
                    style={[styles.attAvatar, { marginLeft: idx === 0 ? 0 : -18, zIndex: 10 - idx }]}
                  />
                ))}
              </View>
            ) : null}
            {(() => {
              const attendeeCount = event.attendees?.count || 0;
              
              if (attendeeCount <= 0) {
                return null;
              } else if (attendeeCount === 1) {
                return <Text style={styles.statusText}>1 Local going</Text>;
              } else {
                return <Text style={styles.statusText}>{attendeeCount} Locals going</Text>;
              }
            })()}
          </TouchableOpacity>
        )}
        {expanded && (
          <Text style={styles.localsLabel}>Locals going:</Text>
        )}
        <RSVPButton event={event} compact />
      </View>

      {expanded && (
        <Animated.View style={{ marginTop:12, opacity: fadeAnim }}>
          <ScrollView style={styles.attendeeList} showsVerticalScrollIndicator>
            {attendees.map((item, idx) => (
              <TouchableOpacity key={idx.toString()} style={styles.attendeeRow} onPress={()=>openProfile(item.uuid)}>
                <Image source={{ uri:item.avatar }} style={styles.attendeeAvatar} />
                <Text style={styles.attendeeName}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Share button positioned below attendee list */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12 }}>
            <TouchableOpacity onPress={() => console.log('Share event:', event.id)} style={styles.shareButton}>
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
      {/* Footer row toggle */}
      <View style={styles.footerRow}>
        {countdown && <Text style={styles.countdown}>{countdown}</Text>}
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <Text style={{ color:'#374151', marginRight:6, fontSize:12, fontWeight:'600' }}>Reminders</Text>
          <Switch value={remind} onValueChange={setRemind} thumbColor={remind? '#BAA4EB': '#888'} trackColor={{ true: '#BAA4EB88', false:'#cbd5e1' }} />
        </View>
      </View>
      </LinearGradient>
      <ProfileModal
        visible={profileModal.visible}
        profile={profileModal.profile}
        stats={profileModal.stats}
        onClose={() => setProfileModal({ ...profileModal, visible:false })}
      />
      <EventChatModal
        visible={chatModalVisible}
        onClose={() => setChatModalVisible(false)}
        event={event}
      />
    </TouchableOpacity>
  );
}

const arePropsEqual = (prevProps, nextProps) => {
  const p = prevProps.event || {};
  const n = nextProps.event || {};
  const pCount = p.attendees?.count || 0;
  const nCount = n.attendees?.count || 0;
  return (
    p.id === n.id &&
    p.starts_at === n.starts_at &&
    p.imageUrl === n.imageUrl &&
    pCount === nCount
  );
};

export default React.memo(TimelineEvent, arePropsEqual);

const styles = StyleSheet.create({
  // Enhanced card with gradient and shadows
  card: { 
    borderRadius: 20, 
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(186, 164, 235, 0.3)',
  },
  gradientCard: {
    borderRadius: 20,
    padding: 16,
  },
  thumb: { 
    width: 36, 
    height: 36, 
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#BAA4EB',
    shadowColor: '#BAA4EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  circle: { 
    width: 36, 
    height: 36, 
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#BAA4EB',
    shadowColor: '#BAA4EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  time: { color: '#6b7280', fontSize: 12, fontWeight: '500' },
  desc: { color: '#374151', marginTop: 8, fontStyle: 'italic', fontSize: 14, fontWeight: '500' },
  statusRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderTopWidth: 1, 
    borderColor: 'rgba(186, 164, 235, 0.3)', 
    marginTop: 12, 
    paddingTop: 12 
  },
  statusText: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  attAvatar: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: 'rgba(186, 164, 235, 0.2)', 
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#BAA4EB',
  },
  localsLabel: { color: '#374151', fontSize: 14, fontWeight: '700' },
  attendeeList: { maxHeight: 6*48 },
  attendeeRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8,
  },
  attendeeAvatar: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    marginRight: 12, 
    backgroundColor: 'rgba(186, 164, 235, 0.2)',
    borderWidth: 2,
    borderColor: '#BAA4EB',
    shadowColor: '#BAA4EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  attendeeName: { color: '#1f2937', fontSize: 14, fontWeight: '600' },

  footerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(186, 164, 235, 0.3)',
    paddingTop: 12,
  },
  countdown: { 
    color: '#F97316', 
    fontSize: 12, 
    fontWeight: '700',
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F97316',
  },
  joinChatButton: {
    backgroundColor: '#BAA4EB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#BAA4EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(186, 164, 235, 0.5)',
  },
  joinChatText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  chatBubble: {
    backgroundColor: '#BAA4EB',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#BAA4EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(186, 164, 235, 0.5)',
  },
  chatBubbleEmoji: {
    fontSize: 18,
    color: '#fff',
  },
  unreadBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 999,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 6,
  },
  shareButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
}); 