// mobile/screens/PastVybesScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
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

  // Report modal state
  const [reportVisible, setReportVisible] = useState(false);
  const [reportEvent, setReportEvent] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportExplanation, setReportExplanation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

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
              .createSignedUrl(ev.img_path, 3600);
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

  const openReportModal = useCallback((ev) => {
    setReportEvent(ev);
    setReportReason('');
    setReportExplanation('');
    setShowDropdown(false);
    setReportVisible(true);
  }, []);

  const submitReport = useCallback(async () => {
    if (!user || !reportEvent) return;
    if (!reportReason) {
      Alert.alert('Select a reason', 'Please choose a reason from the list.');
      return;
    }
    if (reportReason !== 'no_interaction' && !reportExplanation.trim()) {
      Alert.alert('Add details', 'Please include a brief explanation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        target_type: 'event',
        target_id: reportEvent.id,
        reporter_id: user.id,
        user_id: reportEvent.host_id, // event owner
        reason_code: reportReason,
        details: reportReason === 'no_interaction' ? null : { explanation: reportExplanation.trim() },
        severity: 1,
        status: 'pending',
        source: 'user',
      };

      const { error } = await supabase.from('flags').insert(payload);
      if (error) throw error;

      setReportVisible(false);
      setReportEvent(null);
      setReportReason('');
      setReportExplanation('');
      Alert.alert('Report submitted', 'Thanks. Our team will review this Vybe.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not submit report.');
    } finally {
      setIsSubmitting(false);
    }
  }, [user, reportEvent, reportReason, reportExplanation]);

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
          onPress={() => openReportModal(item.event)}
        >
          <Ionicons name="flag-outline" size={16} color="#ef4444" />
          <Text style={styles.reportText}>Report Issue</Text>
        </TouchableOpacity>
      </View>
    );
  }, [openReportModal]);

  const keyExtractor = useCallback((item) => item.id, []);

  const getItemLayout = useCallback((data, index) => ({
    length: 300,
    offset: 300 * index,
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

        {/* Report Event Modal (overlay) */}
        {reportVisible && (
          <View style={styles.reportOverlay}>
            <View style={styles.reportCard}>
              <Text style={styles.reportTitle}>Report This Vybe</Text>
              <Text style={styles.reportCopy}>
                We take safety and authenticity seriously. Tell us what went wrong so we can look into it.
              </Text>

              {/* Reason dropdown */}
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.dropdownLabel}>Reason</Text>
                <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowDropdown(!showDropdown)}>
                  <Text style={styles.dropdownText}>
                    {reportReason === 'no_show' ? 'No show by host' :
                     reportReason === 'mlm_scam' ? 'MLM / Scam' :
                     reportReason === 'harassment' ? 'Harassment or bullying' :
                     reportReason === 'unsafe' ? 'Unsafe environment' :
                     reportReason === 'inappropriate' ? 'Inappropriate content or behavior' :
                     reportReason === 'spam' ? 'Spam or solicitation' :
                     reportReason === 'misleading' ? 'Misleading or false event' :
                     reportReason === 'other' ? 'Other' : 'Select a reason...'}
                  </Text>
                  <Ionicons name={showDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="#6b7280" />
                </TouchableOpacity>
                {showDropdown && (
                  <View style={styles.dropdownList}>
                    {[
                      { label: 'No show by host', value: 'no_show' },
                      { label: 'MLM / Scam', value: 'mlm_scam' },
                      { label: 'Harassment or bullying', value: 'harassment' },
                      { label: 'Unsafe environment', value: 'unsafe' },
                      { label: 'Inappropriate content or behavior', value: 'inappropriate' },
                      { label: 'Spam or solicitation', value: 'spam' },
                      { label: 'Misleading or false event', value: 'misleading' },
                      { label: 'Other', value: 'other' },
                    ].map(opt => (
                      <TouchableOpacity key={opt.value} style={styles.dropdownOption} onPress={() => { setReportReason(opt.value); setShowDropdown(false); }}>
                        <Text style={[styles.dropdownOptionText, reportReason === opt.value && { color:'#BAA4EB', fontWeight:'600' }]}>{opt.label}</Text>
                        {reportReason === opt.value && <Ionicons name="checkmark" size={16} color="#BAA4EB" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Explanation */}
              {reportReason && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.dropdownLabel}>What happened? (required)</Text>
                  <TextInput
                    style={styles.explanationInput}
                    multiline
                    numberOfLines={4}
                    maxLength={255}
                    placeholder="Give us a brief description..."
                    placeholderTextColor="#9ca3af"
                    value={reportExplanation}
                    onChangeText={setReportExplanation}
                    textAlignVertical="top"
                  />
                  <Text style={styles.charCount}>{reportExplanation.length}/255</Text>
                </View>
              )}

              {/* Actions */}
              <View style={{ flexDirection:'row', gap: 12 }}>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setReportVisible(false)} disabled={isSubmitting}>
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSubmit, (isSubmitting || !reportReason || !reportExplanation.trim()) && { opacity: 0.5 }]}
                  disabled={isSubmitting || !reportReason || !reportExplanation.trim()}
                  onPress={submitReport}
                >
                  <Text style={[styles.modalBtnText, { color:'#fff' }]}>{isSubmitting ? 'Submitting...' : 'Submit Report'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
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
  reportOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '92%',
    maxWidth: 440,
  },
  reportTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  reportCopy: { fontSize: 14, color: '#374151', marginBottom: 16, lineHeight: 20 },
  dropdownLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#374151' },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  dropdownText: { fontSize: 14, color: '#111827', flex: 1 },
  dropdownList: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownOptionText: { fontSize: 14, color: '#111827', flex: 1 },
  explanationInput: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
    minHeight: 90,
    fontSize: 14,
    color: '#111827',
  },
  charCount: { fontSize: 12, color: '#6b7280', textAlign: 'right', marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#f3f4f6' },
  modalBtnSubmit: { backgroundColor: '#e11d48' },
  modalBtnText: { fontSize: 14, fontWeight: '600', color: '#111827' },
});
