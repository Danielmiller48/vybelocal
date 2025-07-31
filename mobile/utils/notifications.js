// Utility functions for managing Supabase notifications
import { supabase } from './supabase';

export const notificationUtils = {
  // Get unread notification counts for the current user
  getUnreadCounts: async (userId) => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_unread_counts', {
          target_user_id: userId
        });

      if (error) {
        console.error('Error getting unread counts:', error);
        return {};
      }

      // Convert array to object for easy lookup: { eventId: count }
      const unreadCounts = {};
      data.forEach(item => {
        if (item.type === 'chat_message' && item.event_id) {
          unreadCounts[item.event_id] = item.count;
        }
      });

      return unreadCounts;
    } catch (error) {
      console.error('Error in getUnreadCounts:', error);
      return {};
    }
  },

  // Get unread count for a specific event (using existing schema)
  getEventUnreadCount: async (userId, eventId) => {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('type', 'chat_message')
        .eq('reference_id', eventId) // Use existing reference_id field
        .eq('reference_table', 'events') // Use existing reference_table field
        .eq('is_dismissed', false) // Use existing is_dismissed field
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()); // Check expiry

      if (error) {
        console.error('Error getting event unread count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getEventUnreadCount:', error);
      return 0;
    }
  },

  // Mark chat notifications as read when user opens chat
  markChatNotificationsRead: async (userId, eventId) => {
    try {
      const { data, error } = await supabase
        .rpc('mark_chat_notifications_read', {
          target_user_id: userId,
          event_id: eventId
        });

      if (error) {
        console.error('Error marking notifications as read:', error);
        return false;
      }

      console.log(`Marked ${data} chat notifications as read for event:`, eventId);
      return true;
    } catch (error) {
      console.error('Error in markChatNotificationsRead:', error);
      return false;
    }
  },

  // Get all unread notifications for the user (for notification center)
  getUserNotifications: async (userId, limit = 50) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          type,
          title,
          message,
          reference_id,
          reference_table,
          batch_count,
          data,
          created_at,
          expires_at
        `)
        .eq('user_id', userId)
        .eq('is_dismissed', false) // Use existing is_dismissed field
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()) // Check expiry
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting user notifications:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserNotifications:', error);
      return [];
    }
  },

  // Subscribe to real-time notification changes
  subscribeToNotifications: (userId, callback) => {
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('Notification change:', payload);
          callback(payload);
        }
      )
      .subscribe();

    return subscription;
  },

  // Unsubscribe from real-time notifications
  unsubscribeFromNotifications: (subscription) => {
    if (subscription) {
      supabase.removeChannel(subscription);
    }
  }
}; 