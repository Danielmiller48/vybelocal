import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, SafeAreaView, Image, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

// ActionRow component for consistent action buttons
function ActionRow({ icon, title, subtitle, onPress, color = '#1f2937', backgroundColor = '#f9fafb' }) {
  return (
    <TouchableOpacity 
      style={[styles.actionRow, { 
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderWidth: 1,
        borderColor: '#BAA4EB',
        shadowColor: '#BAA4EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
      }]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.actionIcon, {
        backgroundColor: 'rgba(186, 164, 235, 0.15)',
        borderWidth: 1,
        borderColor: '#BAA4EB',
      }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.actionContent}>
        <Text style={[styles.actionTitle, { color, fontWeight: '700' }]}>{title}</Text>
        {subtitle && <Text style={[styles.actionSubtitle, { fontWeight: '500' }]}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#BAA4EB" />
    </TouchableOpacity>
  );
}

export default function HostEventActionsSheet({ 
  visible, 
  onClose, 
  event, 
  onOpenChat, 
  onViewRsvps, 
  onEdit, 
  onCancelEvent 
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
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
  }, [visible, pulseAnim]);

  if (!visible || !event) return null;

  const eventDate = new Date(event.starts_at);
  const isUpcoming = eventDate > new Date();
  const hasRsvps = (event.rsvp_count || 0) > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* White to peach gradient background */}
        <LinearGradient
          colors={['#FFFFFF', '#FFE5D9']}
          start={{x:0,y:0}} 
          end={{x:0,y:1}}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Close Button */}
        <Animated.View style={[styles.closeButtonContainer, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
        </Animated.View>
        
        {/* Event Image */}
        <View style={[styles.imageContainer, {
          borderWidth: 2,
          borderColor: '#BAA4EB',
          shadowColor: '#BAA4EB',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }]}>
          {event.imageUrl ? (
            <Image 
              source={{ uri: event.imageUrl }} 
              style={styles.eventImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.eventImage, styles.placeholderImage, {
              backgroundColor: 'rgba(186, 164, 235, 0.1)',
            }]}>
              <Ionicons name="image-outline" size={48} color="#BAA4EB" />
            </View>
          )}
        </View>
        
        {/* Header */}
        <View style={[styles.header, {
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(186, 164, 235, 0.3)',
        }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.eventTitle, { fontWeight: '700' }]} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={[styles.eventDetails, { fontWeight: '500' }]}>
              {format(eventDate, 'EEEE, MMM d • h:mm a')} • {event.vibe}
            </Text>
            <Text style={[styles.eventStats, { fontWeight: '500' }]}>
              {event.rsvp_count || 0} RSVPs • {event.rsvp_capacity || '∞'} capacity • {event.price_in_cents ? `$${(event.price_in_cents/100).toFixed(2)}` : 'Free'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <ActionRow
            icon="chatbubbles"
            title="Event Chat"
            subtitle="Connect with attendees"
            onPress={onOpenChat}
            color="#4f46e5"
            backgroundColor="#eef2ff"
          />

          <ActionRow
            icon="people"
            title="View RSVPs"
            subtitle={`${event.rsvp_count || 0} attendees`}
            onPress={onViewRsvps}
            color="#059669"
            backgroundColor="#ecfdf5"
          />

          {isUpcoming && (
            <ActionRow
              icon="create"
              title="Edit Event"
              subtitle={hasRsvps ? "Cannot edit after RSVPs" : "Update details or settings"}
              onPress={hasRsvps ? undefined : onEdit}
              color={hasRsvps ? "#9ca3af" : "#7c3aed"}
              backgroundColor={hasRsvps ? "#f9fafb" : "#f3e8ff"}
            />
          )}

          <ActionRow
            icon="close-circle"
            title="Cancel Event"
            subtitle={isUpcoming ? "Cancel and notify attendees" : "Remove from history"}
            onPress={onCancelEvent}
            color="#ef4444"
            backgroundColor="#fee2e2"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  imageContainer: {
    width: '95%',
    aspectRatio: 4/3,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: '2.5%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flex: 1,
    marginRight: 16,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  eventDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  eventStats: {
    fontSize: 12,
    color: '#9ca3af',
  },
  closeButton: {
    padding: 4,
  },
  actionsContainer: {
    padding: 20,
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  closeButtonContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  closeButton: {
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
  },
});