import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

// ActionRow component for consistent action buttons
function ActionRow({ icon, title, subtitle, onPress, color = '#1f2937', backgroundColor = '#f9fafb' }) {
  return (
    <TouchableOpacity style={[styles.actionRow, { backgroundColor }]} onPress={onPress}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.actionContent}>
        <Text style={[styles.actionTitle, { color }]}>{title}</Text>
        {subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
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
  if (!visible || !event) return null;

  const eventDate = new Date(event.starts_at);
  const isUpcoming = eventDate > new Date();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={styles.eventDetails}>
              {format(eventDate, 'EEEE, MMM d • h:mm a')} • {event.vibe}
            </Text>
            <Text style={styles.eventStats}>
              {event.rsvp_count || 0} RSVPs • {event.rsvp_capacity || '∞'} capacity • {event.price_in_cents ? `$${(event.price_in_cents/100).toFixed(2)}` : 'Free'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
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
              subtitle="Update details or settings"
              onPress={onEdit}
              color="#7c3aed"
              backgroundColor="#f3e8ff"
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
    backgroundColor: '#ffffff',
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
});