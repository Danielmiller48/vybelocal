// Utility functions for managing Supabase notifications
import { supabase } from './supabase';

// Lightweight in-app event bus (avoids Node "events" package)
export const notifBus = {
  _events: {},
  on(evt, fn) {
    this._events[evt] = (this._events[evt] || []).concat(fn);
  },
  off(evt, fn) {
    this._events[evt] = (this._events[evt] || []).filter(f => f !== fn);
  },
  emit(evt, data) {
    (this._events[evt] || []).forEach(f => {
      try { f(data); } catch {}
    });
  }
};

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
      const { data, error } = await supabase
        .from('notifications')
        .select('batch_count')
        .eq('user_id', userId)
        .eq('type', 'chat_message')
        .eq('reference_id', eventId) // Use existing reference_id field
        .eq('reference_table', 'events') // Use existing reference_table field
        .eq('is_hidden', false) // Only count visible (not soft-hidden) notifications
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()) // Check expiry
        .limit(1);

      if (error) {
        console.error('Error getting event unread count:', error);
        return 0;
      }

      if (!data || data.length === 0) return 0;

      return data[0].batch_count || 0;
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
        .eq('is_hidden', false) // Only fetch visible notifications (not soft-hidden)
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
    const channelName = `notif_${userId}_${Date.now()}`;
    console.log('🔔 CREATING CHANNEL:', channelName);
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          // Broadcast to in-app listeners
          try {
            console.log('⏩ RAW PAYLOAD', JSON.stringify(payload));
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newRow = payload.new || {};
              notifBus.emit('chat_unread', {
                eventId: newRow.reference_id,
                count: newRow.batch_count
              });
            } else if (payload.eventType === 'DELETE') {
              const oldRow = payload.old || {};
              notifBus.emit('chat_unread', {
                eventId: oldRow.reference_id,
                count: 0
              });
            }
          } catch {}

          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('🔔 CHANNEL STATUS:', status);
      });

    return subscription;
  },

  // Unsubscribe from real-time notifications
  unsubscribeFromNotifications: (subscription) => {
    if (subscription?.unsubscribe) {
      subscription.unsubscribe();
    } else if (subscription) {
      supabase.removeChannel(subscription);
    }
  }
}; 