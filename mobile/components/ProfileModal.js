import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Animated, Dimensions, Easing, TextInput, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { useAuth } from '../auth/AuthProvider';
import Constants from 'expo-constants';
import { apiFetch } from '../utils/api';

function useAvatarUrl(path) {
  const [url, setUrl] = useState('https://placehold.co/80x80');
  useEffect(() => {
    if (!path) { setUrl('https://placehold.co/80x80'); return; }
    if (path.startsWith('http')) { setUrl(path); return; }
    supabase.storage.from('profile-images').createSignedUrl(path, 3600).then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }, [path]);
  return url;
}

function formatLastActive(lastActive) {
  if (!lastActive) return 'Never';
  const date = new Date(lastActive);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

export default function ProfileModal({ visible, onClose, profile, stats = {} }) {
  const { user } = useAuth();
  const screenH = Dimensions.get('window').height;
  const slideAnim = React.useRef(new Animated.Value(screenH)).current;
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportExplanation, setReportExplanation] = useState('');
  const [shouldBlock, setShouldBlock] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  React.useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      // Check if already following this host
      checkFollowStatus();
    } else {
      slideAnim.setValue(screenH);
      // Reset modal state when profile modal closes
      setShowFollowModal(false);
    }
  }, [visible]);

  const checkFollowStatus = async () => {
    const hostId = profile?.uuid || profile?.id;
    if (!user || !hostId) {
      console.log('Missing data:', { user: user?.id, profile: profile, hostId });
      return;
    }
    
    try {
      console.log('Checking follow status for:', { follower: user.id, host: hostId });
      const { data, error } = await supabase
        .from('host_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('host_id', hostId)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking follow status:', error);
        return;
      }
      
      console.log('Follow status result:', data);
      setIsFollowing(!!data);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const handleFollowToggle = async () => {
    const hostId = profile?.uuid || profile?.id;
    console.log('handleFollowToggle called', { user: user?.id, hostId, isFollowing });
    
    if (!user || !hostId) {
      console.log('Missing user or profile');
      Alert.alert('Error', 'User or profile information missing.');
      return;
    }
    
    setFollowLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        console.log('Attempting to unfollow...');
        const resp = await apiFetch(`/api/follows?host_id=${encodeURIComponent(hostId)}`, { method: 'DELETE' });
        if (!resp) {
          console.error('Unfollow error: failed response');
          throw error;
        }
        console.log('Unfollow successful');
        setIsFollowing(false);
        Alert.alert('Success', 'You are no longer following this host.');
      } else {
        // Follow
        console.log('Attempting to follow...');
        console.log('Insert data:', { follower_id: user.id, host_id: hostId });
        
        const resp = await apiFetch('/api/follows', { method: 'POST', body: { host_id: hostId } });
        if (!resp) {
          console.error('Follow error: failed response');
          throw new Error('Follow failed');
        }
        console.log('Follow successful, inserted data:', data);
        setIsFollowing(true);
        Alert.alert('Success', 'You are now following this host! You\'ll see their events in your feed.');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Error', `Failed to update follow status: ${error.message || 'Please try again.'}`);
    } finally {
      setFollowLoading(false);
      setShowFollowModal(false);
    }
  };

  const avatarUrl = useAvatarUrl(profile?.avatar_url);

  if (!visible || !profile) return null;

  return (
    <>
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform:[{ translateY: slideAnim }] }]}>
          {/* White to peach gradient background */}
          <LinearGradient
            colors={['#FFFFFF', '#FFE5D9']}
            start={{x:0,y:0}} 
            end={{x:0,y:1}}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Header */}
          <View style={[styles.headerRow, {
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(186, 164, 235, 0.3)',
            zIndex: 2,
          }]}>
            <Text style={[styles.headerText, { fontWeight: '700' }]}>Profile</Text>
            <TouchableOpacity onPress={onClose}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#ef4444',
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#ef4444',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 4,
                elevation: 4,
              }}>
                <Ionicons name="close" size={18} color="#ffffff" />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, zIndex: 2 }}>
            <View style={[styles.profileRow, {
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#BAA4EB',
              shadowColor: '#BAA4EB',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
              padding: 16,
            }]}>
              <View style={{
                shadowColor: '#BAA4EB',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8,
              }}>
                <Image source={{ uri: avatarUrl }} style={[styles.avatar, {
                  borderWidth: 2,
                  borderColor: '#BAA4EB',
                }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { fontWeight: '700' }]}>{profile.name}</Text>
                {profile.pronouns ? (<Text style={[styles.pronouns, { fontWeight: '500' }]}>{profile.pronouns}</Text>) : null}
                <Text style={[styles.statLine, { fontWeight: '500' }]}>{stats.completed ?? 0} completed event{stats.completed === 1 ? '' : 's'} • {stats.cancels ?? 0} cancellation{stats.cancels === 1 ? '' : 's'} (last 6 mo)</Text>
                {profile.is_trusted && (
                  <View style={styles.verifiedContainer}>
                    <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                    <Text style={styles.verifiedText}>Verified Host</Text>
                  </View>
                )}
                {profile.is_trusted && profile.trusted_since && (
                  <Text style={styles.trustedSince}>
                    Verified since {new Date(profile.trusted_since).toLocaleDateString('en-US', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </Text>
                )}
              </View>

            </View>

            {/* Bio */}
            {profile.bio && (
              <View style={styles.bioContainer}>
                <Text style={styles.bioText}>{profile.bio}</Text>
              </View>
            )}

            {/* Last Active */}
            <View style={[styles.lastActiveContainer, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <Text style={styles.lastActiveText}>Last active: {formatLastActive(profile.last_active_at)}</Text>
              <TouchableOpacity 
                style={styles.flagButton}
                onPress={() => setShowReportModal(true)}
              >
                <Ionicons name="flag" size={16} color="#9ca3af" style={{ marginRight: 4 }} />
                <Text style={styles.flagButtonText}>Block/Report User</Text>
              </TouchableOpacity>
            </View>

            {/* Follow Section - only show if not viewing own profile */}
            {user?.id !== (profile?.uuid || profile?.id) && (
              <View style={styles.followSection}>
                <TouchableOpacity 
                  style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                  onPress={() => {
                    if (isFollowing) {
                      handleFollowToggle();
                    } else {
                      setShowFollowModal(true);
                    }
                  }}
                  disabled={followLoading}
                >
                  <Ionicons 
                    name={isFollowing ? "checkmark-circle" : "add-circle-outline"} 
                    size={16} 
                    color={isFollowing ? "#fff" : "#BAA4EB"} 
                    style={{ marginRight: 8 }} 
                  />
                                  <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                  {followLoading ? 'Loading...' : (isFollowing ? 'Following' : 'Follow Host')}
                </Text>
              </TouchableOpacity>
              
              </View>
            )}

          </ScrollView>
        </Animated.View>

        {/* Enhanced Report Modal with Blocking */}
        {showReportModal && (
          <View style={styles.reportModalOverlay}>
            <View style={styles.reportModal}>
              <Text style={styles.reportModalTitle}>Report User</Text>
              <Text style={styles.reportModalText}>
                VybeLocal is built on trust and real-world respect.{'\n\n'}
                If this user feels unsafe, misleading, or out of alignment with our community values, please let us know.
              </Text>

              {/* Reason Dropdown */}
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>Reason for reporting:</Text>
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowDropdown(!showDropdown)}
                >
                  <Text style={styles.dropdownText}>
                    {reportReason === 'no_interaction' ? 'I just don\'t want to interact with this person' :
                     reportReason === 'spam' ? 'Spam or scam' :
                     reportReason === 'harassment' ? 'Harassment or bullying' :
                     reportReason === 'inappropriate' ? 'Inappropriate content or behavior' :
                     reportReason === 'fake' ? 'Fake profile or impersonation' :
                     reportReason === 'other' ? 'Other' : 'Select a reason...'}
                  </Text>
                  <Ionicons name={showDropdown ? "chevron-up" : "chevron-down"} size={16} color="#6b7280" />
                </TouchableOpacity>
                
                {showDropdown && (
                  <View style={styles.dropdownList}>
                    <ScrollView 
                      style={styles.dropdownScrollView}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                    >
                      {[
                        { label: 'I just don\'t want to interact with this person', value: 'no_interaction' },
                        { label: 'Spam or scam', value: 'spam' },
                        { label: 'Harassment or bullying', value: 'harassment' },
                        { label: 'Inappropriate content or behavior', value: 'inappropriate' },
                        { label: 'Fake profile or impersonation', value: 'fake' },
                        { label: 'Other', value: 'other' }
                      ].map((reason) => (
                        <TouchableOpacity
                          key={reason.value}
                          style={[styles.dropdownOption, reportReason === reason.value && styles.dropdownOptionSelected]}
                          onPress={() => {
                            setReportReason(reason.value);
                            setShowDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownOptionText, reportReason === reason.value && styles.dropdownOptionTextSelected]}>
                            {reason.label}
                          </Text>
                          {reportReason === reason.value && (
                            <Ionicons name="checkmark" size={16} color="#BAA4EB" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Explanation field for reasons other than "no interaction" */}
              {reportReason && reportReason !== 'no_interaction' && (
                <View style={styles.explanationContainer}>
                  <Text style={styles.explanationLabel}>Please explain (required):</Text>
                  <TextInput
                    style={styles.explanationInput}
                    multiline
                    numberOfLines={4}
                    maxLength={255}
                    placeholder="Describe the issue in detail..."
                    placeholderTextColor="#9ca3af"
                    value={reportExplanation}
                    onChangeText={setReportExplanation}
                    textAlignVertical="top"
                  />
                  <Text style={styles.charCount}>{reportExplanation.length}/255</Text>
                </View>
              )}

              {/* Blocking option */}
              <TouchableOpacity 
                style={styles.blockOption}
                onPress={() => setShouldBlock(!shouldBlock)}
              >
                <View style={[styles.checkbox, shouldBlock && styles.checkboxChecked]}>
                  {shouldBlock && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={styles.blockOptionText}>
                  Also block this user (they won't be able to see your events or interact with you)
                </Text>
              </TouchableOpacity>

              <View style={styles.reportModalButtons}>
                <TouchableOpacity 
                  style={[styles.reportModalBtn, styles.reportModalBtnCancel]}
                  onPress={() => {
                    setShowReportModal(false);
                    setReportReason('');
                    setReportExplanation('');
                    setShouldBlock(false);
                  }}
                >
                  <Text style={styles.reportModalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.reportModalBtn, 
                    styles.reportModalBtnSubmit,
                    (isSubmitting || (!reportReason || (reportReason !== 'no_interaction' && !reportExplanation.trim()))) && styles.buttonDisabled
                  ]}
                  onPress={async () => {
                    if (!reportReason) {
                      Alert.alert('Error', 'Please select a reason for reporting.');
                      return;
                    }
                    if (reportReason !== 'no_interaction' && !reportExplanation.trim()) {
                      Alert.alert('Error', 'Please provide an explanation for your report.');
                      return;
                    }

                    setIsSubmitting(true);
                    try {
                      const reportedUserId = profile?.uuid || profile?.id;
                      
                      // Submit the report
                      await apiFetch('/api/flags', { method: 'POST', body: {
                        target_type: 'user',
                        target_id: reportedUserId,
                        user_id: reportedUserId,
                        reason_code: reportReason,
                        details: reportReason !== 'no_interaction' ? reportExplanation : null,
                        severity: 1,
                      }});

                      // If user also wants to block, handle that
                      if (shouldBlock) {
                        try {
                          await apiFetch('/api/blocks', { method: 'POST', body: { target_id: reportedUserId } });
                        } catch (err) {
                          console.error('Block submission error: failed response');
                          // Don't throw here - report was successful, blocking failed
                          Alert.alert('Report Submitted', 'Your report was submitted, but there was an issue blocking the user. Please try blocking separately.');
                          return;
                        }
                      }
                      
                      setShowReportModal(false);
                      setReportReason('');
                      setReportExplanation('');
                      setShouldBlock(false);
                      
                      Alert.alert(
                        'Report Submitted', 
                        shouldBlock 
                          ? 'Thank you for your report. The user has been blocked and our moderation team will review your report.' 
                          : 'Thank you for your report. Our moderation team will review it shortly.'
                      );
                    } catch (error) {
                      console.error('Error submitting report:', error);
                      Alert.alert('Error', `Failed to submit report: ${error.message || 'Please try again.'}`);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting || !reportReason || (reportReason !== 'no_interaction' && !reportExplanation.trim())}
                >
                  <Text style={[styles.reportModalBtnText, { color: '#fff' }]}>
                    {isSubmitting ? 'Submitting...' : (shouldBlock ? 'Report & Block' : 'Submit Report')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {showFollowModal && (
          <View style={styles.reportModalOverlay}>
            <View style={styles.reportModal}>
              <Text style={styles.reportModalTitle}>Track This Host</Text>
              <Text style={styles.reportModalText}>
                Stay in the loop. No alerts on their end, just more fun on yours.
              </Text>
              <View style={styles.reportModalButtons}>
                <TouchableOpacity 
                  style={[styles.reportModalBtn, styles.reportModalBtnCancel]}
                  onPress={() => setShowFollowModal(false)}
                >
                  <Text style={styles.reportModalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.reportModalBtn, styles.reportModalBtnSubmit]}
                  onPress={handleFollowToggle}
                  disabled={followLoading}
                >
                  <Text style={[styles.reportModalBtnText, { color: '#fff' }]}>
                    {followLoading ? 'Tracking...' : 'Track'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}


      </View>
    </Modal>


    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' },
  card: { width:'90%', maxHeight:'90%', backgroundColor:'#fff', borderRadius:12, overflow:'hidden' },
  headerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, borderBottomWidth:1, borderColor:'#eee' },
  headerText: { fontSize:18, fontWeight:'700' },
  closeBtn: { fontSize:24, color:'#666' },
  profileRow: { flexDirection:'row', alignItems:'flex-start', marginBottom: 16 },
  avatar: { width:64, height:64, borderRadius:32, marginRight:12 },
  name: { fontSize:16, fontWeight:'600' },
  pronouns: { fontSize:12, color:'#666', marginTop: 2 },
  statLine: { fontSize:11, color:'#6b7280', marginTop: 4 },
  verifiedContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  verifiedText: { fontSize: 12, color: '#22c55e', fontWeight: '600', marginLeft: 4 },
  trustedSince: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  flagButton: { padding: 8, flexDirection: 'row', alignItems: 'center' },
  flagButtonText: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  bioContainer: { marginBottom: 12 },
  bioText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  lastActiveContainer: { marginBottom: 16 },
  lastActiveText: { fontSize: 12, color: '#6b7280' },
  dropdownContainer: { marginBottom: 16 },
  dropdownLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#374151' },
  dropdownButton: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderWidth: 1, 
    borderColor: '#d1d5db', 
    borderRadius: 8, 
    backgroundColor: '#fff' 
  },
  dropdownText: { fontSize: 14, color: '#374151', flex: 1 },
  dropdownList: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownOptionSelected: {
    backgroundColor: 'rgba(186, 164, 235, 0.1)',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  dropdownOptionTextSelected: {
    color: '#BAA4EB',
    fontWeight: '600',
  },
  explanationContainer: { marginBottom: 16 },
  explanationLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#374151' },
  explanationInput: { 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderWidth: 1, 
    borderColor: '#d1d5db', 
    borderRadius: 8, 
    backgroundColor: '#fff',
    minHeight: 80,
    fontSize: 14,
    color: '#374151'
  },
  charCount: { 
    fontSize: 12, 
    color: '#6b7280', 
    textAlign: 'right', 
    marginTop: 4 
  },
  blockOption: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  checkbox: { 
    width: 20, 
    height: 20, 
    borderRadius: 4, 
    borderWidth: 2, 
    borderColor: '#d1d5db', 
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2
  },
  checkboxChecked: { 
    backgroundColor: '#BAA4EB', 
    borderColor: '#BAA4EB' 
  },
  blockOptionText: { 
    fontSize: 14, 
    color: '#374151', 
    flex: 1,
    lineHeight: 20
  },
  buttonDisabled: { opacity: 0.5 },
  followSection: { 
    paddingTop: 16, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(186, 164, 235, 0.3)' 
  },
  followBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    backgroundColor: 'rgba(186, 164, 235, 0.1)', 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAA4EB',
    // iOS-only subtle shadow; Android uses clean no-elevation to avoid heavy look
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
    } : {
      elevation: 0,
    }),
  },
  followBtnActive: { 
    backgroundColor: '#BAA4EB',
    borderColor: '#BAA4EB',
  },
  followBtnText: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#BAA4EB' 
  },
  followBtnTextActive: { 
    color: '#fff' 
  },
  reportModalOverlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 1000
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportModal: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 24, 
    margin: 20, 
    maxWidth: 400 
  },
  reportModalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#374151' },
  reportModalText: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 24 },
  reportModalButtons: { flexDirection: 'row', gap: 12 },
  reportModalBtn: { 
    flex: 1, 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  reportModalBtnCancel: { backgroundColor: '#f3f4f6' },
  reportModalBtnSubmit: { backgroundColor: '#e11d48' },
  reportModalBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
}); 