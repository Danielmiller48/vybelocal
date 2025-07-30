import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Switch, Alert, ScrollView, LayoutAnimation, Platform, Animated } from 'react-native';
import { format, differenceInMinutes } from 'date-fns';
import colors from '../theme/colors';
import RSVPButton from './RSVPButton';
import { supabase } from '../utils/supabase';
import ProfileModal from './ProfileModal';
import EventChatModal from './EventChatModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TimelineEvent({ event, onCancel }) {
  const minutesAway = differenceInMinutes(new Date(event.starts_at), new Date());
  const countdown = minutesAway <= 0 ? null : minutesAway < 60 ? `Starts in ${minutesAway}m` : `Starts in ${Math.round(minutesAway/60)}h`;
  const [remind, setRemind] = useState(true);
  const [avatars, setAvatars] = useState([]);
  
  // Layout animations enabled

  const [expanded, setExpanded] = useState(false);
  const [attendees, setAttendees] = useState([]); // full list
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [profileModal, setProfileModal] = useState({ visible:false, profile:null, stats:{} });
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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

  // Load unread count from storage
  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const saved = await AsyncStorage.getItem(`unread_${event.id}`);
        if (saved) {
          setUnreadCount(parseInt(saved, 10) || 0);
        }
      } catch (error) {
        console.warn('Failed to load unread count:', error);
      }
    };
    
    if (event?.id) {
      loadUnreadCount();
    }
  }, [event?.id]);

  const handleCancel = () => {
    Alert.alert('Cancel RSVP', 'Are you sure you want to cancel? Fees may apply.', [
      { text:'No' },
      { text:'Yes, cancel', style:'destructive', onPress:()=> onCancel?.(event) }
    ]);
  };

  const toggleExpand = () => {
    LayoutAnimation.configureNext({ duration:300, update:{ type:'easeInEaseOut' } });
    const next = !expanded;
    setExpanded(next);
    if (!next) {
      fadeAnim.setValue(0);
    }
  };

  const openChatModal = () => {
    setUnreadCount(0); // Reset unread count when opening chat
    AsyncStorage.setItem(`unread_${event.id}`, '0'); // Persist reset
    setChatModalVisible(true);
  };

  const handleNewMessage = async () => {
    // Only increment if chat modal is not visible
    if (!chatModalVisible) {
      const newCount = unreadCount + 1;
      setUnreadCount(newCount);
      await AsyncStorage.setItem(`unread_${event.id}`, newCount.toString());
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
      {/* Row 1 - thumbnail & title */}
      <View style={{ flexDirection:'row', alignItems:'center' }}>
        {event.imageUrl ? (
          <Image source={{ uri:event.imageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.circle,{ backgroundColor:'#ddd' }]} />
        )}
        <View style={{ marginLeft:12, flex:1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
            <Text style={styles.time}>{format(new Date(event.starts_at), 'h:mm a')}</Text>
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
            <Text style={styles.statusText}>Tap to meet locals</Text>
          </TouchableOpacity>
        )}
        {expanded && (
          <Text style={styles.localsLabel}>Locals going:</Text>
        )}
        <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelTxt}>Cancel RSVP</Text>
        </TouchableOpacity>
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
          <Text style={{ color:'#fff', marginRight:6, fontSize:12 }}>Reminders</Text>
          <Switch value={remind} onValueChange={setRemind} thumbColor={remind? colors.secondary: '#888'} trackColor={{ true: colors.secondary+'88', false:'#666' }} />
        </View>
      </View>
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
        onNewMessage={handleNewMessage}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Darker semi-transparent card for better contrast on light gradients
  card:{ backgroundColor:'rgba(0,0,0,0.45)', borderRadius:20, padding:16, marginBottom:24 },
  thumb:{ width:36, height:36, borderRadius:18 },
  circle:{ width:36, height:36, borderRadius:18 },
  title:{ fontSize:16, fontWeight:'700', color:'#fff' },
  time:{ color:'#e0e0e0', fontSize:12 },
  desc:{ color:'#fff', marginTop:8, fontStyle:'italic', fontSize:14 },
  statusRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderTopWidth:1, borderColor:'rgba(255,255,255,0.15)', marginTop:12, paddingTop:12 },
  statusText:{ color:'#ffffffcc', fontSize:14 },
  attAvatar:{ width:28, height:28, borderRadius:14, backgroundColor:'#777', overflow:'hidden' },
  localsLabel:{ color:'#ffffffcc', fontSize:14, fontWeight:'600' },
  attendeeList:{ maxHeight: 6*48 },
  attendeeRow:{ flexDirection:'row', alignItems:'center', marginBottom:8 },
  attendeeAvatar:{ width:36, height:36, borderRadius:18, marginRight:8, backgroundColor:'#777' },
  attendeeName:{ color:'#fff', fontSize:14 },
  cancelBtn:{ backgroundColor:'rgba(255,255,255,0.25)', paddingHorizontal:12, paddingVertical:6, borderRadius:12 },
  cancelTxt:{ color:'#fff', fontSize:12 },
  footerRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:12 },
  countdown:{ color:'#ffbc8b', fontSize:12, fontWeight:'600' },
  joinChatButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  joinChatText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  chatBubble: {
    backgroundColor: colors.secondary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  chatBubbleEmoji: {
    fontSize: 20,
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