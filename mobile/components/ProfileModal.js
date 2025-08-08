import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Animated, Dimensions, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

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
  const screenH = Dimensions.get('window').height;
  const slideAnim = React.useRef(new Animated.Value(screenH)).current;
  const [blockReason, setBlockReason] = useState('');
  const [blockDetails, setBlockDetails] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  React.useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      slideAnim.setValue(screenH);
    }
  }, [visible]);

  const avatarUrl = useAvatarUrl(profile?.avatar_url);

  if (!visible || !profile) return null;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform:[{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.headerText}>Profile</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>×</Text></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View style={styles.profileRow}>
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{profile.name}</Text>
                {profile.pronouns ? (<Text style={styles.pronouns}>{profile.pronouns}</Text>) : null}
                <Text style={styles.statLine}>{stats.completed ?? 0} completed event{stats.completed === 1 ? '' : 's'} • {stats.cancels ?? 0} cancellation{stats.cancels === 1 ? '' : 's'} (last 6 mo)</Text>
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
              <TouchableOpacity 
                style={styles.flagButton}
                onPress={() => setShowReportModal(true)}
              >
                <Ionicons name="flag" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Bio */}
            {profile.bio && (
              <View style={styles.bioContainer}>
                <Text style={styles.bioText}>{profile.bio}</Text>
              </View>
            )}

            {/* Last Active */}
            <View style={styles.lastActiveContainer}>
              <Text style={styles.lastActiveText}>Last active: {formatLastActive(profile.last_active_at)}</Text>
            </View>

            {/* Block Section */}
            <View style={styles.blockSection}>
              <Text style={styles.blockSectionTitle}>Reason for blocking (optional):</Text>
              
              <View style={styles.pickerContainer}>
                <TouchableOpacity 
                  style={styles.pickerButton}
                  onPress={() => {
                    // Simple implementation - could be enhanced with a proper picker modal
                    const reasons = [
                      { label: 'No reason', value: '' },
                      { label: 'Spam or scam', value: 'spam' },
                      { label: 'Harassment or bullying', value: 'harassment' },
                      { label: 'Inappropriate content', value: 'inappropriate' },
                      { label: 'Other (custom reason)', value: 'other' }
                    ];
                    
                    // For now, cycle through options on tap
                    const currentIndex = reasons.findIndex(r => r.value === blockReason);
                    const nextIndex = (currentIndex + 1) % reasons.length;
                    setBlockReason(reasons[nextIndex].value);
                  }}
                >
                  <Text style={styles.pickerText}>
                    {blockReason === '' ? 'No reason' :
                     blockReason === 'spam' ? 'Spam or scam' :
                     blockReason === 'harassment' ? 'Harassment or bullying' :
                     blockReason === 'inappropriate' ? 'Inappropriate content' :
                     blockReason === 'other' ? 'Other (custom reason)' : 'No reason'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#6b7280" />
                </TouchableOpacity>
              </View>

              {blockReason === 'other' && (
                <View style={styles.textAreaContainer}>
                  <Text style={styles.textAreaLabel}>Add more details (optional):</Text>
                  {/* Note: React Native doesn't have textarea, using TextInput with multiline */}
                  <View style={styles.textAreaWrapper}>
                    <Text style={styles.textAreaPlaceholder}>
                      {blockDetails || 'Add more details (optional)'}
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity 
                style={[styles.blockBtn, isBlocking && styles.blockBtnDisabled]}
                onPress={() => alert('Block functionality will be implemented with proper API calls')}
                disabled={isBlocking}
              >
                <Ionicons name="shield" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.blockBtnText}>
                  {isBlocking ? 'Blocking...' : 'Block User'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>

        {/* Simple Report Modal */}
        {showReportModal && (
          <View style={styles.reportModalOverlay}>
            <View style={styles.reportModal}>
              <Text style={styles.reportModalTitle}>Report User</Text>
              <Text style={styles.reportModalText}>
                VybeLocal is built on trust and real-world respect.{'\n\n'}
                If this user feels unsafe, misleading, or out of alignment with our community values, please let us know.{'\n\n'}
                We review all reports with care, and your voice stays private.
              </Text>
              <View style={styles.reportModalButtons}>
                <TouchableOpacity 
                  style={[styles.reportModalBtn, styles.reportModalBtnCancel]}
                  onPress={() => setShowReportModal(false)}
                >
                  <Text style={styles.reportModalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.reportModalBtn, styles.reportModalBtnSubmit]}
                  onPress={() => {
                    setShowReportModal(false);
                    alert('Report functionality will be implemented with proper API calls');
                  }}
                >
                  <Text style={[styles.reportModalBtnText, { color: '#fff' }]}>Submit Report</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
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
  flagButton: { padding: 8 },
  bioContainer: { marginBottom: 12 },
  bioText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  lastActiveContainer: { marginBottom: 16 },
  lastActiveText: { fontSize: 12, color: '#6b7280' },
  blockSection: { paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  blockSectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12, color: '#374151' },
  pickerContainer: { marginBottom: 12 },
  pickerButton: { 
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
  pickerText: { fontSize: 14, color: '#374151' },
  textAreaContainer: { marginBottom: 12 },
  textAreaLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8, color: '#374151' },
  textAreaWrapper: { 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderWidth: 1, 
    borderColor: '#d1d5db', 
    borderRadius: 8, 
    backgroundColor: '#fff',
    minHeight: 80
  },
  textAreaPlaceholder: { fontSize: 14, color: '#9ca3af' },
  blockBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    backgroundColor: '#fef2f2', 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca'
  },
  blockBtnDisabled: { opacity: 0.5 },
  blockBtnText: { fontSize: 14, fontWeight: '600', color: '#b91c1c' },
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