import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { useAuth } from '../auth/AuthProvider';

export default function ConfirmCancelModal({ visible, event, onConfirm, onClose }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState('');
  const [fetchingPreview, setFetchingPreview] = useState(false);

  // Fetch cancellation preview when modal opens
  useEffect(() => {
    if (!visible || !event?.id) {
      setPreview(null);
      setReason('');
      return;
    }

    const fetchPreview = async () => {
      setFetchingPreview(true);
      try {
        // Get event details and RSVP count directly from Supabase
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select(`
            *,
            rsvps(user_id, paid)
          `)
          .eq('id', event.id)
          .single();

        if (eventError) throw eventError;

        // Get host's cancellation history for strike count
        const { data: strikeData } = await supabase
          .from('v_host_strikes_last6mo')
          .select('strike_count')
          .eq('host_id', user.id)
          .maybeSingle();

        const currentStrikes = strikeData?.strike_count || 0;
        const isPaidEvent = eventData.price_in_cents && eventData.price_in_cents > 0;
        const rsvpCount = eventData.rsvps?.length || 0;
        const hasAttendees = rsvpCount > 0;
        
        // Check if cancellation is within 24 hours
        const eventStart = new Date(eventData.starts_at);
        const now = new Date();
        const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);
        const shortNotice = hoursUntilEvent < 24;

        // Business logic for strikes and fees
        const willCreateStrike = hasAttendees;
        const willChargeHost = isPaidEvent && currentStrikes >= 1 && hasAttendees;
        
        // Calculate potential fees (simplified for mobile)
        const stripeFeePer = isPaidEvent ? Math.round(eventData.price_in_cents * 0.029 + 30) : 0;
        const totalFees = willChargeHost ? stripeFeePer * rsvpCount : 0;

        setPreview({
          isPaidEvent,
          hasAttendees,
          rsvpCount,
          shortNotice,
          willCreateStrike,
          willChargeHost,
          totalFees,
          currentStrikes,
          eventData
        });
      } catch (error) {
        console.error('Error calculating cancellation preview:', error);
        Alert.alert('Error', 'Failed to load cancellation details');
        onClose();
      } finally {
        setFetchingPreview(false);
      }
    };

    fetchPreview();
  }, [visible, event?.id, onClose]);

  const handleConfirm = async () => {
    if (!preview) return;
    
    setLoading(true);
    try {
      // Note: For mobile, we're simplifying the payment flow
      // Penalty payments would need Stripe integration which can be added later
      if (preview.willChargeHost) {
        Alert.alert(
          'Payment Required', 
          `This cancellation requires a $${(preview.totalFees / 100).toFixed(2)} fee. Payment integration coming soon - please contact support.`,
          [{ text: 'OK', onPress: () => setLoading(false) }]
        );
        return;
      }

      // Update event status to cancelled directly in Supabase
      const { error: updateError } = await supabase
        .from('events')
        .update({ 
          status: 'cancelled',
          canceled_at: new Date().toISOString(),
          cancel_reason: reason || null
        })
        .eq('id', event.id);

      if (updateError) throw updateError;

      // Add strike record if there are attendees
      if (preview.willCreateStrike) {
        const { error: strikeError } = await supabase
          .from('host_strikes')
          .insert({
            host_id: user.id,
            event_id: event.id,
            strike_type: 'guest_attended_cancellation',
            created_at: new Date().toISOString()
          });

        if (strikeError) {
          console.warn('Failed to record strike:', strikeError);
          // Don't fail the whole operation for strike recording
        }
      }

      // For mobile simplification, we'll skip complex refund processing
      // This would need payment integration for real refunds
      
      let successMessage = 'Event canceled successfully';
      if (preview.rsvpCount > 0) {
        successMessage += ` • ${preview.rsvpCount} attendees will be notified`;
      }
      if (preview.willCreateStrike) {
        successMessage += ' • Strike recorded due to having attendees';
      }
      
      Alert.alert('Success', successMessage);
      onConfirm({ success: true, eventId: event.id });
      
    } catch (error) {
      console.error('Error canceling event:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      onClose();
    }
  };

  if (!visible) return null;

  // Loading state while fetching preview
  if (fetchingPreview || !preview) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ActivityIndicator size="large" color="#ef4444" />
            <Text style={styles.loadingText}>Loading cancellation details...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Calculate display values
  const isFree = preview.refundTotalCents === 0;
  const paidEvent = preview.isPaidEvent;
  const refundTotal = (preview.refundTotalCents / 100).toFixed(2);
  const penaltyCents = preview.penaltyCents;
  
  // Calculate charge amount including credit card processing fees
  const CC_RATE = 0.029;
  const CC_FIXED = 30; // cents
  const totalChargeCents = preview.willChargeHost
    ? Math.ceil((penaltyCents + CC_FIXED) / (1 - CC_RATE))
    : 0;
  const extraFeeCents = preview.willChargeHost ? totalChargeCents - penaltyCents : 0;
  const penalty = (penaltyCents / 100).toFixed(2);
  const extraFee = (extraFeeCents / 100).toFixed(2);
  const totalCharge = (totalChargeCents / 100).toFixed(2);

  // Generate header text
  let header;
  if (!paidEvent) {
    header = 'Cancel this event?';
  } else {
    header = preview.willChargeHost
      ? `Cancel this event, refund $${refundTotal} to your guests, and pay $${totalCharge}?`
      : `Cancel this event and refund $${refundTotal} to your guests?`;
  }

  // Generate body text based on strike number and event type
  let body;

  if (!paidEvent) {
    // ─────────────── FREE EVENT CANCELLATIONS ───────────────
    if (preview.strikeNum >= 3) {
      /* THIRD strike – 60-day suspension */
      body = `This was your third cancellation—and at VybeLocal, three strikes means it's time to pause.\n\nWe built this platform to support people who follow through. Flaky hosting breaks trust for guests, damages the local ecosystem, and hurts everyone who shows up.\n\nBecause of this:\n\n• Your ability to host new events is suspended for 60 days\n• You'll still be able to RSVP to events, but hosting is locked\n\nIf you believe this was a mistake or want to appeal, reach out to support@vybelocal.com\n\nWe still believe in second chances—but accountability always comes first here.\n\nThanks for respecting the platform.`;
    } else if (preview.strikeNum === 2) {
      /* SECOND strike – 14-day lock */
      const unlockDate = (() => {
        const days = preview.lockDays || 14;
        const dt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      })();

      body = `This is your second event cancellation.\n\nWe understand that sometimes life happens—but too many cancellations (even for free events) make it harder for guests to trust the platform and show up again.\n\nAs part of VybeLocal's trust-first model:\n\n• Your hosting privileges are now paused for 14 days\n• You'll be able to post events again on ${unlockDate}\n• Your past events and history remain visible\n\nWe're not here to punish—we're here to protect the people who commit. Let this window serve as a reset. When you come back, you'll be in a better spot to build real traction.\n\nThanks for understanding.`;
    } else {
      /* FIRST strike – warning */
      body = `Canceling an event—paid or free—affects guest trust.\n\nVybeLocal is built around showing up, and we track all cancellations to protect the community experience. Even free events matter. Too many cancellations can result in a temporary suspension from hosting.\n\nHere's how our cancellation system works:\n\n1️⃣ Your first cancellation is a free pass—we get it.\n2️⃣ After your second, hosting will be paused for 2 weeks.\n3️⃣ A third cancellation leads to a 2-month suspension and a reactivation fee.\n\nIf you're canceling due to weather or an emergency, be honest—we'll review same-day cancellations before applying a strike.\n\nAre you sure you want to cancel this event?`;
    }
  } else {
    // ─────────────── PAID EVENT CANCELLATIONS ───────────────
    if (preview.strikeNum >= 3) {
      body = `If you cancel this event, hosting will be suspended for 2 months.\nVybeLocal is built on trust—and after 3 canceled events, that trust takes a hit.\nYou'll need to wait 2 months and cover the Stripe fees for your canceled event before you can host again.`;
    } else if (preview.strikeNum === 2) {
      body = `We'll issue refunds and notify your guests right away.\nSince this isn't your first cancellation after RSVPs, you'll be charged $${penalty} to cover the original Stripe refund fees plus an additional $${extraFee} processing fee (Stripe's 2.9% + 30¢) when paying that amount, for a total of $${totalCharge}.\nIn addition, your hosting privileges are paused for two weeks.`;
    } else {
      body = `We'll handle the refunds and let your guests know the event's off.\nYou're covered — no platform penalty this time.\n\nBut heads up:\nCanceling future events after guests RSVP will pass refund costs back to you — in this case, that would've been $${penalty} in Stripe fees.`;
    }
  }

  // Generate button text
  const buttonText = loading
    ? 'Processing...'
    : isFree
    ? 'Yes, cancel'
    : (paidEvent && preview.willChargeHost ? `Pay $${totalCharge} & cancel` : 'Got it');

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* White to peach gradient background */}
          <LinearGradient
            colors={['#FFFFFF', '#FFE5D9']}
            start={{x:0,y:0}} 
            end={{x:0,y:1}}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Header */}
          <View style={[styles.header, {
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(186, 164, 235, 0.3)',
            paddingBottom: 16,
            marginBottom: 16,
            zIndex: 2,
          }]}>
            <View style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderRadius: 20,
              padding: 8,
              borderWidth: 1,
              borderColor: '#ef4444',
            }}>
              <Ionicons name="warning" size={24} color="#ef4444" />
            </View>
            <Text style={[styles.title, { fontWeight: '700' }]}>{header}</Text>
          </View>

          {/* Body */}
          <Text style={[styles.body, { fontWeight: '500', zIndex: 2 }]}>{body}</Text>

          {/* Short-notice cancellation reason input */}
          {preview.shortNotice && (
            <View style={[styles.reasonSection, { zIndex: 2 }]}>
              <Text style={[styles.reasonLabel, { fontWeight: '600' }]}>
                Life happens. If this was out of your control, let us know.
              </Text>
              <TextInput
                style={[styles.reasonInput, {
                  borderColor: '#BAA4EB',
                  borderWidth: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  shadowColor: '#BAA4EB',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3,
                }]}
                placeholder="Optional: share what happened (guests won't see this)"
                value={reason}
                onChangeText={setReason}
                maxLength={300}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          )}

          {/* Buttons */}
          <View style={[styles.buttonContainer, { zIndex: 2 }]}>
            <TouchableOpacity 
              style={[styles.secondaryButton, {
                borderColor: '#BAA4EB',
                borderWidth: 2,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                shadowColor: '#BAA4EB',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 3,
              }]} 
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryButtonText, { fontWeight: '600' }]}>Keep event</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.destructiveButton, {
                shadowColor: '#ef4444',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }, loading && styles.disabledButton]} 
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading && <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />}
              <Text style={[styles.destructiveButtonText, { fontWeight: '700' }]}>{buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 12,
    flex: 1,
  },
  body: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 24,
  },
  reasonSection: {
    marginBottom: 24,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#374151',
    minHeight: 80,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  destructiveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  destructiveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  disabledButton: {
    opacity: 0.7,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});