import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Animated, Modal, Switch, Image, FlatList } from 'react-native';
import Slider from '@react-native-community/slider';

import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

const WAITLIST_API_BASE_URL = (typeof process !== 'undefined' && (process.env?.EXPO_PUBLIC_WAITLIST_API_BASE_URL)) || 'https://vybelocal-waitlist.vercel.app';

function KybStatusBannerInline() {
  const [status, setStatus] = React.useState(null);
  const [required, setRequired] = React.useState(null);
  const [bankStatus, setBankStatus] = React.useState(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      const { data: row } = await supabase
        .from('profiles')
        .select('tilled_status, bank_verification_status, tilled_required')
        .eq('id', userId)
        .maybeSingle();
      const tstatus = row?.tilled_status || null;
      if (__DEV__) { try { console.log('[KYB][status]', { tstatus }); } catch {} }
      setStatus(tstatus);
      setRequired(row?.tilled_required || null);
      setBankStatus(row?.bank_verification_status || null);
    } catch {}
  }, []);

  React.useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useFocusEffect(React.useCallback(() => { fetchStatus(); }, [fetchStatus]));
  // Note: Avoid continuous polling to keep DB/API load minimal; we refresh on mount and focus only

  if (!status || status === 'active' || status === 'completed') return null;
  const isAction = status === 'action_required';
  const isRejected = status === 'rejected';
  const isStarted = status === 'started';
  return (
    <View style={{ backgroundColor: isAction ? '#FEE2E2' : '#DBEAFE', borderColor: isAction ? '#FCA5A5' : '#93C5FD', borderWidth:1, borderRadius:12, padding:12, marginBottom:12 }}>
      <Text style={{ fontWeight:'800', color:'#111827', marginBottom:4 }}>
        {isAction ? 'Action required' : isRejected ? 'Onboarding rejected' : isStarted ? 'Application started' : 'Account in review'}
      </Text>
      <Text style={{ color:'#374151' }}>
        {isAction ? 'Processor needs additional information to continue onboarding.' : isRejected ? 'Please contact support to resolve your application.' : isStarted ? 'Complete to begin running monetized events.' : 'Your application is being reviewed.'}
      </Text>
    </View>
  );
}
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';
import AppHeader from '../components/AppHeader';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import HostDrawerOverlay from '../components/HostDrawerOverlay';
import { useAuth } from '../auth/AuthProvider';
// duplicate import removed
import Svg, { Polyline } from 'react-native-svg';

import AIInsightCard from '../components/analytics/AIInsightCard';
import AnalyticsDrawerInsights from '../components/analytics/AnalyticsDrawerInsights';
import MiniCalendar from '../components/host/MiniCalendar';
import EventQuickModal from '../components/host/EventQuickModal';
import HostEventActionsSheet from '../components/HostEventActionsSheet';
import ConfirmCancelModal from '../components/ConfirmCancelModal';
import EventChatModal from '../components/EventChatModal';
import ProfileModal from '../components/ProfileModal';

// Collapsible Section Component
function HostSection({ title, children, defaultOpen = false, icon, headerRight=null }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <View style={{
      backgroundColor: 'white',
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          backgroundColor: '#f8f9fa',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomLeftRadius: isOpen ? 0 : 12,
          borderBottomRightRadius: isOpen ? 0 : 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {icon && (
            <Ionicons name={icon} size={20} color={colors.primary} style={{ marginRight: 12 }} />
          )}
          <Text style={{
            fontSize: 18, 
            fontWeight: '600', 
            color: '#1f2937' 
          }}>
            {title}
          </Text>
        </View>
        
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {headerRight}
          <View style={{
            padding: 4,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: '#d1d5db',
            transform: [{ rotate: isOpen ? '180deg' : '0deg' }]
          }}>
            <Ionicons name="chevron-down" size={16} color="#6b7280" />
          </View>
        </View>
      </TouchableOpacity>

      {/* Content */}
      {isOpen && (
        <View style={{ 
          padding: 16, 
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb'
        }}>
          {children}
        </View>
      )}
    </View>
  );
}



// Enhanced Event Card Component
function EventCard({ event, isPast = false }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showRsvpModal, setShowRsvpModal] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [profileModal, setProfileModal] = useState({ visible: false, profile: null, stats: {} });
  
  const progress = (event.capacity > 0 && event.rsvp_count > 0) ? (event.rsvp_count / event.capacity) : 0;
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const getStatusBadge = (status) => {
    const badges = {
      'approved': { text: 'Published', color: '#10b981', bg: '#d1fae5' },
      'pending': { text: 'Scheduled', color: '#f59e0b', bg: '#fef3c7' },
      'cancelled': { text: 'Canceled', color: '#ef4444', bg: '#fee2e2' },
    };
    return badges[status] || badges.pending;
  };

  const badge = getStatusBadge(event.status);
  const eventDate = new Date(event.starts_at);
  const isToday = eventDate.toDateString() === new Date().toDateString();

  // Load attendees when modal opens
  const loadAttendees = async () => {
    if (loadingAttendees || !event.id) return;
    
    setLoadingAttendees(true);
    try {
      // Get RSVP user IDs
      const { data: rsvpData, error: rsvpError } = await supabase
        .from('rsvps')
        .select('user_id, paid, created_at')
        .eq('event_id', event.id)
        .eq('status', 'attending')
        .order('created_at', { ascending: true });

      if (rsvpError) throw rsvpError;

      if (!rsvpData || rsvpData.length === 0) {
        setAttendees([]);
        return;
      }

      const userIds = rsvpData.map(rsvp => rsvp.user_id);

      // Get user profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);

      if (profileError) throw profileError;

      // Combine RSVP data with profile data and resolve avatar URLs
      const attendeesList = await Promise.all(
        rsvpData.map(async (rsvp) => {
          const profile = profileData.find(p => p.id === rsvp.user_id);
          let avatarUrl = 'https://placehold.co/40x40';
          
          if (profile?.avatar_url) {
            if (profile.avatar_url.startsWith('http')) {
              avatarUrl = profile.avatar_url;
            } else {
              try {
                const { data: urlData } = await supabase.storage
                  .from('profile-images')
                  .createSignedUrl(profile.avatar_url, 3600);
                avatarUrl = urlData?.signedUrl || 'https://placehold.co/40x40';
              } catch {
                avatarUrl = 'https://placehold.co/40x40';
              }
            }
          }
          
          return {
            id: rsvp.user_id,
            name: profile?.name || 'Unknown User',
            avatar_url: avatarUrl,
            paid: rsvp.paid,
            rsvp_date: rsvp.created_at
          };
        })
      );

      setAttendees(attendeesList);
    } catch (error) {
      setAttendees([]);
    } finally {
      setLoadingAttendees(false);
    }
  };

  // Load attendees when modal opens
  React.useEffect(() => {
    if (showRsvpModal && attendees.length === 0) {
      loadAttendees();
    }
  }, [showRsvpModal]);

  // Pulse animation for close button
  React.useEffect(() => {
    if (showRsvpModal) {
      const pulse = () => {
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start(() => pulse());
      };
      pulse();
    }
  }, [showRsvpModal, pulseAnim]);

  // Function to open profile modal for an attendee
  const openProfile = async (userId) => {
    try {
      const { data: prof } = await supabase
        .from('public_user_cards')
        .select('*')
        .eq('uuid', userId)
        .single();
        
      // Get stats: completed events and cancellation strikes
      const [{ count: completed }, { data: strikeRow }] = await Promise.all([
        supabase.from('v_past_events').select('id', { count:'exact', head:true }).eq('host_id', userId),
        supabase.from('v_host_strikes_last6mo').select('strike_count').eq('host_id', userId).maybeSingle(),
      ]);
      
      setProfileModal({ 
        visible: true, 
        profile: prof, 
        stats: { 
          completed: completed || 0, 
          cancels: Number(strikeRow?.strike_count || 0) 
        } 
      });
    } catch (error) {
      // Could show a toast or alert here if desired
    }
  };

  return (
    <>
    <TouchableOpacity 
      style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: badge.color,
      }}
      onPress={() => setSheetOpen(true)}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4 }}>
            {event.title}
          </Text>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            {eventDate.toLocaleDateString()} • {event.vibe}
            {isToday && ' • TODAY'}
          </Text>
        </View>
        
        {/* Status Badge */}
        <View style={{
          backgroundColor: badge.bg,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: badge.color }}>
            {badge.text}
          </Text>
        </View>
      </View>

      {/* RSVP Progress Bar - Only show if capacity is set */}
      {event.rsvp_capacity && event.rsvp_capacity > 0 ? (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>
              RSVPs: {event.rsvp_count} / {event.capacity}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
          
          {/* Progress Bar */}
          <View style={{
            height: 6,
            backgroundColor: '#e5e7eb',
            borderRadius: 3,
            overflow: 'hidden',
          }}>
            <Animated.View style={{
              height: '100%',
              backgroundColor: progress > 0.8 ? '#10b981' : progress > 0.5 ? '#f59e0b' : colors.primary,
              borderRadius: 3,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }} />
          </View>
        </View>
      ) : (
        /* Show just RSVP count without capacity/progress */
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>
              RSVPs: {event.rsvp_count}
            </Text>
            <Text style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>
              No capacity limit
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
    
    <HostEventActionsSheet
      visible={sheetOpen}
      onClose={() => setSheetOpen(false)}
      event={event}
      onOpenChat={() => {
        setSheetOpen(false);
        setShowChatModal(true);
      }}
      onViewRsvps={() => {
        setSheetOpen(false);
        setShowRsvpModal(true);
      }}
      onEdit={() => {
        setSheetOpen(false);
        // TODO: Navigate to edit (implement when edit screen is ready)
      }}
      onCancelEvent={() => {
        setSheetOpen(false);
        setShowCancelConfirm(true);
      }}
    />
    
    <ConfirmCancelModal
      visible={showCancelConfirm}
      event={event}
      onClose={() => setShowCancelConfirm(false)}
      onConfirm={(result) => {
        setShowCancelConfirm(false);
        // TODO: Refresh event list or navigate back
        // The modal already shows success/error messages
      }}
    />
    
    <EventChatModal
      visible={showChatModal}
      onClose={() => setShowChatModal(false)}
      event={event}
    />
    
    {/* RSVP List Modal */}
    <Modal 
      visible={showRsvpModal} 
      animationType="slide" 
      presentationStyle="pageSheet"
      onRequestClose={() => setShowRsvpModal(false)}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        {/* White to peach gradient background */}
        <LinearGradient
          colors={['#FFFFFF', '#FFE5D9']}
          start={{x:0,y:0}} 
          end={{x:0,y:1}}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          pointerEvents="none"
        />

        {/* Pulsing Red X Close Button */}
        <Animated.View style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
          transform: [{ scale: pulseAnim }]
        }}>
          <TouchableOpacity 
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#ef4444',
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 0.5,
              borderColor: 'rgba(239, 68, 68, 0.3)',
              shadowColor: '#ef4444',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 8,
              elevation: 8,
              opacity: 0.95,
            }}
            onPress={() => setShowRsvpModal(false)}
          >
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
        </Animated.View>

        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: 20, 
          borderBottomWidth: 1, 
          borderBottomColor: 'rgba(186, 164, 235, 0.3)',
          zIndex: 2
        }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>
            RSVPs ({attendees.length})
          </Text>
        </View>

        {/* Content */}
        {loadingAttendees ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
            <ActivityIndicator size="large" color="#BAA4EB" />
            <Text style={{ fontSize: 16, color: '#6b7280', marginTop: 12, fontWeight: '600' }}>
              Loading attendees...
            </Text>
          </View>
        ) : attendees.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
            <View style={{
              backgroundColor: 'rgba(186, 164, 235, 0.1)',
              borderRadius: 50,
              padding: 20,
              marginBottom: 16,
              borderWidth: 2,
              borderColor: '#BAA4EB',
            }}>
              <Ionicons name="people-outline" size={48} color="#BAA4EB" />
            </View>
            <Text style={{ fontSize: 16, color: '#6b7280', marginTop: 12, fontWeight: '600' }}>
              No RSVPs yet
            </Text>
            <Text style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8, fontWeight: '500' }}>
              When people RSVP to your event, they'll appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={attendees}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, zIndex: 2 }}
            renderItem={({ item, index }) => (
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => openProfile(item.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  borderRadius: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#BAA4EB',
                  shadowColor: '#BAA4EB',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                {/* Avatar */}
                <View style={{
                  shadowColor: '#BAA4EB',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8,
                }}>
                  <Image 
                    source={{ uri: item.avatar_url }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      marginRight: 14,
                      backgroundColor: '#e5e7eb',
                      borderWidth: 2,
                      borderColor: '#BAA4EB',
                    }}
                  />
                </View>
                
                {/* User Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 }}>
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '500' }}>
                    RSVP'd {new Date(item.rsvp_date).toLocaleDateString()}
                  </Text>
                </View>

                {/* Payment Status */}
                {event.price_in_cents && event.price_in_cents > 0 && (
                  <View style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: item.paid ? '#d1fae5' : '#fee2e2',
                    borderWidth: 1,
                    borderColor: item.paid ? '#10b981' : '#ef4444',
                    shadowColor: item.paid ? '#10b981' : '#ef4444',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 3,
                  }}>
                    <Text style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: item.paid ? '#10b981' : '#ef4444',
                    }}>
                      {item.paid ? 'PAID' : 'PENDING'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>

    <ProfileModal
      visible={profileModal.visible}
      profile={profileModal.profile}
      stats={profileModal.stats}
      onClose={() => setProfileModal({ ...profileModal, visible: false })}
    />
    </>
  );
}

// View Toggle Component
function ViewToggle({ viewMode, onToggle }) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: '#f3f4f6',
      borderRadius: 8,
      padding: 2,
      marginBottom: 16,
    }}>
      <TouchableOpacity
        onPress={() => onToggle('list')}
        style={{
          flex: 1,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 6,
          backgroundColor: viewMode === 'list' ? 'white' : 'transparent',
          shadowColor: viewMode === 'list' ? '#000' : 'transparent',
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: viewMode === 'list' ? 2 : 0,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="list" size={16} color={viewMode === 'list' ? colors.primary : '#6b7280'} />
          <Text style={{
            marginLeft: 6,
            fontSize: 14,
            fontWeight: '500',
            color: viewMode === 'list' ? colors.primary : '#6b7280',
          }}>
            List
          </Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={() => onToggle('calendar')}
        style={{
          flex: 1,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 6,
          backgroundColor: viewMode === 'calendar' ? 'white' : 'transparent',
          shadowColor: viewMode === 'calendar' ? '#000' : 'transparent',
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: viewMode === 'calendar' ? 2 : 0,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="calendar" size={16} color={viewMode === 'calendar' ? colors.primary : '#6b7280'} />
          <Text style={{
            marginLeft: 6,
            fontSize: 14,
            fontWeight: '500',
            color: viewMode === 'calendar' ? colors.primary : '#6b7280',
          }}>
            Calendar
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// Event Time Toggle Component
function EventTimeToggle({ showPast, onToggle, upcomingCount, pastCount }) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: '#f3f4f6',
      borderRadius: 8,
      padding: 2,
      marginBottom: 16,
    }}>
      <TouchableOpacity
        onPress={() => onToggle(false)}
        style={{
          flex: 1,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 6,
          backgroundColor: !showPast ? 'white' : 'transparent',
          shadowColor: !showPast ? '#000' : 'transparent',
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: !showPast ? 2 : 0,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="calendar" size={16} color={!showPast ? colors.primary : '#6b7280'} />
          <Text style={{
            marginLeft: 6,
            fontSize: 14,
            fontWeight: '500',
            color: !showPast ? colors.primary : '#6b7280',
          }}>
            Current ({upcomingCount})
          </Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={() => onToggle(true)}
        style={{
          flex: 1,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 6,
          backgroundColor: showPast ? 'white' : 'transparent',
          shadowColor: showPast ? '#000' : 'transparent',
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: showPast ? 2 : 0,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark-circle" size={16} color={showPast ? colors.primary : '#6b7280'} />
          <Text style={{
            marginLeft: 6,
            fontSize: 14,
            fontWeight: '500',
            color: showPast ? colors.primary : '#6b7280',
          }}>
            Past ({pastCount})
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// Sort Toggle Component
function SortToggle({ sortBy, onToggle }) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: '#f3f4f6',
      borderRadius: 8,
      padding: 2,
      marginBottom: 12,
    }}>
      <TouchableOpacity
        onPress={() => onToggle('date')}
        style={{
          flex: 1,
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 6,
          backgroundColor: sortBy === 'date' ? 'white' : 'transparent',
        }}
      >
        <Text style={{
          textAlign: 'center',
          fontSize: 12,
          fontWeight: '500',
          color: sortBy === 'date' ? colors.primary : '#6b7280',
        }}>
          By Date
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        onPress={() => onToggle('rsvps')}
        style={{
          flex: 1,
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 6,
          backgroundColor: sortBy === 'rsvps' ? 'white' : 'transparent',
        }}
      >
        <Text style={{
          textAlign: 'center',
          fontSize: 12,
          fontWeight: '500',
          color: sortBy === 'rsvps' ? colors.primary : '#6b7280',
        }}>
          By RSVPs
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Placeholder Content Component
function PlaceholderContent({ icon, title, description }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
      <View style={{ 
        backgroundColor: '#f3f4f6', 
        padding: 16, 
        borderRadius: 50, 
        marginBottom: 16 
      }}>
        <Ionicons name={icon} size={32} color="#9ca3af" />
      </View>
      <Text style={{ 
        fontSize: 18, 
        fontWeight: '600', 
        color: '#1f2937', 
        marginBottom: 8,
        textAlign: 'center'
      }}>
        {title}
      </Text>
      <Text style={{ 
        fontSize: 14, 
        color: '#6b7280', 
        textAlign: 'center',
        marginBottom: 16,
        paddingHorizontal: 20,
        lineHeight: 20
      }}>
        {description}
      </Text>
      <Text style={{ 
        fontSize: 12, 
        color: '#9ca3af',
        fontStyle: 'italic'
      }}>
        Coming soon...
      </Text>
    </View>
  );
}

// Analytics Content Component

function AnalyticsContent({ events, paidOnly=false, setPaidOnly, joinDate, taxRate, setTaxRate }) {
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [timePeriod, setTimePeriod] = useState('ytd'); // 'all', 'ytd', '6months', 'month'
  const { user, profile } = useAuth();

  
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  
  // Initialize pastEvents if not available
  const pastEvents = [];

  const aiEnabled = !!paidOnly; // disable AI when Paid Only is off

  // Analytics (host-level) fetched from analytics schema
  const [hostAnalytics, setHostAnalytics] = useState({ totalRsvps: null, last30DayRsvps: null });
  const [rsvpSeriesByPeriod, setRsvpSeriesByPeriod] = useState({});
  const [rsvpMonthlyByPeriod, setRsvpMonthlyByPeriod] = useState({});
  const [hostMonthly, setHostMonthly] = useState({ rows: [], aggregates: {} });
  const [capacityByPeriod, setCapacityByPeriod] = useState({});
  const [revenueSeriesByPeriod, setRevenueSeriesByPeriod] = useState({});
  const [peakByPeriod, setPeakByPeriod] = useState({});
  const [refundByPeriod, setRefundByPeriod] = useState({});

  const getPeriodDates = (period) => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (period === 'month') {
      const start = new Date(end);
      start.setDate(start.getDate() - 30);
      return { start, end };
    }
    if (period === '6months') {
      const start = new Date(end);
      start.setMonth(start.getMonth() - 6);
      start.setDate(1);
      return { start, end };
    }
    if (period === 'ytd') {
      const start = new Date(end.getFullYear(), 0, 1);
      return { start, end };
    }
    const start = new Date(end.getFullYear() - 5, 0, 1);
    return { start, end };
  };

  // Fetch refund stats when refund modal is open or period changes
  useEffect(() => {
    if (!modalVisible || selectedMetric?.metricType !== 'refund') return;
    const hostId = (events && events[0]?.host_id) || user?.id;
    if (!hostId) return;
    const { start, end } = getPeriodDates(timePeriod);
    const startStr = new Date(start).toISOString().slice(0, 10);
    const endStr = new Date(end).toISOString().slice(0, 10);
    let cancelled = false;
    (async () => {
      console.log('[refund] modal-open fetch start', { hostId, period: timePeriod, startStr, endStr });
      const { data, error } = await supabase.schema('analytics').rpc('host_refund_stats', {
        p_host: hostId,
        p_start: startStr,
        p_end: endStr,
      });
      if (cancelled) {
        console.log('[refund] modal-open fetch cancelled');
        return;
      }
      if (error) {
        console.error('[refund] modal-open fetch error', error);
        return;
      }
      console.log('[refund] modal-open fetch ok', { rows: (data||[]).length, row0: data?.[0] });
      const row = (data && data[0]) || {};
      setRefundByPeriod(prev => ({
        ...prev,
        [timePeriod]: {
          refund_count: Number(row.refund_count || 0),
          rsvps_total: Number(row.rsvps_total || 0),
          window: { start: startStr, end: endStr },
        }
      }));
      console.log('[refund] state updated (modal)', { period: timePeriod, refund_count: Number(row.refund_count || 0), rsvps_total: Number(row.rsvps_total || 0) });
    })();
    return () => { cancelled = true; };
  }, [modalVisible, selectedMetric?.metricType, timePeriod, events?.[0]?.host_id, user?.id]);

  // Prefetch refund stats for the current period so the card can display without opening modal
  useEffect(() => {
    const hostId = (events && events[0]?.host_id) || user?.id;
    if (!hostId) return;
    const { start, end } = getPeriodDates(timePeriod);
    const startStr = new Date(start).toISOString().slice(0, 10);
    const endStr = new Date(end).toISOString().slice(0, 10);
    let cancelled = false;
    (async () => {
      console.log('[refund] prefetch start', { hostId, period: timePeriod, startStr, endStr });
      const { data, error } = await supabase.schema('analytics').rpc('host_refund_stats', {
        p_host: hostId,
        p_start: startStr,
        p_end: endStr,
      });
      if (cancelled) {
        console.log('[refund] prefetch cancelled');
        return;
      }
      if (error) {
        console.error('[refund] prefetch error', error);
        return;
      }
      console.log('[refund] prefetch ok', { rows: (data||[]).length, row0: data?.[0] });
      const row = (data && data[0]) || {};
      setRefundByPeriod(prev => ({
        ...prev,
        [timePeriod]: {
          refund_count: Number(row.refund_count || 0),
          rsvps_total: Number(row.rsvps_total || 0),
          window: { start: startStr, end: endStr },
        }
      }));
      console.log('[refund] state updated (prefetch)', { period: timePeriod, refund_count: Number(row.refund_count || 0), rsvps_total: Number(row.rsvps_total || 0) });
    })();
    return () => { cancelled = true; };
  }, [timePeriod, events?.[0]?.host_id, user?.id]);

  useEffect(() => {
    const hostId = (events && events[0]?.host_id) || null;
    if (!hostId) return;

    (async () => {
      try {
        // lifetime totals
        const { data: hl } = await supabase
          .schema('analytics')
          .from('host_live')
          .select('total_rsvps')
          .eq('host_id', hostId)
          .maybeSingle();

        // last 30 days rsvps (sum)
        const since = new Date(); since.setDate(since.getDate()-30);
        const sinceStr = since.toISOString().slice(0,10);
        const { data: dailies } = await supabase
          .schema('analytics')
          .from('event_daily')
          .select('rsvps_total, day')
          .eq('host_id', hostId)
          .gte('day', sinceStr);
        const last30 = (dailies||[]).reduce((s,r)=> s + (r.rsvps_total||0), 0);

        setHostAnalytics({ totalRsvps: hl?.total_rsvps ?? null, last30DayRsvps: last30 });
      } catch (e) { /* ignore */ }
    })();
  }, [events?.[0]?.host_id]);

  // Preload capacity data using analytics-only sources (single source of truth):
  // 1) analytics.event_live for capacities; 2) analytics.event_daily for RSVP sums; slice by window client-side
  useEffect(() => {
    const hostId = (events && events[0]?.host_id) || null;
    if (!hostId) return;

    let cancelled = false;
    const now = new Date();
    const startAll = new Date(2020, 0, 1);

    const windows = {
      month: (d => new Date(d.getFullYear(), d.getMonth(), 1))(now),
      six: (d => new Date(d.getFullYear(), d.getMonth() - 5, 1))(now),
      ytd: new Date(now.getFullYear(), 0, 1),
      all: startAll,
    };

    (async () => {
      try {
        // 1) Fetch live counters for host
        const { data: liveRows } = await supabase
          .schema('analytics')
          .from('event_live')
          .select('event_id,capacity,rsvps_total,last_rsvp_at,gross_revenue_cents,price_cents_snapshot')
          .eq('host_id', hostId);

        const idToLive = new Map((liveRows || []).map(r => [
          r.event_id,
          {
            cap: Number(r.capacity || 0),
            total: Number(r.rsvps_total || 0),
            last: r.last_rsvp_at ? new Date(r.last_rsvp_at) : null,
            gross: Number(r.gross_revenue_cents || 0),
            price: Number(r.price_cents_snapshot || 0)
          }
        ]));

        // 2) Fetch event starts for gating by period (tiny read, host-only)
        const { data: evs } = await supabase
          .from('events')
          .select('id,starts_at,title')
          .eq('host_id', hostId);

        const buildFor = (startDate) => {
          const endDate = now;
          // Gating by starts_at when available; fallback to last_rsvp_at
          const starts = new Map((evs || []).map(e => [e.id, { dt: e.starts_at ? new Date(e.starts_at) : null, title: e.title || 'Untitled' }]));
          // Build event ids by union of starts_at-in-window and last_rsvp_at-in-window
          const idsByStart = new Set(Array.from(starts.entries()).filter(([id, obj]) => obj.dt && obj.dt >= startDate && obj.dt <= endDate).map(([id]) => id));
          const idsByLast = new Set(Array.from(idToLive.entries()).filter(([id, live]) => live.last && live.last >= startDate && live.last <= endDate).map(([id]) => id));
          const eventIdsWindow = new Set([...idsByStart, ...idsByLast]);
          const items = Array.from(eventIdsWindow).map(id => {
            const live = idToLive.get(id) || { cap: 0, total: 0, gross: 0, price: 0 };
            const meta = starts.get(id) || { dt: null, title: 'Untitled' };
            return { capacity: live.cap, rsvps: live.total, gross: Number(live.gross || 0), price: Number(live.price || 0), title: meta.title };
          });
          // Compute buckets and avg
          const buckets = {
            '0-25%': 0,
            '26-50%': 0,
            '51-75%': 0,
            '76-99%': 0,
            '100%': 0,
            'No Capacity': 0,
          };
          let sumRatio = 0, n = 0, sumGross = 0;
          items.forEach(it => {
            const cap = Number(it.capacity || 0);
            const r = Number(it.rsvps || 0);
            sumGross += Number(it.gross || 0);
            if (!cap) { buckets['No Capacity']++; return; }
            const ratio = Math.max(0, Math.min(1, r / cap));
            sumRatio += ratio; n++;
            if (ratio >= 1) buckets['100%']++;
            else if (ratio >= 0.76) buckets['76-99%']++;
            else if (ratio >= 0.51) buckets['51-75%']++;
            else if (ratio >= 0.26) buckets['26-50%']++;
            else buckets['0-25%']++;
          });
          // If every event has the same fill (e.g., all 42%), avg remains the same across tabs.
          const avg = n > 0 ? sumRatio / n : 0;
          // Transform to chart data
          const data = Object.entries(buckets).map(([label, value]) => ({ label, value }));
          const window = { start: startDate.toISOString().slice(0,10), end: endDate.toISOString().slice(0,10) };
          // Build revenue fallback meta (paid/all) without relying on capacity presence
          const paidItems = items.filter(it => Number(it.price || 0) > 0);
          const grossAll = items.reduce((s, it) => s + Number(it.gross || 0), 0);
          const grossPaid = paidItems.reduce((s, it) => s + Number(it.gross || 0), 0);
          const eventsAll = items.length;
          const eventsPaid = paidItems.length;
          // Build top revenue events list (gross cents → dollars)
          const top = items
            .filter(it => Number(it.gross || 0) > 0)
            .sort((a,b) => b.gross - a.gross)
            .slice(0, 10)
            .map(it => ({ label: (it.title && it.title.length > 28) ? it.title.slice(0,28)+'…' : it.title, value: Number(it.gross)/100 }));

          return {
            chart: { data, type: 'bar', title: 'Capacity Fill Rate' , avg, window },
            meta: { count: n, window, gross_revenue_cents: sumGross, gross_all_cents: grossAll, gross_paid_cents: grossPaid, events_all: eventsAll, events_paid: eventsPaid, top }
          };
        };

        if (cancelled) return;
        setCapacityByPeriod({
          month: buildFor(windows.month),
          '6months': buildFor(windows.six),
          ytd: buildFor(windows.ytd),
          all: buildFor(windows.all),
        });
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [events?.[0]?.host_id]);

  // Preload RSVP growth series for all tabs for smooth transitions
  useEffect(() => {
    const hostId = (events && events[0]?.host_id) || null;
    if (!hostId) return;

    const nowLocal = new Date();
    const end = nowLocal.toISOString().slice(0, 10);

    const boundsFor = (period) => {
      if (period === 'month') return new Date(nowLocal.getFullYear(), nowLocal.getMonth(), 1);
      if (period === '6months') return new Date(nowLocal.getFullYear(), nowLocal.getMonth() - 5, 1);
      if (period === 'ytd') return new Date(nowLocal.getFullYear(), 0, 1);
      return new Date(2020, 0, 1);
    };

    const periods = ['month', '6months', 'ytd', 'all'];
    let cancelled = false;

    const fetchFor = async (period) => {
      const startDate = boundsFor(period);
      const startStr = startDate.toISOString().slice(0, 10);
      const { data: rows } = await supabase
        .schema('analytics')
        .from('event_daily')
        .select('day,rsvps_total')
        .eq('host_id', hostId)
        .gte('day', startStr)
        .lte('day', end)
        .order('day', { ascending: true });

      // Build cumulative series anchored to the 1st and end date for stable axes
      let cumulative = 0;
      // For 'all' period, offset baseline to match lifetime total from host_live
      const periodIsAll = period === 'all';
      const sumWithinWindow = (rows || []).reduce((s, r) => s + (r.rsvps_total || 0), 0);
      const lifetime = hostAnalytics.totalRsvps ?? null;
      const baseOffset = periodIsAll && typeof lifetime === 'number' && lifetime > sumWithinWindow
        ? (lifetime - sumWithinWindow)
        : 0;

      // Collapse multiple events per day: sum per unique day
      const dayTotals = {};
      (rows || []).forEach(r => {
        const d = r.day;
        const v = Number(r.rsvps_total || 0);
        dayTotals[d] = (dayTotals[d] || 0) + v;
      });
      const sortedDays = Object.keys(dayTotals).sort();

      const built = [{ label: startStr, value: baseOffset }];
      sortedDays.forEach(d => {
        cumulative += dayTotals[d];
        built.push({ label: d, value: baseOffset + cumulative });
      });
      const lastLabel = built[built.length - 1]?.label;
      if (lastLabel !== end) {
        built.push({ label: end, value: baseOffset + cumulative });
      }
      return built;
    };

    (async () => {
      try {
        const results = await Promise.allSettled(periods.map(p => fetchFor(p)));
        if (cancelled) return;
        const map = {};
        periods.forEach((p, i) => {
          if (results[i].status === 'fulfilled') {
            map[p] = { series: results[i].value, totalRsvps: hostAnalytics.totalRsvps ?? null };
          }
        });
        setRsvpSeriesByPeriod(map);
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [events?.[0]?.host_id, hostAnalytics.totalRsvps]);


  // Preload net revenue daily for last 30 days from analytics.event_daily
  useEffect(() => {
    const hostId = (events && events[0]?.host_id) || null;
    if (!hostId) return;

    (async () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);
      const { data: rows } = await supabase
        .schema('analytics')
        .from('event_daily')
        .select('day, net_to_host_cents')
        .eq('host_id', hostId)
        .gte('day', startStr)
        .lte('day', endStr);

      const daily = {};
      for (let i = 30; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        daily[d.toISOString().slice(0,10)] = 0;
      }
      (rows || []).forEach(r => {
        const k = r.day;
        daily[k] = (daily[k] || 0) + Number(r.net_to_host_cents || 0);
      });
      const series = Object.keys(daily).sort().map(k => ({
        label: new Date(k).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Number(daily[k]) / 100
      }));
      setRevenueSeriesByPeriod(prev => ({ ...prev, month: { series } }));
    })();
  }, [events?.[0]?.host_id]);

  // Preload host_monthly for monthly/YTD table views and build period maps
  useEffect(() => {
    const hostId = (events && events[0]?.host_id) || null;
    if (!hostId) return;

    const now = new Date();
    // Use the last day of the current month as the inclusive end bound for monthly sums
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startAll = new Date(2020, 0, 1);

    const boundsFor = (period) => {
      if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
      if (period === '6months') return new Date(now.getFullYear(), now.getMonth() - 5, 1);
      if (period === 'ytd') return new Date(now.getFullYear(), 0, 1);
      return startAll;
    };

    const fillMonthly = (rows, startDate, endDateInclusive) => {
      const map = new Map((rows || []).map(r => [
        `${r.year}-${String(r.month).padStart(2,'0')}`,
        r.rsvps_total || 0
      ]));
      const series = [];
      const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (cursor <= endDateInclusive) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`;
        series.push({ label: key, value: map.get(key) || 0 });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return series;
    };

    let cancelled = false;
    (async () => {
      try {
        const debugHostId = (events && events[0]?.host_id) || null;
        const { data: rows } = await supabase
          .schema('analytics')
          .from('host_monthly')
          .select('year,month,rsvps_total,events_count,gross_revenue_cents,net_to_host_cents,rsvp_same_day,rsvp_1d,rsvp_2_3d,rsvp_4_7d,rsvp_gt_7d')
          .eq('host_id', hostId)
          .gte('year', startAll.getFullYear())
          .lte('year', now.getFullYear())
          .order('year', { ascending: true })
          .order('month', { ascending: true });

        

        let effectiveRows = rows || [];
        if ((effectiveRows).length === 0) {
          const { data: retry } = await supabase
            .schema('analytics')
            .from('host_monthly')
            .select('year,month,rsvps_total,events_count,gross_revenue_cents,net_to_host_cents,rsvp_same_day,rsvp_1d,rsvp_2_3d,rsvp_4_7d,rsvp_gt_7d')
            .eq('host_id', hostId)
            .order('year', { ascending: true })
            .order('month', { ascending: true });
          effectiveRows = retry || [];
          
        }

        if (cancelled) return;
        const periods = ['month','6months','ytd','all'];
        const map = {};
        periods.forEach(p => {
          const startDate = boundsFor(p);
          map[p] = { series: fillMonthly(effectiveRows, startDate, endDate) };
        });
        setRsvpMonthlyByPeriod(map);

        // Build aggregates for revenue/events per window
        const aggregates = {};
        const within = (y,m,start,end) => {
          const d = new Date(y, m-1, 1);
          return d >= start && d <= end;
        };
        const calcAgg = (startDate) => {
          let events = 0; let revenueCents = 0; let gross = 0;
          (effectiveRows || []).forEach(r => {
            if (within(r.year, r.month, startDate, endDate)) {
              events += Number(r.events_count || 0);
              revenueCents += Number(r.net_to_host_cents || 0);
              gross += Number(r.gross_revenue_cents || 0);
            }
          });
          return { events, revenueCents, gross_revenue_cents: gross };
        };
        aggregates['month'] = calcAgg(boundsFor('month'));
        aggregates['6months'] = calcAgg(boundsFor('6months'));
        aggregates['ytd'] = calcAgg(boundsFor('ytd'));
        aggregates['all'] = calcAgg(boundsFor('all'));
        
        setHostMonthly({ rows: rows || [], aggregates });

        // Peak RSVP window per period from host_monthly buckets
        const sumBucketsWithin = (startDate) => {
          const sums = { sd:0, d1:0, d2_3:0, d4_7:0, gt7:0 };
          (effectiveRows || []).forEach(r => {
            const d = new Date(r.year, (r.month||1)-1, 1);
            if (d >= startDate && d <= endDate) {
              sums.sd   += Number(r.rsvp_same_day || 0);
              sums.d1   += Number(r.rsvp_1d || 0);
              sums.d2_3 += Number(r.rsvp_2_3d || 0);
              sums.d4_7 += Number(r.rsvp_4_7d || 0);
              sums.gt7  += Number(r.rsvp_gt_7d || 0);
            }
          });
          
          return sums;
        };
        const labelFromSums = (sums) => {
          const data = [
            { label:'Same Day',   value: Number(sums.sd   || 0) },
            { label:'1 Day Before', value: Number(sums.d1   || 0) },
            { label:'2–3 Days',   value: Number(sums.d2_3 || 0) },
            { label:'4–7 Days',   value: Number(sums.d4_7 || 0) },
            { label:'8+ Days',    value: Number(sums.gt7  || 0) },
          ];
          const top = data.slice().sort((a,b)=>b.value-a.value)[0];
          return { label: top ? top.label : 'Unknown', data };
        };
        const peak = {};
        peak['month']   = labelFromSums(boundsFor('month'));
        peak['6months'] = labelFromSums(boundsFor('6months'));
        peak['ytd']     = labelFromSums(boundsFor('ytd'));
        peak['all']     = labelFromSums(boundsFor('all'));
        const peakMap = {
          month: labelFromSums(sumBucketsWithin(boundsFor('month'))),
          '6months': labelFromSums(sumBucketsWithin(boundsFor('6months'))),
          ytd: labelFromSums(sumBucketsWithin(boundsFor('ytd'))),
          all: labelFromSums(sumBucketsWithin(boundsFor('all'))),
        };
        
        setPeakByPeriod(peakMap);

        // Build revenue series for 6months, ytd, all from host_monthly (net_to_host_cents)
        const buildMonthlySeries = (startDate) => {
          const endDateInclusive = endDate;
          // Fill months from 1st of start to end
          const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          const values = [];
          while (cur <= endDateInclusive) {
            const y = cur.getFullYear();
            const m = cur.getMonth() + 1;
            const key = `${y}-${String(m).padStart(2,'0')}`;
            const sum = (effectiveRows || []).filter(r => r.year === y && r.month === m).reduce((s,r)=> s + Number(r.net_to_host_cents || 0), 0);
            values.push({ label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), value: sum / 100 });
            cur.setMonth(cur.getMonth() + 1);
          }
          return values;
        };

        const sixStart = boundsFor('6months');
        const ytdStart = boundsFor('ytd');
        const sixSeries = buildMonthlySeries(sixStart);
        const ytdSeries = buildMonthlySeries(ytdStart);

        // All-time 3-month buckets (quarter-like windows), respecting 1st of month
        const allStart = startAll;
        const buckets = [];
        const q = new Date(allStart.getFullYear(), allStart.getMonth() - (allStart.getMonth() % 3), 1);
        while (q <= endDate) {
          const y = q.getFullYear();
          const m = q.getMonth();
          const months = [m, m+1, m+2];
          const sum = (effectiveRows || []).filter(r => r.year === y && months.includes(r.month - 1)).reduce((s,r)=> s + Number(r.net_to_host_cents || 0), 0);
          const label = `${new Date(y, months[0], 1).toLocaleDateString('en-US',{ month:'short' })}–${new Date(y, months[2], 1).toLocaleDateString('en-US',{ month:'short' })} ${String(y).slice(2)}`;
          buckets.push({ label, value: sum / 100 });
          q.setMonth(q.getMonth() + 3);
        }

        setRevenueSeriesByPeriod(prev => ({
          ...prev,
          '6months': { series: sixSeries },
          ytd: { series: ytdSeries },
          all: { series: buckets }
        }));
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [events?.[0]?.host_id]);

  // Calculate advanced analytics metrics
  const calculateAnalytics = () => {
    const relevantEvents = paidOnly ? (events || []).filter(e=>e.price_in_cents>0) : (events || []);
    const now = new Date();
    const pastEvents = relevantEvents.filter(e => new Date(e.starts_at) < now);
    const upcomingEvents = relevantEvents.filter(e => new Date(e.starts_at) >= now);
    const paidEvents = relevantEvents.filter(e => e.price_in_cents > 0);
    const eventsWithCapacity = relevantEvents.filter(e => e.rsvp_capacity && e.rsvp_capacity > 0);
    
    // Get stored analytics data
    const advancedData = global.hostAnalyticsData || {
      rsvpTimestamps: {},
      userRsvpHistory: {},
      paymentData: []
    };
    
    const analytics = {
      // Basic metrics
      totalEvents: relevantEvents.length,
      pastEvents: pastEvents.length,
      upcomingEvents: upcomingEvents.length,
      last30DayEvents: relevantEvents.filter(e => new Date(e.starts_at) >= last30Days).length,
      
      // RSVP metrics
      totalRsvps: relevantEvents.reduce((sum, event) => sum + (event.rsvp_count || 0), 0),
      last30DayRsvps: relevantEvents.filter(e => new Date(e.starts_at) >= last30Days)
        .reduce((sum, event) => sum + (event.rsvp_count || 0), 0),
      
      // Revenue metrics
      totalRevenue: relevantEvents.reduce((sum, event) => sum + ((event.price_in_cents || 0) * (event.rsvp_count || 0) / 100), 0),
      netRevenue: 0,
      
      // Performance metrics
      avgTicketPrice: 0,
      capacityFillRate: 0,
      sellOutSpeed: 0,
      revenuePerAttendee: 0,
      
      // Advanced behavioral metrics
      refundRate: 0,
      repeatGuestRate: 0,
      firstTimerRate: 0,
      
      // Timing insights
      rsvpSurgeWindow: {},
      avgRsvpsPerDay: 0,
      peakRsvpDay: 'Unknown',
      avgSellOutSpeed: 0,
    };

    // Calculate average ticket price
    if (paidEvents.length > 0) {
      analytics.avgTicketPrice = paidEvents.reduce((sum, event) => 
        sum + (event.price_in_cents || 0), 0) / (paidEvents.length * 100);
    }

    // Calculate capacity fill rate
    if (eventsWithCapacity.length > 0) {
      analytics.capacityFillRate = eventsWithCapacity.reduce((sum, event) => 
        sum + ((event.rsvp_count || 0) / event.rsvp_capacity), 0) / eventsWithCapacity.length;
    }

    // Calculate revenue per attendee
    if (analytics.totalRsvps > 0) {
      analytics.revenuePerAttendee = analytics.totalRevenue / analytics.totalRsvps;
    }

    // Identify sell-out events and calculate speed
    const sellOutEvents = eventsWithCapacity.filter(e => e.rsvp_count >= e.rsvp_capacity);
    analytics.sellOutCount = sellOutEvents.length;
    analytics.sellOutRate = eventsWithCapacity.length > 0 ? 
      (sellOutEvents.length / eventsWithCapacity.length) : 0;

    // Calculate sell-out speed for events that sold out
    let sellOutSpeeds = [];
    sellOutEvents.forEach(event => {
      const eventRsvps = advancedData.rsvpTimestamps[event.id] || [];
      if (eventRsvps.length >= event.rsvp_capacity) {
        const eventStart = new Date(event.starts_at);
        const sellOutTime = new Date(eventRsvps[event.rsvp_capacity - 1]?.created_at);
        if (sellOutTime && eventStart) {
          const hoursToSellOut = (sellOutTime - eventStart) / (1000 * 60 * 60);
          if (hoursToSellOut < 0) { // Sold out before event
            sellOutSpeeds.push(Math.abs(hoursToSellOut));
          }
        }
      }
    });
    analytics.avgSellOutSpeed = sellOutSpeeds.length > 0 ? 
      sellOutSpeeds.reduce((sum, speed) => sum + speed, 0) / sellOutSpeeds.length : 0;

    // Calculate repeat guest rate
    const allUsers = Object.keys(advancedData.userRsvpHistory);
    const repeatGuests = allUsers.filter(userId => 
      advancedData.userRsvpHistory[userId].length > 1
    );
    analytics.repeatGuestRate = allUsers.length > 0 ? 
      (repeatGuests.length / allUsers.length) : 0;
    analytics.firstTimerRate = 1 - analytics.repeatGuestRate;

    // Refund rate: prefer analytics RPC windowed totals; fallback to local payment data
    const rp = refundByPeriod?.[timePeriod];
    if (rp && Number(rp.rsvps_total || 0) > 0) {
      const rate = Number(rp.refund_count || 0) / Number(rp.rsvps_total || 0);
      console.log('[refund] using RPC totals for refundRate', { period: timePeriod, rp, rate });
      analytics.refundRate = rate;
    } else {
      const refundedPayments = advancedData.paymentData.filter(p => p.refunded);
      const fallbackRate = advancedData.paymentData.length > 0 ?
        (refundedPayments.length / advancedData.paymentData.length) : 0;
      console.log('[refund] falling back to local paymentData for refundRate', { period: timePeriod, count: advancedData.paymentData.length, fallbackRate });
      analytics.refundRate = fallbackRate;
    }

    // RSVP surge analysis (day-by-day pattern)
    const surgeAnalysis = {};
    Object.entries(advancedData.rsvpTimestamps).forEach(([eventId, rsvps]) => {
      const event = events.find(e => e.id === eventId);
      if (!event) return;
      
      const eventStart = new Date(event.starts_at);
      const dailyRsvps = {};
      
      rsvps.forEach(rsvp => {
        const rsvpDate = new Date(rsvp.created_at);
        const daysBeforeEvent = Math.ceil((eventStart - rsvpDate) / (1000 * 60 * 60 * 24));
        
        if (daysBeforeEvent >= 0) {
          dailyRsvps[daysBeforeEvent] = (dailyRsvps[daysBeforeEvent] || 0) + 1;
        }
      });
      
      surgeAnalysis[eventId] = dailyRsvps;
    });
    analytics.rsvpSurgeWindow = surgeAnalysis;

    // Find peak RSVP day across all events
    const allDayCounts = {};
    Object.values(surgeAnalysis).forEach(eventSurge => {
      Object.entries(eventSurge).forEach(([day, count]) => {
        allDayCounts[day] = (allDayCounts[day] || 0) + count;
      });
    });
    
    if (Object.keys(allDayCounts).length > 0) {
      const peakDay = Object.entries(allDayCounts).reduce((max, [day, count]) =>
        count > max.count ? { day: parseInt(day), count } : max,
        { day: 0, count: 0 }
      );
      analytics.peakRsvpDay = peakDay.day === 0 ? 'Event day' : 
        peakDay.day === 1 ? '1 day before' : `${peakDay.day} days before`;
    }

    // Net revenue is the same as total revenue for hosts (fees charged to users)
    analytics.netRevenue = analytics.totalRevenue;

    // Calculate estimated after-tax earnings using user-selected tax rate
    analytics.estimatedTaxRate = taxRate;
    analytics.afterTaxRevenue = analytics.totalRevenue * (1 - taxRate);

    return analytics;
  };

  const analytics = calculateAnalytics();

  // Generate chart data based on metric and time period
  const generateChartData = (metricType, period, paidOnly=false, joinDateParam=null, pastEventsParam=null) => {

    const now = new Date();
    let startDate;

    switch(period) {
      case 'month': {
        // Start at the 1st of the current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      }
      case '6months': {
        // Start at the 1st of the month 5 months ago (inclusive of current month = 6 months)
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      }
      case 'ytd': {
        // Start at Jan 1 of current year
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      }
      default: { // 'all'
        // Anchor to a known earliest bound (already first of month)
        startDate = new Date(2020, 0, 1);
      }
    }
    // Remove join date filtering - show all historical data
    // if(joinDateParam && startDate < joinDateParam && joinDateParam <= now) {
    //   startDate = joinDateParam;
    // }

    const allEvents = [...(events || []), ...(pastEventsParam || pastEvents || [])]; // Combine upcoming and past events
    const baseEvents = paidOnly ? allEvents.filter(e => e.price_in_cents > 0) : allEvents;
    const filteredEvents = baseEvents.filter(e => new Date(e.starts_at) >= startDate);
    

    
    switch(metricType) {
      case 'rsvps':
        if (period === 'month') {
          // Daily table from event_daily (differences of cumulative)
          const daily = rsvpSeriesByPeriod['month']?.series || [];
          const rows = [];
          // Derive per-day increments from collapsed cumulative series
          for (let i = 1; i < daily.length; i++) {
            const curr = daily[i];
            const prev = daily[i-1];
            const currInc = Math.max(0, Number(curr.value || 0) - Number(prev.value || 0));
            if (currInc === 0) continue; // remove zero rows
            const dt = new Date(curr.label);
            const label = isNaN(dt.getTime()) ? curr.label : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const prevInc = i > 1 ? Math.max(0, Number(prev.value || 0) - Number(daily[i-2].value || 0)) : null;
            const delta = prevInc == null ? null : (currInc - prevInc);
            const pct = prevInc && prevInc !== 0 ? (delta / prevInc) : null;
            rows.push({ label, value: currInc, delta, pct });
          }
          return { data: rows, type: 'table', title: 'RSVPs by Day (This Month)' };
        }
        // Monthly table from host_monthly for other windows
        const monthBucket = rsvpMonthlyByPeriod[period];
        const series = monthBucket?.series || [];
        const rows = series.map((pt, idx) => {
          const prev = idx > 0 ? series[idx-1].value : null;
          const delta = prev == null ? null : (pt.value - prev);
          const pct = prev && prev !== 0 ? (delta / prev) : null;
          const [y, m] = pt.label.split('-');
          const dt = new Date(Number(y), Number(m)-1, 1);
          const label = isNaN(dt.getTime()) ? pt.label : dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          return { label, value: Number(pt.value || 0), delta, pct };
        }).filter(r => r.value > 0);
        return { data: rows, type: 'table', title: 'RSVPs by Month' };
      case 'capacity':
        // Serve from preloaded analytics.event_live derived dataset
        const bucketed = capacityByPeriod[period];
        if (bucketed?.chart) return bucketed.chart;
        // Fallback to local computation from events list
        const allEventsForCapacity = [...(events || []), ...(pastEventsParam || pastEvents || [])];
        const capacityEvents = paidOnly ? allEventsForCapacity.filter(e => e.price_in_cents > 0) : allEventsForCapacity;
        const chart = generateCapacityBarChart(capacityEvents);
        const eventsWithCapacity = capacityEvents.filter(e => e.rsvp_capacity && e.rsvp_capacity > 0);
        chart.avg = eventsWithCapacity.length > 0 ? (
          eventsWithCapacity.reduce((sum, event) => sum + ((event.rsvp_count || 0) / event.rsvp_capacity), 0) / eventsWithCapacity.length
        ) : 0;
        return chart;
      case 'revenueTimeline': {
        // Use precomputed net revenue series by period
        const s = revenueSeriesByPeriod?.[period]?.series || [];
        return { data: s, type: 'line', title: 'Revenue Over Time' };
      }
      case 'topEarning':
        const topEvents = paidOnly ? filteredEvents.filter(e=>e.price_in_cents>0) : filteredEvents;
        return generateRevenueChart(topEvents);
      case 'sellout':
        return generateSellOutChart(filteredEvents);
      case 'repeat':
        // Prefer RPC repeat stats if available; fall back to local computation
        {
          const stats = repeatStatsByPeriod?.[period];
          if (stats) {
            const unique = Number(stats.unique_attendees || 0);
            const repeat = Number(stats.repeat_attendees || 0);
            const firstTimers = Math.max(0, unique - repeat);
            // Keep existing labels; place first-timers in '1 Event' and all repeats into '2-3 Events'
            const data = [
              { label: '1 Event', value: firstTimers },
              { label: '2-3 Events', value: repeat },
              { label: '4-5 Events', value: 0 },
              { label: '6+ Events', value: 0 },
            ];
            return { data, type: 'doughnut', title: 'Guest Attendance Frequency' };
          }
          return generateRepeatGuestChart(filteredEvents);
        }
      case 'peak': {
        const peak = peakByPeriod[period];
        if (peak && peak.data) {
          return { data: peak.data, type: 'bar', title: 'Peak RSVP Timing Patterns', description: 'RSVP timing based on real lead-time buckets.' };
        }
        return generatePeakTimingChart(filteredEvents);
      }
      case 'refund':
        return generateRefundChart(filteredEvents);
      case 'avgRevenue': {
        // Prefer precomputed top revenue from analytics.event_live rollup if available
        const pre = capacityByPeriod?.[period]?.meta?.top;
        let rows = Array.isArray(pre) ? pre : null;
        if (!rows || rows.length === 0) {
          const revEvents = paidOnly
            ? filteredEvents.filter(e => (e.price_in_cents || 0) > 0)
            : filteredEvents;
          rows = revEvents
            .map(e => ({
              label: (e.title && e.title.length > 28) ? e.title.slice(0, 28) + '…' : (e.title || 'Untitled'),
              value: ((e.price_in_cents || 0) * (e.rsvp_count || 0)) / 100,
              fullTitle: e.title || 'Untitled',
            }))
            .filter(r => r.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
        }

        const description = (rows && rows.length > 0)
          ? "Your best earners — straight up. These are the events bringing in the most revenue, so copy what worked: timing, vibe, price, promo. Double down and scale what's real."
          : "No paid revenue yet. Once money starts moving, we'll show your top performers here.";

        return { data: rows || [], type: 'table', title: 'Top Revenue Events', description, tableKind: 'topRevenue' };
      }
      case 'afterTax':
        {
          const series = revenueSeriesByPeriod?.[period]?.series || [];
          if (series.length > 0) {
            const totalRevenue = series.reduce((s, r) => s + Number(r.value || 0), 0);
            const estimatedTaxRate = taxRate;
            const taxAmount = totalRevenue * estimatedTaxRate;
            const afterTaxAmount = totalRevenue - taxAmount;
            const keepPercentage = totalRevenue > 0 ? ((afterTaxAmount / totalRevenue) * 100).toFixed(0) : '0';
            const data = [
              { label: `You Keep: $${Math.round(afterTaxAmount)}`, value: Math.round(afterTaxAmount), subtitle: `Nice work. That's ${keepPercentage}% of what you earned, still in your pocket.` },
              { label: `Taxes: $${Math.round(taxAmount)}`, value: Math.round(taxAmount), subtitle: `The part Uncle Sam insists on. Plan ahead and you keep control.` }
            ];
            const description = `Where Your Money's Going\n\nBased on your chosen tax rate, here's what you're keeping vs. what's likely headed to the IRS. Numbers are estimates – actual taxes can change depending on deductions, other income, and new laws.`;
            return { data, type: 'pie', title: 'Your Money, On Your Terms', description };
          }
          return generateAfterTaxChart(filteredEvents);
        }
      default:
        return { data: [], type: 'line' };
    }
  };

  const generateRSVPLineChart = (events, period) => {
    const advancedData = global.hostAnalyticsData || { rsvpTimestamps: {} };
    
    // Get all RSVP timestamps across all events
    const allRsvps = [];
    Object.entries(advancedData.rsvpTimestamps).forEach(([eventId, rsvps]) => {
      rsvps.forEach(rsvp => {
        if (rsvp.status === 'attending') {
          allRsvps.push({
            date: new Date(rsvp.created_at),
            eventId
          });
        }
      });
    });
    
    // Sort by date
    allRsvps.sort((a, b) => a.date - b.date);
    
    if (allRsvps.length === 0) {
      return { data: [], type: 'line', title: 'RSVP Growth Over Time' };
    }
    
    const dataPoints = [];
    let cumulativeCount = 0;
    
    if (period === 'month') {
      // Daily cumulative for past month
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const dailyData = {};
      
      // Initialize with 0s for each day
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailyData[dayKey] = 0;
      }
      
      // Count cumulative RSVPs by day
      allRsvps.forEach(rsvp => {
        if (rsvp.date >= thirtyDaysAgo) {
          const dayKey = rsvp.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (dailyData.hasOwnProperty(dayKey)) {
            cumulativeCount++;
            dailyData[dayKey] = cumulativeCount;
          }
        }
      });
      
      // Fill forward cumulative values
      let lastValue = 0;
      Object.keys(dailyData).forEach(day => {
        if (dailyData[day] === 0) {
          dailyData[day] = lastValue;
        } else {
          lastValue = dailyData[day];
        }
      });
      
      Object.entries(dailyData).forEach(([day, count]) => {
        dataPoints.push({ label: day, value: count });
      });
      
    } else {
      // Monthly cumulative for longer periods (6 months, YTD, all)
      const now = new Date();
      let startDate = new Date();
      if (period === '6months') {
        startDate.setMonth(startDate.getMonth() - 5); // include current month as 6th
      } else if (period === 'ytd') {
        startDate = new Date(now.getFullYear(), 0, 1);
      } else {
        startDate = new Date(now.getFullYear() - 5, 0, 1); // 5 years back for 'all'
      }
      startDate.setDate(1); // first of month

      // Generate list of month keys between startDate and now
      const monthKeys = [];
      let iter = new Date(startDate);
      while (iter <= now) {
        monthKeys.push(iter.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
        iter.setMonth(iter.getMonth() + 1);
      }

      // Map RSVP counts by month
      const monthlyCounts = {};
      cumulativeCount = 0;
      allRsvps.forEach(rsvp => {
        const monthKey = rsvp.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (!monthlyCounts[monthKey]) monthlyCounts[monthKey] = 0;
        monthlyCounts[monthKey]++;
      });

      // Build cumulative dataPoints across months
      monthKeys.forEach(monthKey => {
        if (monthlyCounts[monthKey]) {
          cumulativeCount += monthlyCounts[monthKey];
        }
        dataPoints.push({ label: monthKey, value: cumulativeCount });
      });
    }
    
    // Ensure at least two points so the Polyline has a valid path
    if (dataPoints.length === 1) {
      const single = dataPoints[0];
      dataPoints.unshift({ label: single.label, value: 0 });
    }
    return { data: dataPoints, type: 'line', title: 'RSVP Growth Over Time' };
  };

  const generateCapacityBarChart = (events) => {
    // Fill-rate buckets: how full your events get
    const fillRanges = {
      '0-25%': 0,
      '26-50%': 0,
      '51-75%': 0,
      '76-99%': 0,
      '100%': 0,
      'No Capacity': 0,
    };
    
    events.forEach((event) => {
      const capacity = event.rsvp_capacity;
      const rsvps = event.rsvp_count || 0;

      // Events without capacity go in separate bucket
      if (!capacity || capacity === 0) {
        fillRanges['No Capacity']++;
        return;
      }

      const rate = rsvps / capacity;

      if (rate >= 1) {
        fillRanges['100%']++;
      } else if (rate >= 0.76) {
        fillRanges['76-99%']++;
      } else if (rate >= 0.51) {
        fillRanges['51-75%']++;
      } else if (rate >= 0.26) {
        fillRanges['26-50%']++;
      } else {
        fillRanges['0-25%']++;
      }
    });

    // Show ALL buckets, including zeros
    const data = Object.entries(fillRanges).map(([range, count]) => ({
      label: range,
      value: count,
    }));

    return { data, type: 'bar', title: 'Event Fill Rate Distribution' };
  };

  // Revenue over time (non-cumulative), bucketed by period granularity
  const generateRevenueTimelineChart = (events, period='all') => {
    const now = new Date();
    let startDate = new Date();
    const centsToDollars = (cents) => (Number(cents || 0) / 100);

    switch (period) {
      case 'month':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '6months':
        startDate.setMonth(startDate.getMonth() - 5); // include current month as 6th
        startDate.setDate(1);
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear() - 5, 0, 1);
    }

    const paid = events.filter(e => new Date(e.starts_at) >= startDate && e.price_in_cents > 0 && e.rsvp_count > 0);

    const dataPoints = [];
    if (period === 'month') {
      // Daily revenue for last 30 days
      const dailyMap = {};
      for (let i = 30; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0,10);
        dailyMap[key] = 0;
      }
      paid.forEach(ev => {
        const d = new Date(ev.starts_at);
        const key = d.toISOString().slice(0,10);
        if (d >= startDate) dailyMap[key] += centsToDollars((ev.price_in_cents||0) * (ev.rsvp_count||0));
      });
      Object.keys(dailyMap).sort().forEach(k => {
        const label = new Date(k).toLocaleDateString('en-US',{ month:'short', day:'numeric' });
        dataPoints.push({ label, value: dailyMap[k] });
      });
    } else if (period === '6months' || period === 'ytd') {
      // Monthly revenue
      const monthMap = {};
      let iter = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (iter <= now) {
        const key = `${iter.getFullYear()}-${String(iter.getMonth()+1).padStart(2,'0')}`;
        monthMap[key] = 0;
        iter.setMonth(iter.getMonth()+1);
      }
      paid.forEach(ev => {
        const d = new Date(ev.starts_at);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (monthMap[key] !== undefined) monthMap[key] += centsToDollars((ev.price_in_cents||0) * (ev.rsvp_count||0));
      });
      Object.keys(monthMap).forEach(k => {
        const [y,m] = k.split('-');
        const label = new Date(Number(y), Number(m)-1, 1).toLocaleDateString('en-US',{ month:'short', year:'2-digit' });
        dataPoints.push({ label, value: monthMap[k] });
      });
    } else {
      // All time: 3-month buckets
      const bucketMap = {};
      let iter = new Date(startDate.getFullYear(), startDate.getMonth() - (startDate.getMonth()%3), 1);
      while (iter <= now) {
        const y = iter.getFullYear();
        const m = iter.getMonth();
        const key = `${y}-Q${Math.floor(m/3)+1}`;
        bucketMap[key] = 0;
        iter.setMonth(iter.getMonth()+3);
      }
      paid.forEach(ev => {
        const d = new Date(ev.starts_at);
        const key = `${d.getFullYear()}-Q${Math.floor(d.getMonth()/3)+1}`;
        if (bucketMap[key] !== undefined) bucketMap[key] += centsToDollars((ev.price_in_cents||0) * (ev.rsvp_count||0));
      });
      Object.keys(bucketMap).forEach(k => {
        const [y,q] = k.split('-Q');
        const startMonth = (Number(q)-1)*3;
        const range = `${new Date(Number(y), startMonth, 1).toLocaleDateString('en-US',{ month:'short' })}–${new Date(Number(y), startMonth+2, 1).toLocaleDateString('en-US',{ month:'short' })} ${String(y).slice(2)}`;
        dataPoints.push({ label: range, value: bucketMap[k] });
      });
    }

    // Ensure at least two points
    if (dataPoints.length === 1) {
      const single = dataPoints[0];
      dataPoints.unshift({ label: single.label, value: 0 });
    }

    return { data: dataPoints, type: 'line', title: 'Revenue Over Time' };
  };

  const generateRevenueChart = (events) => {
    // Top earning events (limit 5) - calculate actual revenue (price × RSVPs)
    const paidEvents = events.filter(e => e.price_in_cents > 0);
    const revenueByEvent = paidEvents.map(e => ({
      label: e.title.length > 20 ? e.title.slice(0,20)+'…' : e.title,
      value: ((e.price_in_cents || 0) * (e.rsvp_count || 0)) / 100,
      fullTitle: e.title,
    })).filter(e => e.value > 0);

    revenueByEvent.sort((a,b)=> b.value - a.value);
    const top = revenueByEvent.slice(0,5);

    const totalRevenue = top.reduce((sum,r)=>sum+r.value,0);

    return { data: top, type: 'bar', title: 'Top-Earning Events', subtitle: 'Highest revenue events (price × RSVPs)', totalRevenue };
  };

  const generateSellOutChart = (events) => {
    const sellOutData = [
      { label: 'Sold Out', value: events.filter(e => e.rsvp_count >= (e.rsvp_capacity || Infinity)).length },
      { label: 'Available', value: events.filter(e => e.rsvp_count < (e.rsvp_capacity || Infinity) && e.rsvp_capacity).length },
      { label: 'No Limit', value: events.filter(e => !e.rsvp_capacity).length }
    ];
    
    return { data: sellOutData, type: 'pie', title: 'Event Fill Status' };
  };

  const generateRepeatGuestChart = (events) => {
    const advancedData = global.hostAnalyticsData || { userRsvpHistory: {} };
    const userCounts = Object.values(advancedData.userRsvpHistory).map(events => events.length);
    
    const buckets = { '1 Event': 0, '2-3 Events': 0, '4-5 Events': 0, '6+ Events': 0 };
    userCounts.forEach(count => {
      if (count === 1) buckets['1 Event']++;
      else if (count <= 3) buckets['2-3 Events']++;
      else if (count <= 5) buckets['4-5 Events']++;
      else buckets['6+ Events']++;
    });
    
    const data = Object.entries(buckets).map(([bucket, count]) => ({ label: bucket, value: count }));
    return { data, type: 'doughnut', title: 'Guest Attendance Frequency' };
  };

  const generatePeakTimingChart = (events) => {
    const advancedData = global.hostAnalyticsData || { rsvpTimestamps: {} };
    const dayData = { 'Same Day': 0, '1 Day Before': 0, '2-3 Days': 0, '4-7 Days': 0, '1+ Weeks': 0 };
    
    // Process real RSVP timestamp data
    Object.entries(advancedData.rsvpTimestamps).forEach(([eventId, rsvps]) => {
      const event = events.find(e => e.id === eventId);
      if (!event) return;
      
      const eventStart = new Date(event.starts_at);
      
      rsvps.forEach(rsvp => {
        const rsvpDate = new Date(rsvp.created_at);
        const hoursBeforeEvent = (eventStart - rsvpDate) / (1000 * 60 * 60);
        
        if (hoursBeforeEvent < 0) {
          // RSVP after event started (shouldn't happen but handle it)
          return;
        } else if (hoursBeforeEvent <= 24) {
          dayData['Same Day']++;
        } else if (hoursBeforeEvent <= 48) {
          dayData['1 Day Before']++;
        } else if (hoursBeforeEvent <= 72) {
          dayData['2-3 Days']++;
        } else if (hoursBeforeEvent <= 168) {
          dayData['4-7 Days']++;
        } else {
          dayData['1+ Weeks']++;
        }
      });
    });
    
    const data = Object.entries(dayData).map(([day, count]) => ({ 
      label: day, 
      value: count 
    }));
    
    const totalRsvps = data.reduce((sum, item) => sum + item.value, 0);
    const description = totalRsvps > 0 
      ? "This chart breaks down when guests usually RSVP for your events, showing the most common booking windows. Each bar represents how many RSVPs came in during that timeframe. Knowing your peak RSVP timing helps you plan promos, reminders, and hype drops to hit people when they're most likely to commit."
      : 'No RSVP timing data available yet. Host more events to see booking patterns.';
    
    return { 
      data, 
      type: 'bar', 
      title: 'Peak RSVP Timing Patterns',
      description 
    };
  };

  const generateRefundChart = (events) => {
    // Prefer analytics-based count totals when available (from RPC)
    const rp = refundByPeriod?.[timePeriod];
    const refunded = rp ? Number(rp.refund_count || 0) : 0;
    const total = rp ? Number(rp.rsvps_total || 0) : 0;
    const completed = Math.max(0, total - refunded);
    console.log('[refund] generateRefundChart', { period: timePeriod, rp, refunded, total, completed });
    
    // Calculate refund rate for milestone messaging
    const refundRate = total > 0 ? (refunded / total) : 0;
    let milestoneMessage = '';
    
    if (total === 0) {
      milestoneMessage = "No payments yet — your record is spotless by default. Start hosting to build your track record.";
    } else if (refundRate <= 0.05) {
      milestoneMessage = "🏆 Excellent record — your attendees trust you.";
    } else if (refundRate <= 0.10) {
      milestoneMessage = "👍 Solid record. Keep aiming for fewer refunds.";
    } else {
      milestoneMessage = "⚠ Higher than average refunds — check your event details and communication to keep attendees confident.";
    }
    
    const data = [
      { 
        label: '✅ Completed', 
        value: completed,
        subtitle: 'Payments that went through without a hitch.'
      },
      { 
        label: '↩ Refunded', 
        value: refunded,
        subtitle: 'Payments returned to attendees. Keep this low to boost your rep.'
      }
    ];
    
    const description = `Your Completion Record\n\nEvery completed RSVP builds trust with your attendees. Refunds happen — but keeping them low means confidence stays high.\n\n${milestoneMessage}`;
    
    return { 
      data, 
      type: 'pie', 
      title: 'Refund Rate\nDetailed Analytics – Your track record in numbers.',
      description,
      refundRate // Add this so AI insights can access it
    };
  };

  const generateAfterTaxChart = (events) => {
    const paidEvents = events.filter(e => e.price_in_cents > 0);
    if (paidEvents.length === 0) {
      return { data: [], type: 'pie', title: 'Tax Breakdown', description: 'No paid events yet to calculate tax estimates.' };
    }

    const totalRevenue = paidEvents.reduce((sum, event) => {
      return sum + ((event.price_in_cents || 0) * (event.rsvp_count || 0)) / 100;
    }, 0);

    // Use the user-selected tax rate from the slider
    const estimatedTaxRate = taxRate;

    const taxAmount = totalRevenue * estimatedTaxRate;
    const afterTaxAmount = totalRevenue - taxAmount;
    const keepPercentage = ((afterTaxAmount / totalRevenue) * 100).toFixed(0);

    // Celebratory microcopy
    let celebratoryMessage = '';
    if (afterTaxAmount >= 10000) {
      celebratoryMessage = "🎉 You've passed the $10K kept milestone — keep stacking!";
    } else if (afterTaxAmount >= 5000) {
      celebratoryMessage = "🎯 Over $5K kept — you're building something real here.";
    }

    const data = [
      { 
        label: `You Keep: $${Math.round(afterTaxAmount)}`, 
        value: Math.round(afterTaxAmount),
        subtitle: `Nice work. That's ${keepPercentage}% of what you earned, still in your pocket.`
      },
      { 
        label: `Taxes: $${Math.round(taxAmount)}`, 
        value: Math.round(taxAmount),
        subtitle: `The part Uncle Sam insists on. Plan ahead and you keep control.`
      }
    ];

    const description = `Where Your Money's Going\n\nBased on your chosen tax rate, here's what you're keeping vs. what's likely headed to the IRS. Numbers are estimates – actual taxes can change depending on deductions, other income, and new laws.${celebratoryMessage ? '\n\n' + celebratoryMessage : ''}`;

    return { 
      data, 
      type: 'pie', 
      title: 'Your Money, On Your Terms',
      description 
    };
  };

  const MetricCard = ({ title, value, subtitle, icon, color = '#3b82f6', metricType, disabled=false, disabledNote }) => {
    const muted = disabled;
    const borderColor = muted ? '#e5e7eb' : color;
    const textColor = muted ? '#9ca3af' : '#1f2937';
    const iconColor = muted ? '#9ca3af' : color;
    return (
      <TouchableOpacity 
        disabled={muted}
        style={{
          backgroundColor: muted ? '#fafafa' : 'white',
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderLeftWidth: 4,
          borderLeftColor: borderColor,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
        onPress={() => {
          if (muted) return;
          setSelectedMetric({ title, metricType, color });
          setModalVisible(true);
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Ionicons name={icon} size={20} color={iconColor} style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: textColor, flex: 1 }}>
            {title}
          </Text>
          {!muted && <Ionicons name="chevron-forward" size={16} color="#9ca3af" />}
        </View>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: textColor, marginBottom: 4 }}>
          {value}
        </Text>
        {subtitle && (
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            {subtitle}
          </Text>
        )}
        {muted && (
          <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 8, fontStyle: 'italic' }}>
            {disabledNote || 'Run paid events to receive AI insights.'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const InsightCard = ({ insight, recommendation, type = 'info' }) => {
    const getColor = () => {
      switch(type) {
        case 'success': return '#10b981';
        case 'warning': return '#f59e0b';
        case 'danger': return '#ef4444';
        default: return '#3b82f6';
      }
    };

    const getIcon = () => {
      switch(type) {
        case 'success': return 'checkmark-circle';
        case 'warning': return 'warning';
        case 'danger': return 'alert-circle';
        default: return 'bulb';
      }
    };

    return (
      <View style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: getColor(),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Ionicons 
            name={getIcon()} 
            size={20} 
            color={getColor()} 
            style={{ marginRight: 12, marginTop: 2 }} 
          />
          <View style={{ flex: 1 }}>
            <Text style={{ 
              fontSize: 14, 
              color: '#1f2937', 
              marginBottom: 8,
              lineHeight: 20 
            }}>
              {insight}
            </Text>
            <Text style={{ 
              fontSize: 13, 
              color: getColor(), 
              fontWeight: '500',
              lineHeight: 18 
            }}>
              💡 {recommendation}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (events.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
        <Ionicons name="analytics-outline" size={48} color="#9ca3af" style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>
          No Analytics Yet
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
          Create your first event to start seeing performance insights
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Key Metrics */}
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 16 }}>
        Key Metrics
      </Text>
      
      <MetricCard
        title="Total RSVPs (30 days)"
        value={(hostAnalytics.last30DayRsvps ?? analytics.last30DayRsvps).toString()}
        subtitle={`${hostAnalytics.totalRsvps ?? analytics.totalRsvps} total across ${paidOnly ? 'paid' : 'all'} events`}
        icon="people"
        color="#3b82f6"
        metricType="rsvps"
      />

      <MetricCard
        title="Capacity Fill Rate (Last 6 Months)"
        value={`${(((capacityByPeriod?.['6months']?.chart?.avg) ?? analytics.capacityFillRate) * 100).toFixed(1)}%`}
        subtitle={`${(capacityByPeriod?.['6months']?.chart?.data?.find(d=>d.label==='100%')?.value) ?? analytics.sellOutCount} ${paidOnly ? 'paid ' : ''}events sold out`}
        icon="speedometer"
        color="#10b981"
        metricType="capacity"
      />

      <MetricCard
        title="Avg Revenue per Event (Last 6 Months)"
        value={`$${(((hostMonthly.aggregates?.['6months']?.gross_revenue_cents || 0) / 100) / Math.max(hostMonthly.aggregates?.['6months']?.events || 0, 1)).toFixed(2)}`}
        subtitle={`Across ${hostMonthly.aggregates?.['6months']?.events || 0} ${paidOnly ? 'paid ' : ''}events`}
        icon="cash"
        color="#f59e0b"
        metricType="avgRevenue"
        disabled={!paidOnly}
        disabledNote="Verify your account to start earning for real."
      />

      <MetricCard
        title="Revenue (Last 6 Months)"
        value={`$${(revenueSeriesByPeriod?.['6months']?.series?.reduce((s,r)=>s+Number(r.value||0),0) || 0).toFixed(2)}`}
        subtitle={`Net to host over the last 6 months`}
        icon="trending-up"
        color="#8b5cf6"
        metricType="revenueTimeline"
        disabled={!paidOnly}
        disabledNote="Complete payout setup to grow this number fast."
      />

      <MetricCard
        title="Est. After-Tax Earnings"
        value={`$${(((revenueSeriesByPeriod?.['ytd']?.series || revenueSeriesByPeriod?.['6months']?.series || [])
          .reduce((s,r)=> s + Number(r.value || 0), 0)) * (taxRate != null ? (1 - taxRate) : (1 - analytics.estimatedTaxRate))).toFixed(2)}`}
        subtitle={`Assuming ${(analytics.estimatedTaxRate * 100).toFixed(0)}% effective tax rate`}
        icon="calculator"
        color="#059669"
        metricType="afterTax"
        disabled={!paidOnly}
        disabledNote="Register for payouts to make it yours."
      />



      {/* Repeat Guest Rate removed */}

      <MetricCard
        title="Peak RSVP Window"
        value={peakByPeriod?.['6months']?.label || analytics.peakRsvpDay}
        subtitle="When most people book"
        icon="time"
        color="#10b981"
        metricType="peak"
      />

      <MetricCard
        title="Refund Rate"
        value={`${(analytics.refundRate * 100).toFixed(1)}%`}
        subtitle="Payment cancellations"
        icon="card-outline"
        color="#f59e0b"
        metricType="refund"
        disabled={!paidOnly}
        disabledNote="Get verified to keep this number earning for you."
      />

      {/* AI Insights Section */}
      <Text style={{ 
        fontSize: 16, 
        fontWeight: '600', 
        color: '#1f2937', 
        marginTop: 24,
        marginBottom: 16 
      }}>
        AI Insights & Recommendations
      </Text>

      {/* AI-powered insights based on real data (only when Paid Only is on) */}
      {aiEnabled ? (
        <AnalyticsDrawerInsights analytics={{
          ...analytics,
          totalRsvps: hostAnalytics.totalRsvps ?? analytics.totalRsvps,
          last30DayRsvps: hostAnalytics.last30DayRsvps ?? analytics.last30DayRsvps,
        }} />
      ) : (
        <View style={{ backgroundColor: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>
            Run paid events to receive AI insights.
          </Text>
        </View>
      )}



      {/* Chart Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
            backgroundColor: 'white'
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937' }}>
                {selectedMetric?.title}
              </Text>
              <Text style={{ fontSize: 14, color: '#6b7280' }}>
                Detailed Analytics
              </Text>
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Time Period Selector */}
          <View style={{ padding: 16, backgroundColor: 'white', marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 12, color: '#1f2937' }}>
              Time Period
            </Text>
            <View style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 8, padding: 4 }}>
              {[
                { key: 'month', label: 'Past Month' },
                { key: '6months', label: '6 Months' },
                { key: 'ytd', label: 'YTD' },
                { key: 'all', label: 'All Time' }
              ].map(period => (
                <TouchableOpacity
                  key={period.key}
                  onPress={() => setTimePeriod(period.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 6,
                    backgroundColor: timePeriod === period.key ? 'white' : 'transparent',
                  }}
                >
                  <Text style={{
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: '500',
                    color: timePeriod === period.key ? selectedMetric?.color : '#6b7280',
                  }}>
                    {period.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tax Rate Slider - Only for After-Tax Chart */}
          {selectedMetric?.metricType === 'afterTax' && (
            <View style={{ padding: 16, backgroundColor: 'white', marginBottom: 16 }}>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>
                  Adjust Your Reality
                </Text>
                <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                  Slide to match your state's taxes. (Default assumes Texas rates – no state income tax.)
                </Text>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#059669', textAlign: 'center' }}>
                  {(taxRate * 100).toFixed(0)}%
                </Text>
              </View>
              
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={0.05}
                maximumValue={0.50}
                value={taxRate}
                onValueChange={setTaxRate}
                minimumTrackTintColor="#059669"
                maximumTrackTintColor="#d1d5db"
                thumbStyle={{ backgroundColor: '#059669', width: 24, height: 24 }}
                trackStyle={{ height: 6, borderRadius: 3 }}
                step={0.01}
              />
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 12 }}>
                <Text style={{ fontSize: 11, color: '#6b7280' }}>5%</Text>
                <Text style={{ fontSize: 11, color: '#6b7280' }}>50%</Text>
              </View>
              
              <Text style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', fontStyle: 'italic' }}>
                This is an estimate only. Consult a tax professional for accurate planning.
              </Text>

            </View>
          )}

          {/* Chart Container */}
          <ScrollView 
            style={{ flex: 1, padding: 16 }}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
            showsVerticalScrollIndicator={true}
          >
            <ChartContainer 
              chartData={selectedMetric ? generateChartData(selectedMetric.metricType, timePeriod, paidOnly, joinDate, pastEvents) : null}
              color={selectedMetric?.color}
              aiEnabled={aiEnabled}
              timePeriod={timePeriod}
            />
            {selectedMetric?.metricType === 'avgRevenue' && (
              <AIInsightCard 
                chartType="topRevenueEvents"
                chartData={generateChartData('avgRevenue', timePeriod, paidOnly, joinDate, pastEvents)}
                context={{ timePeriod }}
                style={{ marginTop: 12 }}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// Simple Chart Container Component
const ChartContainer = ({ chartData, color, aiEnabled=true, timePeriod }) => {
  if (!chartData || !chartData.data || chartData.data.length === 0) {
    return (
      <View style={{ 
        backgroundColor: 'white', 
        borderRadius: 12, 
        padding: 32, 
        alignItems: 'center' 
      }}>
        <Ionicons name="bar-chart-outline" size={48} color="#d1d5db" style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>
          No Data Available
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
          More data will be available as you host more events
        </Text>
      </View>
    );
  }

  const maxValue = chartData.type === 'bar'
    ? Math.max(0, ...chartData.data.map(d => Number(d.value || 0)))
    : 0;
  
  return (
    <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, minHeight: 'auto' }}>
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>
        {chartData.title}
      </Text>
      
      {/* Chart Description */}
      {chartData.description && (
        <Text style={{ 
          fontSize: 13, 
          color: '#6b7280', 
          marginBottom: 16,
          lineHeight: 18 
        }}>
          {chartData.description}
        </Text>
      )}
      
      {/* Chart Explanations */}
      {chartData.type === 'bar' && chartData.title.includes('Fill Rate') && (
        <Text style={{ 
          fontSize: 13, 
          color: '#6b7280', 
          marginBottom: 16,
          lineHeight: 18 
        }}>
          This chart breaks down how packed your events have been, using VybeLocal RSVPs against the capacity you set. Each bar shows how many events landed in each fill-rate range. If you draw a crowd outside VybeLocal, your real turnout might be higher.
        </Text>
      )}
      
      {chartData.type === 'line' && chartData.title.includes('RSVP Growth') && (
        <Text style={{ 
          fontSize: 13, 
          color: '#6b7280', 
          marginBottom: 16,
          lineHeight: 18 
        }}>
          This shows your running RSVP count across all VybeLocal events you've hosted. The line tracks each rise in your crowd over the selected period, giving you a clear view of your momentum.
        </Text>
      )}

      {chartData.type === 'bar' && chartData.title.includes('Top-Earning') && (
        <Text style={{ 
          fontSize: 13, 
          color: '#6b7280', 
          marginBottom: 16,
          lineHeight: 18 
        }}>
          This chart highlights the events that brought in the most VybeLocal revenue during the selected period. Each bar shows the total ticket revenue for that specific event.
        </Text>
      )}

      {chartData.type === 'line' && chartData.title.includes('Revenue Over Time') && (
        <Text style={{ 
          fontSize: 13, 
          color: '#6b7280', 
          marginBottom: 16,
          lineHeight: 18 
        }}>
          Net revenue over time. Points are daily for 30d, monthly for 6M/YTD, and 3‑month buckets for all‑time. Clean read on momentum without cumulative stacking.
        </Text>
      )}

      {chartData.type === 'doughnut' && chartData.title.includes('Guest Attendance Frequency') && (
        <Text style={{ 
          fontSize: 13, 
          color: '#6b7280', 
          marginBottom: 16,
          lineHeight: 18 
        }}>
          This chart shows how often the same guests come back to your events. Each category counts the number of attendees who've hit that many events. Higher repeat attendance means you're not just pulling a crowd — you're building loyalty, community, and a reason for people to keep showing up.
        </Text>
      )}
      

      
      {chartData.type === 'bar' && (
        <>
          {/* Window label */}
          {chartData.window?.start && chartData.window?.end && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>{chartData.window.start}</Text>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>{chartData.window.end}</Text>
            </View>
          )}
          <BarChart data={chartData.data} maxValue={maxValue} color={color} />
        </>
      )}
      
      {chartData.type === 'line' && (
        <LineChart data={chartData.data} color={color} />
      )}
      
      {(chartData.type === 'pie' || chartData.type === 'doughnut') && (
        <PieChart data={chartData.data} color={color} isDoughnut={chartData.type === 'doughnut'} />
      )}

      {chartData.type === 'table' && (
        <View style={{ marginTop: 8 }}>
          {chartData.data.map((row, idx) => {
            const sign = typeof row.delta === 'number' ? (row.delta > 0 ? '+' : row.delta < 0 ? '−' : '') : '';
            const pct = typeof row.pct === 'number' ? `${(row.pct * 100).toFixed(1)}%` : '—';
            return (
              <View key={idx} style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 8,
                borderBottomWidth: idx === chartData.data.length - 1 ? 0 : 1,
                borderBottomColor: '#f3f4f6'
              }}>
                <Text style={{ fontSize: 12, color: '#6b7280', flex: 1, paddingRight: 8 }} numberOfLines={2}>{row.label}</Text>
                <Text style={{ fontSize: 13, color: '#1f2937', fontWeight: '600', textAlign: 'right', width: 90 }}>
                  {chartData.tableKind === 'topRevenue' ? `$${Number(row.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : Number(row.value || 0)}
                </Text>
                {chartData.tableKind === 'topRevenue' ? (
                  <Text style={{ fontSize: 12, color: '#6b7280', textAlign: 'right', width: 70 }}>—</Text>
                ) : (
                  <Text style={{ fontSize: 12, color: row.delta > 0 ? '#10b981' : row.delta < 0 ? '#ef4444' : '#6b7280', textAlign: 'right', width: 70 }}>
                    {typeof row.delta === 'number' ? `${sign}${Math.abs(row.delta)}` : '—'}
                  </Text>
                )}
                {chartData.tableKind === 'topRevenue' ? (
                  <Text style={{ fontSize: 12, color: '#6b7280', textAlign: 'right', width: 60 }}>—</Text>
                ) : (
                  <Text style={{ fontSize: 12, color: row.pct > 0 ? '#10b981' : row.pct < 0 ? '#ef4444' : '#6b7280', textAlign: 'right', width: 60 }}>{pct}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}
      
      

      {/* Average summary for charts that include 'avg' */}
      {chartData.avg !== undefined && (
        <View style={{ marginTop: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>
            Average Fill Rate: <Text style={{ fontWeight: '600', color: '#1f2937' }}>{(chartData.avg * 100).toFixed(1)}%</Text>
          </Text>
        </View>
      )}

      {/* AI Insights */}
      {aiEnabled && chartData.type === 'bar' && chartData.title.includes('Fill Rate') && (
        <View style={{ marginTop: 20 }}>
          <AIInsightCard 
            chartType="capacity"
            chartData={chartData}
            context={{ timePeriod: 'current' }}
          />
        </View>
      )}

      {/* AI Insight for Top Revenue Chart */}
      {aiEnabled && chartData.type === 'bar' && chartData.title.includes('Top-Earning') && (
        <View style={{ marginTop: 20 }}>
          <AIInsightCard 
            chartType="revenue"
            chartData={chartData}
            context={{ timePeriod: 'current' }}
          />
        </View>
      )}

      {/* AI Insight for RSVP Growth Chart (line) */}
      {aiEnabled && chartData.type === 'line' && chartData.title.includes('RSVP') && (
        <View style={{ marginTop: 20 }}>
          <AIInsightCard 
            chartType="rsvpGrowth"
            chartData={chartData}
            context={{ timePeriod }}
          />
        </View>
      )}

      {/* AI Insight for RSVP Tables (day/month) */}
      {aiEnabled && chartData.type === 'table' && chartData.title.includes('RSVP') && (
        <View style={{ marginTop: 20 }}>
          <AIInsightCard 
            chartType="rsvpGrowth"
            chartData={chartData}
            context={{ timePeriod }}
          />
        </View>
      )}

      {/* AI Insight for Revenue Timeline Chart */}
      {aiEnabled && chartData.type === 'line' && chartData.title.includes('Revenue Over Time') && (
        <View style={{ marginTop: 20 }}>
          <AIInsightCard 
            chartType="revenueTimeline"
            chartData={chartData}
            context={{ timePeriod }}
          />
        </View>
      )}

      {/* AI Insight for Sell-Out Status Chart */}
      {aiEnabled && chartData.type === 'pie' && chartData.title.includes('Event Fill Status') && (
        <View style={{ marginTop: 20 }}>
          <AIInsightCard 
            chartType="sellOut"
            chartData={chartData}
            context={{ timePeriod: 'current' }}
          />
        </View>
      )}

      {/* AI Insight for Repeat Guest Chart */}
      {aiEnabled && chartData.type === 'doughnut' && chartData.title.includes('Guest Attendance Frequency') && (
        <AIInsightCard 
          chartType="repeatGuest"
          chartData={chartData}
          context={{ timePeriod: 'current' }}
          style={{ marginTop: 24 }}
        />
      )}

      {/* AI Insight for Peak Timing Chart */}
      {aiEnabled && (chartData.title.includes('Peak RSVP') || chartData.title.includes('RSVP Timing')) && (
        <View style={{ marginTop: 20 }}>
          <AIInsightCard 
            chartType="peakTiming"
            chartData={chartData}
            context={{ timePeriod: 'current' }}
          />
        </View>
      )}

      {/* AI Insight for Refund Chart */}
      {aiEnabled && chartData.title.includes('Refund') && (
        <View style={{ marginTop: 20 }}>
          <AIInsightCard 
            chartType="refund"
            chartData={chartData}
            context={{ timePeriod: 'current' }}
          />
        </View>
      )}

      {!aiEnabled && (
        <View style={{ marginTop: 16, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12 }}>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>
            Run paid events to receive AI insights.
          </Text>
        </View>
      )}

      <View style={{
        flexDirection: 'row',
        justifyContent: 'center',
        paddingTop: 12
      }}>
        <Text style={{ fontSize: 13, color: '#6b7280' }}>
          { (chartData?.title || '').includes('Revenue')
            ? null
            : <>Total Growth: <Text style={{ fontWeight: '600', color: '#1f2937' }}>${maxValue}</Text></>
          }
        </Text>
      </View>
    </View>
  );
};

// Enhanced Bar Chart Component
const BarChart = ({ data, maxValue, color }) => (
  <View style={{ height: 280, paddingTop: 16 }}>
    {/* Chart Grid */}
    <View style={{ position: 'absolute', top: 16, bottom: 40, left: 80, right: 16 }}>
      {[0, 25, 50, 75, 100].map(percent => (
        <View key={percent} style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${100 - percent}%`,
          borderTopWidth: 1,
          borderTopColor: percent === 0 ? '#d1d5db' : '#f3f4f6'
        }} />
      ))}
    </View>
    
    {/* Y-Axis Labels */}
    <View style={{ position: 'absolute', top: 16, bottom: 40, left: 0, width: 70 }}>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
        <View key={index} style={{
          position: 'absolute',
          top: `${(1 - ratio) * 100}%`,
          right: 8,
          transform: [{ translateY: -8 }]
        }}>
          <Text style={{ fontSize: 10, color: '#6b7280', textAlign: 'right' }}>
            {Math.round(maxValue * ratio)}
          </Text>
        </View>
      ))}
    </View>
    
    {/* Bars */}
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 80, paddingRight: 16, paddingBottom: 40 }}>
      {data.map((item, index) => {
        const safeMax = Math.max(1, Number(maxValue) || 0);
        const val = Math.max(0, Number(item.value || 0));
        const barHeight = Math.max((val / safeMax) * 160, 4);
        return (
          <View key={index} style={{ flex: 1, alignItems: 'center', marginHorizontal: 2 }}>
            <View style={{
              width: '80%',
              height: barHeight,
              backgroundColor: color || '#3b82f6',
              borderRadius: 4,
              justifyContent: 'flex-end',
              alignItems: 'center',
              paddingBottom: 4,
              shadowColor: color || '#3b82f6',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 3,
            }}>
              <Text style={{ 
                fontSize: 10, 
                fontWeight: '600', 
                color: 'white',
                textAlign: 'center'
              }}>
                {item.value}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
    
    {/* X-Axis Labels */}
    <View style={{ 
      flexDirection: 'row', 
      paddingLeft: 80, 
      paddingRight: 16,
      paddingTop: 8 
    }}>
      {data.map((item, index) => (
        <View key={index} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ 
            fontSize: 10, 
            color: '#6b7280',
            textAlign: 'center',
            transform: [{ rotate: '-45deg' }],
            marginTop: 4
          }}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  </View>
);

// Beautiful SVG Line Chart
const LineChart = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  if (data.length < 2) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 12, color: '#6b7280' }}>Not enough points to draw a trend yet.</Text>
      </View>
    );
  }
  
  const values = data.map(d => Number(d.value || 0));
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;
  const totalValue = values.reduce((sum, v) => sum + v, 0);
  
  const chartWidth = 280;
  const chartHeight = 120;
  const padding = 20;
  
  // Calculate points for the line
  const points = data.map((item, index) => {
    const x = padding + (index / (data.length - 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - (((Number(item.value || 0) - minValue) / range) * (chartHeight - 2 * padding));
    return `${x},${y}`;
  }).join(' ');
  
  // Find peak point for label
  const peakIndex = data.findIndex(item => item.value === maxValue);
  const peakX = padding + (peakIndex / (data.length - 1)) * (chartWidth - 2 * padding);
  const peakY = chartHeight - padding - ((maxValue - minValue) / range) * (chartHeight - 2 * padding);
  
  return (
    <View style={{ height: 250, padding: 20 }}>
      {/* Chart Container */}
      <View style={{
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb'
      }}>
        
        {/* SVG Line Chart */}
        <View style={{ height: chartHeight, justifyContent: 'center', alignItems: 'center' }}>
          {/* Chart background with grid */}
          <View style={{
            width: chartWidth,
            height: chartHeight,
            backgroundColor: '#f9fafb',
            borderRadius: 8,
            position: 'relative',
            borderWidth: 1,
            borderColor: '#e5e7eb'
          }}>
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(percent => (
              <View key={percent} style={{
                position: 'absolute',
                left: padding,
                right: padding,
                top: `${percent}%`,
                borderTopWidth: 1,
                borderTopColor: '#f3f4f6'
              }} />
            ))}
            
            {/* SVG solid line */}
            <Svg width={chartWidth} height={chartHeight} style={{ position: 'absolute', top: 0, left: 0 }}>
              <Polyline
                points={points}
                fill="none"
                stroke={color || '#3b82f6'}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          
          {/* Peak Value Label */}
          <View style={{
            position: 'absolute',
            left: peakX - 20,
            top: peakY - 35,
            backgroundColor: color || '#3b82f6',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
          }}>
            <Text style={{ 
              fontSize: 12, 
              color: 'white', 
              fontWeight: '600'
            }}>
              {maxValue}
            </Text>
          </View>
        </View>
        
        {/* Time Range */}
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between',
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#f3f4f6'
        }}>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            {data[0]?.label}
          </Text>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            {data[data.length - 1]?.label}
          </Text>
        </View>
      </View>
      
      {/* Summary */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'center',
        paddingTop: 12
      }}>
        <Text style={{ fontSize: 13, color: '#6b7280' }}>
          Total Growth: <Text style={{ fontWeight: '600', color: '#1f2937' }}>${Number(totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </Text>
      </View>
    </View>
  );
};

// Enhanced Pie Chart Component
const PieChart = ({ data, color, isDoughnut }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const colors = [
    color || '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#6b7280'
  ];
  
  return (
    <View style={{ paddingTop: 16, paddingBottom: 16 }}>
      {/* Summary Stats */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 20,
        paddingHorizontal: 16
      }}>
        <View style={{
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#e5e7eb'
        }}>
          <Text style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
            Total Items
          </Text>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', textAlign: 'center' }}>
            {total}
          </Text>
        </View>
      </View>
      
      {/* Data Items */}
      <View style={{ paddingHorizontal: 16 }}>
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          const itemColor = colors[index % colors.length];
          
          return (
            <View key={index} style={{ 
              marginBottom: 12,
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 16,
              borderLeftWidth: 4,
              borderLeftColor: itemColor,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{
                  width: 12,
                  height: 12,
                  borderRadius: isDoughnut ? 6 : 3,
                  backgroundColor: itemColor,
                  marginRight: 12
                }} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#1f2937' }}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1f2937' }}>
                  {percentage.toFixed(1)}%
                </Text>
              </View>
              
              {/* Subtitle if available */}
              {item.subtitle && (
                <Text style={{ 
                  fontSize: 12, 
                  color: '#6b7280', 
                  marginBottom: 8,
                  lineHeight: 16,
                  fontStyle: 'italic'
                }}>
                  {item.subtitle}
                </Text>
              )}
              
              {/* Percentage Bar */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  flex: 1,
                  height: 6,
                  backgroundColor: '#f3f4f6',
                  borderRadius: 3,
                  marginRight: 12
                }}>
                  <View style={{
                    width: `${percentage}%`,
                    height: '100%',
                    backgroundColor: itemColor,
                    borderRadius: 3,
                  }} />
                </View>
                <Text style={{ fontSize: 12, color: '#6b7280', minWidth: 45, textAlign: 'right' }}>
                  ${item.value}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Enhanced Area Chart for Revenue
const AreaChart = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  
  const maxValue = Math.max(...data.map(d => d.value));
  const totalRevenue = data.reduce((sum, d) => sum + d.value, 0);
  
  return (
    <View style={{ height: 320, paddingTop: 16 }}>
      {/* Revenue Summary */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
        paddingHorizontal: 16
      }}>
        <View style={{
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          alignItems: 'center',
          flex: 1,
          marginRight: 8
        }}>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>Total Revenue</Text>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#8b5cf6' }}>
            ${totalRevenue.toFixed(2)}
          </Text>
        </View>
        <View style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          alignItems: 'center',
          flex: 1,
          marginLeft: 8
        }}>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>Peak Month</Text>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#10b981' }}>
            ${maxValue.toFixed(2)}
          </Text>
        </View>
      </View>
      
      {/* Chart Grid */}
      <View style={{ position: 'absolute', top: 90, bottom: 60, left: 60, right: 16 }}>
        {[0, 25, 50, 75, 100].map(percent => (
          <View key={percent} style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${100 - percent}%`,
            borderTopWidth: 1,
            borderTopColor: percent === 0 ? '#d1d5db' : '#f3f4f6'
          }} />
        ))}
      </View>
      
      {/* Y-Axis Labels */}
      <View style={{ position: 'absolute', top: 90, bottom: 60, left: 0, width: 55 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
          <View key={index} style={{
            position: 'absolute',
            top: `${(1 - ratio) * 100}%`,
            right: 8,
            transform: [{ translateY: -8 }]
          }}>
            <Text style={{ fontSize: 9, color: '#6b7280', textAlign: 'right' }}>
              ${Math.round(maxValue * ratio)}
            </Text>
          </View>
        ))}
      </View>
      
      {/* Area Chart */}
      <View style={{ 
        position: 'absolute', 
        top: 90, 
        bottom: 60, 
        left: 60, 
        right: 16,
        flexDirection: 'row',
        alignItems: 'end'
      }}>
        {data.map((item, index) => {
          const height = Math.max((item.value / maxValue) * 140, 2);
          
          return (
            <View key={index} style={{ flex: 1, alignItems: 'center', height: 140 }}>
              {/* Area Fill */}
              <View style={{
                position: 'absolute',
                bottom: 0,
                width: '90%',
                height: height,
                backgroundColor: `${color || '#8b5cf6'}40`,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
              }} />
              
              {/* Top Border Line */}
              <View style={{
                position: 'absolute',
                bottom: height - 2,
                width: '90%',
                height: 2,
                backgroundColor: color || '#8b5cf6',
                borderRadius: 1,
              }} />
              
              {/* Value Point */}
              <View style={{ 
                position: 'absolute', 
                bottom: height - 3,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: color || '#8b5cf6',
                borderWidth: 2,
                borderColor: 'white',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.3,
                shadowRadius: 2,
                elevation: 3,
              }} />
              
              {/* Hover Value */}
              {item.value > maxValue * 0.7 && (
                <View style={{
                  position: 'absolute',
                  bottom: height + 8,
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                  borderRadius: 3,
                }}>
                  <Text style={{ 
                    fontSize: 9, 
                    color: 'white', 
                    fontWeight: '600'
                  }}>
                    ${item.value.toFixed(0)}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
      
      {/* X-Axis Labels */}
      <View style={{ 
        position: 'absolute',
        bottom: 0,
        left: 60,
        right: 16,
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 8
      }}>
        {data.map((item, index) => (
          <View key={index} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ 
              fontSize: 9, 
              color: '#6b7280',
              textAlign: 'center',
              transform: [{ rotate: '-45deg' }],
            }}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default function HostCreateScreen() {
  const { user, profile } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tooltipBottom = insets.bottom + 33; // raised by 5px
  const [events, setEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [calendarRange, setCalendarRange] = useState(null); // {first, last}
  const [showPastEvents, setShowPastEvents] = useState(false); // toggle between current and past
  const [pastSortBy, setPastSortBy] = useState('date'); // 'date' or 'rsvps'
  const [showTooltip, setShowTooltip] = useState(false);
  const [paidOnly, setPaidOnly] = useState(true);
  const [taxRate, setTaxRate] = useState(0.18); // Default 18% tax rate (Texas - no state income tax)
  const [joinDate, setJoinDate] = useState(null);
  const [metrics, setMetrics] = useState({
    totalRsvps: 0,
    rsvpsToday: 0,
    monthlyRevenue: 0
  });
  const [calendarSheet, setCalendarSheet] = useState({ open:false, event:null });
  const [pastPage, setPastPage] = useState(1);

  useEffect(() => {
    if (user) {
      loadHostData();
      fetchJoinDate();
    }
  }, [user]);

  const fetchJoinDate = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single();
      const jd = profile?.created_at ? new Date(profile.created_at) : new Date();
      setJoinDate(jd);
    } catch(e){ }  };

  const loadHostData = async () => {
    try {
      setLoading(true);
      const now = new Date().toISOString();
      
      // Fetch upcoming events (or calendar month slice if requested)
      let upcomingQuery = supabase
        .from('events')
        .select('id, host_id, title, status, starts_at, ends_at, vibe, price_in_cents, rsvp_capacity, img_path')
        .eq('host_id', user.id)
        .order('starts_at', { ascending: true });
      if (viewMode === 'calendar' && calendarRange?.first && calendarRange?.last) {
        upcomingQuery = upcomingQuery.gte('starts_at', calendarRange.first).lte('starts_at', calendarRange.last);
      } else {
        upcomingQuery = upcomingQuery.gte('starts_at', now);
      }
      const { data: upcomingData, error: upcomingError } = await upcomingQuery;

      if (upcomingError) throw upcomingError;

      // Fetch past events (or same month slice for calendar)
      let pastQuery = supabase
        .from('events')
        .select('id, host_id, title, status, starts_at, ends_at, vibe, price_in_cents, rsvp_capacity, img_path')
        .eq('host_id', user.id)
        .order('starts_at', { ascending: false });
      if (viewMode === 'calendar' && calendarRange?.first && calendarRange?.last) {
        pastQuery = pastQuery.gte('starts_at', calendarRange.first).lte('starts_at', calendarRange.last);
      } else {
        pastQuery = pastQuery.lt('starts_at', now);
      }
      const { data: pastData, error: pastError } = await pastQuery;

      if (pastError) throw pastError;

      // Get advanced RSVP data for analytics
      const allEventIds = [...(upcomingData || []), ...(pastData || [])].map(e => e.id);
      let rsvpCounts = {};
      let rsvpTimestamps = {};
      let userRsvpHistory = {};
      
      if (allEventIds.length > 0) {
        // Fetch RSVPs with timestamps for advanced analytics
        const { data: rsvpData } = await supabase
          .from('rsvps')
          .select('event_id, status, user_id, created_at, paid')
          .in('event_id', allEventIds)
          .neq('user_id', user.id) // Exclude host's own RSVP
          .eq('status', 'attending') // Only count attending RSVPs
          .order('created_at');

        // Skip payments join on first paint (was causing 400s under RLS). Optional later.
        const paymentData = [];

        // Process RSVP data for basic counts and advanced analytics
        rsvpData?.forEach(rsvp => {
          const eventId = rsvp.event_id;
          
          // Basic counts (all are attending since we filtered)
          if (!rsvpCounts[eventId]) {
            rsvpCounts[eventId] = { attending: 0, total: 0 };
          }
          rsvpCounts[eventId].attending++;
          rsvpCounts[eventId].total++;

          // Timestamp tracking for sell-out speed and surge analysis
          if (!rsvpTimestamps[eventId]) {
            rsvpTimestamps[eventId] = [];
          }
          rsvpTimestamps[eventId].push({
            created_at: rsvp.created_at,
            status: rsvp.status,
            user_id: rsvp.user_id
          });

          // User history for repeat guest tracking
          if (!userRsvpHistory[rsvp.user_id]) {
            userRsvpHistory[rsvp.user_id] = [];
          }
          userRsvpHistory[rsvp.user_id].push(eventId);
        });

        // Store analytics data for later use
        global.hostAnalyticsData = {
          rsvpTimestamps,
          userRsvpHistory,
          paymentData: paymentData || []
        };
      }

      // Update events with RSVP counts
      const updateEventsWithRsvps = (eventList) => {
        return eventList.map(event => ({
          ...event,
          rsvp_count: rsvpCounts[event.id]?.attending || 0
        }));
      };

      // Helper function to create event image URL
      const createEventImageUrl = async (imgPath) => {
        if (!imgPath) return null;
        if (imgPath.startsWith('http')) return imgPath;
        try {
          const { data } = await supabase.storage
            .from('event-images')
            .createSignedUrl(imgPath, 3600);
          return data?.signedUrl || null;
        } catch {
          return null;
        }
      };

      // Add RSVP data to events
      const enrichEvents = async (events) => {
        if (!events) return [];
        const enrichedEvents = await Promise.all(
          events.map(async (event) => ({
            ...event,
            rsvp_count: rsvpCounts[event.id]?.attending || 0,
            total_rsvps: rsvpCounts[event.id]?.total || 0,
            capacity: event.rsvp_capacity, // Use actual capacity from DB (null/0 = no limit)
            imageUrl: await createEventImageUrl(event.img_path),
          }))
        );
        return enrichedEvents;
      };

      const enrichedUpcoming = await enrichEvents(upcomingData);
      const enrichedPast = await enrichEvents(pastData);
      
      setEvents(enrichedUpcoming);
      setPastEvents(enrichedPast);
      
      // Show tooltip only if the user has never created any events
      const hasAnyEvents = (enrichedUpcoming.length + enrichedPast.length) > 0;
      setShowTooltip(!hasAnyEvents);
      
      // Calculate metrics
      const totalRsvps = Object.values(rsvpCounts).reduce((sum, count) => sum + count.attending, 0);
      
      // Calculate RSVPs today (need to access from global analytics data)
      const today = new Date().toDateString();
      const allRsvpTimestamps = Object.values(rsvpTimestamps).flat();
      const rsvpsToday = allRsvpTimestamps.filter(rsvp => 
        new Date(rsvp.created_at).toDateString() === today
      ).length || 0;
      
      // Calculate monthly revenue (fallback until payments analytics is wired)
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const monthlyRevenue = [...enrichedUpcoming, ...enrichedPast]
        .filter(event => {
          const eventDate = new Date(event.starts_at);
          return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
        })
        .reduce((sum, event) => sum + ((event.price_in_cents || 0) * (event.rsvp_count || 0) / 100), 0);

      // Read host-level analytics (O(1) counters)
      // Determine which host_id to read analytics for (prefer events' host)
      const inferredHostId = (enrichedUpcoming[0]?.host_id) || (enrichedPast[0]?.host_id) || user?.id;
      let analyticsTotals = null;
      try {
        const { data: hl, error: hlErr } = await supabase
          .schema('analytics')
          .from('host_live')
          .select('total_events,total_rsvps,total_revenue_cents')
          .eq('host_id', inferredHostId)
          .maybeSingle();
        if (hlErr) {}
        
        analyticsTotals = hl || null;
      } catch (e) {
        
      }

      setMetrics({
        totalEvents: analyticsTotals?.total_events ?? (enrichedUpcoming.length + enrichedPast.length),
        totalRsvps: analyticsTotals?.total_rsvps ?? totalRsvps,
        rsvpsToday,
        monthlyRevenue: analyticsTotals?.total_revenue_cents != null
          ? (analyticsTotals.total_revenue_cents / 100)
          : monthlyRevenue,
      });

    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['rgba(203,180,227,0.2)', 'rgba(255,200,162,0.4)']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'left', 'right']}>
      <AppHeader />
      
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ padding: 16, paddingBottom: 8 }}>
          <Text style={{ 
            fontSize: 28, 
            fontWeight: 'bold', 
            color: '#1f2937',
            marginBottom: 4
          }}>
            Host Dashboard
          </Text>
          <Text style={{ fontSize: 16, color: '#6b7280' }}>
            Manage your events and track performance
          </Text>
      </View>

        {/* Events Overview - Default Open */}
        <HostSection title="Events Overview" defaultOpen={true} icon="calendar">
          {loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ marginTop: 16, color: '#6b7280' }}>Loading your events...</Text>
            </View>
          ) : (
            <View>
              {/* Quick Stats */}
              <View style={{ 
                flexDirection: 'row', 
                marginBottom: 24,
                backgroundColor: '#f8f9fa',
                padding: 16,
                borderRadius: 8
              }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>
                    {metrics.totalEvents}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    Total Events
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>
                    {metrics.totalRsvps}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    Total RSVPs
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.primary }}>
                    ${metrics.monthlyRevenue}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    This Month
                  </Text>
                </View>
              </View>

              {/* Time Toggle */}
              <EventTimeToggle 
                showPast={showPastEvents} 
                onToggle={setShowPastEvents}
                upcomingCount={events.length}
                pastCount={pastEvents.length}
              />

              {/* View Toggle */}
              <ViewToggle viewMode={viewMode} onToggle={setViewMode} />

              {/* Current/Upcoming Events */}
              {!showPastEvents && (
                <>
                  {events.length > 0 ? (
                    <View style={{ marginBottom: 24 }}>
                      <Text style={{ 
                        fontSize: 16, 
                        fontWeight: '600', 
                        marginBottom: 12,
                        color: '#1f2937'
                      }}>
                        📆 Current & Upcoming Events
                      </Text>
                      {viewMode === 'list' ? (
                        (() => {
                          const pageSize = 5;
                          const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
                          const safePage = Math.min(Math.max(1, upcomingPage), totalPages);
                          if (safePage !== upcomingPage) {
                            setTimeout(()=> setUpcomingPage(safePage), 0);
                          }
                          const start = (safePage - 1) * pageSize;
                          const pageItems = events.slice(start, start + pageSize);
                          return (
                            <>
                              {pageItems.map(event => (
                                <EventCard key={event.id} event={event} />
                              ))}
                              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop: 12 }}>
                                <TouchableOpacity
                                  onPress={()=> setUpcomingPage(Math.max(1, safePage - 1))}
                                  disabled={safePage <= 1}
                                  style={{
                                    paddingHorizontal:12, paddingVertical:8, borderRadius:8,
                                    backgroundColor: safePage<=1 ? '#f3f4f6' : '#eef2ff',
                                    borderWidth:1, borderColor: '#e5e7eb'
                                  }}
                                >
                                  <Text style={{ color: safePage<=1 ? '#9ca3af' : '#4f46e5', fontWeight:'600' }}>Prev</Text>
                                </TouchableOpacity>
                                <Text style={{ fontSize:12, color:'#6b7280' }}>Page {safePage} of {totalPages}</Text>
                                <TouchableOpacity
                                  onPress={()=> setUpcomingPage(Math.min(totalPages, safePage + 1))}
                                  disabled={safePage >= totalPages}
                                  style={{
                                    paddingHorizontal:12, paddingVertical:8, borderRadius:8,
                                    backgroundColor: safePage>=totalPages ? '#f3f4f6' : '#eef2ff',
                                    borderWidth:1, borderColor: '#e5e7eb'
                                  }}
                                >
                                  <Text style={{ color: safePage>=totalPages ? '#9ca3af' : '#4f46e5', fontWeight:'600' }}>Next</Text>
                                </TouchableOpacity>
                              </View>
                            </>
                          );
                        })()
                      ) : (
                        <MiniCalendar
                          onMonthChange={({ first, last }) => setCalendarRange({ first, last })}
                          events={[...events, ...pastEvents].map(ev=>({
                            ...ev,
                            _isPast: new Date(ev.starts_at) < new Date()
                          }))}
                          onSelectEvent={(ev)=> setCalendarSheet({ open:true, event: ev })}
                        />
                      )}
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                      <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
                      <Text style={{ 
                        fontSize: 16, 
                        color: '#6b7280', 
                        marginTop: 12,
                        textAlign: 'center'
                      }}>
                        No upcoming events yet. Tap the green + to host a Vybe and put something on the calendar.
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* Past Events */}
              {showPastEvents && (
                <>
                  {pastEvents.length > 0 ? (
                    <View>
                      <Text style={{ 
                        fontSize: 16, 
                        fontWeight: '600',
                        color: '#1f2937',
                        marginBottom: 12
                      }}>
                        ✅ Past Events ({pastEvents.length})
                      </Text>
                      
                      <SortToggle sortBy={pastSortBy} onToggle={(val)=>{ setPastSortBy(val); setPastPage(1); }} />
                      
                      {(() => {
                        const sortedPast = [...pastEvents].sort((a, b) => {
                          if (pastSortBy === 'rsvps') {
                            return b.rsvp_count - a.rsvp_count;
                          }
                          return new Date(b.starts_at) - new Date(a.starts_at);
                        });
                        const pageSize = 5;
                        const totalPages = Math.max(1, Math.ceil(sortedPast.length / pageSize));
                        const safePage = Math.min(Math.max(1, pastPage), totalPages);
                        if (safePage !== pastPage) {
                          // Defer state correction to next tick to avoid setting state during render
                          setTimeout(()=> setPastPage(safePage), 0);
                        }
                        const start = (safePage - 1) * pageSize;
                        const pageItems = sortedPast.slice(start, start + pageSize);
                        
                        return (
                          <>
                            {pageItems.map(event => (
                              <EventCard key={event.id} event={event} isPast={true} />
                            ))}
                            {/* Pagination Controls */}
                            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop: 12 }}>
                              <TouchableOpacity
                                onPress={()=> setPastPage(Math.max(1, safePage - 1))}
                                disabled={safePage <= 1}
                                style={{
                                  paddingHorizontal:12, paddingVertical:8, borderRadius:8,
                                  backgroundColor: safePage<=1 ? '#f3f4f6' : '#eef2ff',
                                  borderWidth:1, borderColor: '#e5e7eb'
                                }}
                              >
                                <Text style={{ color: safePage<=1 ? '#9ca3af' : '#4f46e5', fontWeight:'600' }}>Prev</Text>
                              </TouchableOpacity>
                              <Text style={{ fontSize:12, color:'#6b7280' }}>Page {safePage} of {totalPages}</Text>
                              <TouchableOpacity
                                onPress={()=> setPastPage(Math.min(totalPages, safePage + 1))}
                                disabled={safePage >= totalPages}
                                style={{
                                  paddingHorizontal:12, paddingVertical:8, borderRadius:8,
                                  backgroundColor: safePage>=totalPages ? '#f3f4f6' : '#eef2ff',
                                  borderWidth:1, borderColor: '#e5e7eb'
                                }}
                              >
                                <Text style={{ color: safePage>=totalPages ? '#9ca3af' : '#4f46e5', fontWeight:'600' }}>Next</Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        );
                      })()}
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                      <Ionicons name="checkmark-circle-outline" size={48} color="#d1d5db" />
                      <Text style={{ 
                        fontSize: 16, 
                        color: '#6b7280', 
                        marginTop: 12,
                        textAlign: 'center'
                      }}>
                        No past events yet.
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* Overall Empty State */}
              {events.length === 0 && pastEvents.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
                  <Text style={{ 
                    fontSize: 16, 
                    color: '#6b7280', 
                    marginTop: 12,
                    textAlign: 'center'
                  }}>
                    No events yet. Create your first event to get started!
                  </Text>
                </View>
              )}
            </View>
          )}
        </HostSection>

        {/* First-Timer Tooltip moved outside ScrollView */}

        {/* Payouts & Earnings */}
        <HostSection title="Payouts & Earnings" icon="card">
          {/* KYB status banner (hidden when active/completed) */}
          <KybStatusBannerInline />
          {profile?.tilled_merchant_id || profile?.stripe_account_id ? (
            <PlaceholderContent 
              icon="cash"
              title="Payouts enabled"
              description="You're set to accept payments and receive payouts."
            />
          ) : (
            <View style={{ padding: 12 }}>
              <Text style={{ fontSize: 14, color: '#111827' }}>Start earning from your events through VybeLocal.</Text>
              <Text style={{ fontSize: 14, color: '#111827', marginTop: 6 }}>Ready to charge for tickets and track your earnings?{"\n"}Become a Monetized Host with a quick setup.</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Home', { screen: 'KybIntro' })} style={{ marginTop:12, backgroundColor:'#BAA4EB', borderRadius:10, paddingVertical:12, alignItems:'center' }}>
                <Text style={{ color:'#fff', fontWeight:'800' }}>Get Verified & Start Earning →</Text>
              </TouchableOpacity>
            </View>
          )}
        </HostSection>

        {/* Analytics */}
        <HostSection title="Analytics" icon="bar-chart" headerRight={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Paid Only</Text>
            <Switch 
              value={paidOnly} 
              onValueChange={setPaidOnly}
              trackColor={{ false: '#d1d5db', true: '#10b981' }}
              thumbColor={paidOnly ? '#fff' : '#f4f3f4'}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        }>
          <AnalyticsContent 
            events={[...events, ...pastEvents]} 
            paidOnly={paidOnly} 
            setPaidOnly={setPaidOnly} 
            joinDate={joinDate}
            taxRate={taxRate}
            setTaxRate={setTaxRate}
          />
        </HostSection>

        {/* Business Profile/Tools - Pro Tier */}
        <HostSection title="Business Profile/Tools" icon="business" headerRight={
          <View style={{ 
            backgroundColor: '#8b5cf6', 
            paddingHorizontal: 8, 
            paddingVertical: 4, 
            borderRadius: 12 
          }}>
            <Text style={{ color: 'white', fontSize: 10, fontWeight: '600' }}>PRO</Text>
          </View>
        }>
          <View style={{ gap: 16 }}>
            {/* QR Scanner Card */}
            <TouchableOpacity style={{
              backgroundColor: '#f8fafc',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  backgroundColor: '#dbeafe',
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Ionicons name="qr-code" size={20} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4 }}>
                    QR Scanner
                  </Text>
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>
                    Scan QR codes for quick check-ins and event management
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </View>
            </TouchableOpacity>

            {/* Business Profile Management Card */}
            <TouchableOpacity style={{
              backgroundColor: '#f8fafc',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  backgroundColor: '#dcfce7',
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Ionicons name="business" size={20} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4 }}>
                    Profile Management
                  </Text>
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>
                    Update business details, branding, and account settings
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </View>
            </TouchableOpacity>

            {/* Advanced Tools Card */}
            <TouchableOpacity style={{
              backgroundColor: '#f8fafc',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: '#e2e8f0',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  backgroundColor: '#fef3c7',
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Ionicons name="construct" size={20} color="#d97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4 }}>
                    Advanced Tools
                  </Text>
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>
                    Bulk operations, integrations, and analytics exports
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </View>
            </TouchableOpacity>

            {/* Pro Tier Info */}
            <View style={{
              backgroundColor: '#f3e8ff',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: '#d8b4fe',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Ionicons name="star" size={16} color="#8b5cf6" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#8b5cf6' }}>
                  Pro Tier Features
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: '#7c3aed', lineHeight: 16 }}>
                Unlock advanced business tools, QR scanning, custom branding, and detailed analytics to grow your events.
              </Text>
            </View>
          </View>
        </HostSection>

        {/* Bottom spacing for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
      {showTooltip && (
        <View style={{
          position: 'absolute',
          bottom: tooltipBottom,
          alignSelf: 'center',
          transform: [{ translateX: 16 }],
          backgroundColor: '#CBB4E3',
          borderRadius: 12,
          padding: 16,
          maxWidth: 280,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 10,
          zIndex: 100,
        }}>
          <View style={{
            position: 'absolute',
            bottom: -8,
            left: '50%',
            marginLeft: -8,
            width: 0,
            height: 0,
            borderLeftWidth: 8,
            borderRightWidth: 8,
            borderTopWidth: 8,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: '#CBB4E3',
          }} />
          <Text style={{ color: '#111827', fontSize: 14, fontWeight: '700', marginBottom: 8 }}>
            Create Your First Event! 🎉
          </Text>
          <Text style={{ color: '#111827', fontSize: 12, lineHeight: 18, marginBottom: 12, opacity: 0.9 }}>
            Tap the purple + button to host your first event and start building your community.
          </Text>
          <TouchableOpacity onPress={() => setShowTooltip(false)} style={{ alignSelf: 'flex-end', backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
            <Text style={{ color: '#111827', fontSize: 12, fontWeight: '700' }}>Got it!</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <HostDrawerOverlay />
      {/* Calendar-tap actions sheet (same as EventCard) */}
      {calendarSheet.open && (
        <HostEventActionsSheet
          visible={calendarSheet.open}
          onClose={() => setCalendarSheet({ open:false, event:null })}
          event={calendarSheet.event}
          onOpenChat={() => {
            setCalendarSheet({ open:false, event:null });
            // Navigate to chat modal for this event
            // Reuse existing state flow by temporarily rendering EventChatModal inline
            // For now, open quick modal path
            // TODO: unify modal lifting if needed
          }}
          onViewRsvps={() => {
            setCalendarSheet({ open:false, event:null });
            // Trigger same RSVP list modal path as EventCard (handled per-card)
          }}
          onEdit={() => setCalendarSheet({ open:false, event:null })}
          onCancelEvent={() => setCalendarSheet({ open:false, event:null })}
        />
      )}
    </SafeAreaView>
    </LinearGradient>
  );
} 