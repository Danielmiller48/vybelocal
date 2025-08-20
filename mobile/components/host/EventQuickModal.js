import React from 'react';
import { View, Text, Modal, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function EventQuickModal({ visible, event, onClose, onCancel }){
  if (!visible || !event) return null;
  const openChat = () => {
    // assuming web chat route; replace with native navigation if available
    if (event?.id) Linking.openURL(`${(Constants?.expoConfig?.extra?.apiBaseUrl || 'https://vybelocal.com')}/events/${event.id}/chat`);
  };
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center', padding:16 }}>
        <View style={{ width:'100%', maxWidth:420, backgroundColor:'white', borderRadius:12, padding:16 }}>
          <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
            <Text style={{ flex:1, fontSize:16, fontWeight:'700', color:'#111827' }}>{event.title || 'Event'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize:12, color:'#6b7280', marginBottom:12 }}>
            {new Date(event.starts_at).toLocaleString()} • {event.vibe || '—'}
          </Text>

          <View style={{ gap:8 }}>
            <TouchableOpacity onPress={openChat} style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#eef2ff', padding:12, borderRadius:10 }}>
              <Ionicons name="chatbubbles" size={18} color="#4f46e5" style={{ marginRight:8 }} />
              <Text style={{ fontWeight:'600', color:'#1f2937' }}>Open Event Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={()=>onCancel?.(event)} style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#fee2e2', padding:12, borderRadius:10 }}>
              <Ionicons name="close-circle" size={18} color="#ef4444" style={{ marginRight:8 }} />
              <Text style={{ fontWeight:'600', color:'#991b1b' }}>Cancel Event</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop:12 }}>
            <Text style={{ fontSize:12, color:'#6b7280' }}>
              Capacity: {event.rsvp_capacity ?? '—'} • RSVPs: {event.rsvp_count ?? '—'} • Price: {event.price_in_cents ? `$${(event.price_in_cents/100).toFixed(2)}` : 'Free'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}