import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ConfirmCancelModal({ visible, event, onConfirm, onClose }) {
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
        const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://www.vybelocal.com';
        const response = await fetch(`${baseUrl}/api/events/${event.id}/cancel`, {
          method: 'GET',
          credentials: 'include',
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load cancellation details');
        }
        
        const data = await response.json();
        setPreview(data);
      } catch (error) {
        console.error('Error fetching cancellation preview:', error);
        Alert.alert('Error', error.message);
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
      // 1️⃣ If penalty payment required, handle card charge first
      if (preview.isPaidEvent && preview.willChargeHost) {
        const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://www.vybelocal.com';
        const payResponse = await fetch(`${baseUrl}/api/events/${event.id}/penalty-intent`, { 
          method: 'POST' 
        });
        const payData = await payResponse.json();
        
        if (!payResponse.ok || payData.status !== 'succeeded') {
          throw new Error(payData.error || 'Penalty payment failed');
        }
      }

      // 2️⃣ Proceed with actual cancellation
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://www.vybelocal.com';
      const response = await fetch(`${baseUrl}/api/events/${event.id}/cancel`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason_text: reason || null }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel event');
      }

      const result = await response.json();
      
      // Show success message
      const refundAmount = (result.refundTotalCents / 100).toFixed(2);
      const penaltyAmount = (result.penaltyCents / 100).toFixed(2);
      
      let successMessage = 'Event canceled successfully';
      if (result.refundTotalCents > 0) {
        successMessage += ` and $${refundAmount} refunded`;
      }
      if (result.penaltyCents > 0) {
        successMessage += ` • $${penaltyAmount} fee covered`;
      }
      
      Alert.alert('Success', successMessage);
      onConfirm(result);
      
    } catch (error) {
      console.error('Error canceling event:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
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
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="warning" size={24} color="#ef4444" />
            <Text style={styles.title}>{header}</Text>
          </View>

          {/* Body */}
          <Text style={styles.body}>{body}</Text>

          {/* Short-notice cancellation reason input */}
          {preview.shortNotice && (
            <View style={styles.reasonSection}>
              <Text style={styles.reasonLabel}>
                Life happens. If this was out of your control, let us know.
              </Text>
              <TextInput
                style={styles.reasonInput}
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
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Keep event</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.destructiveButton, loading && styles.disabledButton]} 
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading && <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />}
              <Text style={styles.destructiveButtonText}>{buttonText}</Text>
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