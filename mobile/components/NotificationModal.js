import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Modal, 
  Pressable,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { notificationUtils } from '../utils/notifications';
import { supabase } from '../utils/supabase';

export default function NotificationModal({ visible, onClose }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible || !user?.id) return;
    
    loadNotifications();
  }, [visible, user?.id]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationUtils.getUserNotifications(user.id, 50);
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      // Delete from Supabase
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  const clearAllNotifications = async () => {
    if (notifications.length === 0) return;

    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user.id);

              if (error) throw error;

              setNotifications([]);
            } catch (error) {
              console.error('Error clearing notifications:', error);
              Alert.alert('Error', 'Failed to clear notifications');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const unreadCount = notifications.filter(n => !n.is_dismissed).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          backgroundColor: '#f9fafb'
        }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>
            Notifications {unreadCount > 0 && `(${unreadCount})`}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={clearAllNotifications}>
                <Text style={{ fontSize: 14, color: '#dc2626', fontWeight: '500' }}>
                  Clear All
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={{ marginTop: 12, color: '#6b7280' }}>Loading notifications...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
            <Ionicons name="notifications-outline" size={64} color="#d1d5db" />
            <Text style={{ fontSize: 18, fontWeight: '500', color: '#6b7280', marginTop: 16 }}>
              No notifications
            </Text>
            <Text style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
              When you have new activity, notifications will appear here
            </Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }}>
            {notifications.map((notification, index) => (
              <View
                key={notification.id}
                style={{
                  flexDirection: 'row',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderBottomWidth: index < notifications.length - 1 ? 1 : 0,
                  borderBottomColor: '#f3f4f6',
                  backgroundColor: notification.is_dismissed ? '#fff' : '#f0f9ff'
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ 
                    fontSize: 16, 
                    fontWeight: notification.is_dismissed ? '400' : '600',
                    color: '#111827',
                    marginBottom: 4 
                  }}>
                    {notification.title}
                  </Text>
                  <Text style={{ 
                    fontSize: 14, 
                    color: '#4b5563',
                    lineHeight: 20,
                    marginBottom: 8
                  }}>
                    {notification.message}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#9ca3af' }}>
                    {formatDate(notification.created_at)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => deleteNotification(notification.id)}
                  style={{
                    padding: 8,
                    alignSelf: 'flex-start'
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={16} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
} 