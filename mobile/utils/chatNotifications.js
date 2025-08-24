// Chat notification utilities for sending push notifications
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const chatNotifications = {
  // Send push notification for new chat message with smart replacement
  sendChatNotification: async (eventId, eventTitle, senderName, messageText, senderId) => {
    try {
      // Get all users who are part of this event (RSVP'd users)
      const { data: rsvps, error: rsvpError } = await supabase
        .from('rsvps')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('status', 'going');

      if (rsvpError) {
        return false;
      }

      // Get user IDs excluding the sender
      const userIds = rsvps
        .map(rsvp => rsvp.user_id)
        .filter(userId => userId !== senderId);

      if (userIds.length === 0) {
        return false;
      }

      // Get current message counts for this event for all users
      const messageCounts = await chatNotifications.getEventMessageCounts(eventId, userIds);
      
      // Increment counts and determine notification content
      const notifications = await Promise.all(userIds.map(async (userId) => {
        const currentCount = messageCounts[userId] || 0;
        const newCount = currentCount + 1;
        
        // Save updated count
        await chatNotifications.updateEventMessageCount(eventId, userId, newCount);
        
        // Determine notification content
        const isFirstMessage = newCount === 1;
        const notificationBody = isFirstMessage 
          ? `${senderName}: ${chatNotifications.truncateMessage(messageText)}`
          : `${newCount} new messages`;
          
        return {
          userId,
          isFirstMessage,
          count: newCount,
          body: notificationBody
        };
      }));

      // Call backend API to send notifications with replacement logic
      const notificationData = {
        userIds,
        eventId,
        eventTitle,
        notifications,
        senderName,
        data: {
          type: 'chat_message',
          eventId,
          eventTitle,
          senderId,
          senderName
        }
      };

      // Get the base URL for your backend API
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://www.vybelocal.com';
      
      const response = await fetch(`${baseUrl}/api/notifications/send-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationData)
      });

      if (!response.ok) {
        await response.json().catch(() => null);
        return false;
      }

      const result = await response.json();
      return true;

    } catch (error) {
      return false;
    }
  },

  // Get current message counts for an event for specific users
  getEventMessageCounts: async (eventId, userIds) => {
    try {
      const counts = {};
      for (const userId of userIds) {
        const key = `chat_count_${eventId}_${userId}`;
        const count = await AsyncStorage.getItem(key);
        counts[userId] = count ? parseInt(count, 10) : 0;
      }
      return counts;
    } catch (error) {
      return {};
    }
  },

  // Update message count for a specific user and event
  updateEventMessageCount: async (eventId, userId, count) => {
    try {
      const key = `chat_count_${eventId}_${userId}`;
      await AsyncStorage.setItem(key, count.toString());
    } catch (error) {
      // quiet error
    }
  },

  // Reset message counts when user opens chat (call this from EventChatModal)
  resetEventMessageCount: async (eventId, userId) => {
    try {
      const key = `chat_count_${eventId}_${userId}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      // quiet error
    }
  },

  // Truncate message text for notification
  truncateMessage: (text, maxLength = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }
};

export default chatNotifications; 