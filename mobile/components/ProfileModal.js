import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Animated, Dimensions, Easing } from 'react-native';
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

export default function ProfileModal({ visible, onClose, profile, stats = {} }) {
  const screenH = Dimensions.get('window').height;
  const slideAnim = React.useRef(new Animated.Value(screenH)).current;

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
                <Text style={styles.statLine}>{stats.completed ?? 0} completed • {stats.cancels ?? 0} cancels</Text>
              </View>
              <Text style={styles.hostLabel}>Host</Text>
            </View>

            {/* Actions */}
            <View style={{ marginTop: 20 }}>
              <TouchableOpacity style={styles.reportBtn} onPress={() => alert('Report feature coming soon')}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Report User</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.reportBtn, { backgroundColor: '#ccc', marginTop: 8 }]} onPress={() => alert('Block feature coming soon')}>
                <Text style={{ color: '#333', fontWeight: '600' }}>Block User</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
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
  profileRow: { flexDirection:'row', alignItems:'center' },
  avatar: { width:64, height:64, borderRadius:32, marginRight:12 },
  name: { fontSize:16, fontWeight:'600' },
  pronouns: { fontSize:12, color:'#666' },
  statLine: { fontSize:12, color:'#444' },
  hostLabel: { fontSize:12, color:'#e11d48', fontWeight:'700' },
  reportBtn: { backgroundColor:'#e11d48', paddingVertical:10, borderRadius:8, alignItems:'center' },
}); 