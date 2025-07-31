import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import Constants from 'expo-constants';
// (Reverted EventEmitter patch)

// Configure how notifications are displayed
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class PushNotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
  }

  async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }
      
      try {
        // Get project ID from the official EAS configuration
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        
        if (projectId) {
          console.log('Using official project ID:', projectId);
          token = (await Notifications.getExpoPushTokenAsync({ 
            projectId: projectId 
          })).data;
        } else {
          console.log('Using development mode (no project ID)');
          token = (await Notifications.getExpoPushTokenAsync()).data;
        }
        
        console.log('Expo Push Token:', token);
      } catch (error) {
        console.error('Error getting push token:', error);
        return null;
      }
    } else {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    this.expoPushToken = token;
    await this.savePushTokenToStorage(token);
    return token;
  }

  // Get current push token for testing
  getCurrentPushToken() {
    return this.expoPushToken;
  }

  // Send test notification to yourself
  async sendTestNotification(customMessage = "Test notification from VybeLocal!") {
    const token = this.getCurrentPushToken();
    if (!token) {
      console.error('No push token available for testing');
      return false;
    }

    try {
      // Call Expo Push API directly (no backend needed)
      const expoPushApiUrl = 'https://exp.host/--/api/v2/push/send';
      
      const notificationData = {
        to: token,
        title: "VybeLocal Test",
        body: `Test: ${customMessage}`,
        data: {
          type: 'test_message',
          timestamp: Date.now()
        },
        sound: 'default',
        priority: 'high',
      };

      const response = await fetch(expoPushApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(notificationData)
      });

      const result = await response.json();
      console.log('Test notification sent:', result);
      return true;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }

  async savePushTokenToStorage(token) {
    try {
      await AsyncStorage.setItem('expoPushToken', token);
      console.log('Push token saved to storage');
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  async savePushTokenToDatabase(userId, token) {
    try {
      // Try UPDATE first
      const { data: updateResult, error: updateError } = await supabase
        .from('user_push_tokens')
        .update({
          push_token: token,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('platform', Platform.OS)
        .select();

      if (updateError) {
        console.error('Error updating push token:', updateError);
        return;
      }

      // If UPDATE affected no rows, INSERT new record
      if (!updateResult || updateResult.length === 0) {
        const { error: insertError } = await supabase
          .from('user_push_tokens')
          .insert({
            user_id: userId,
            push_token: token,
            platform: Platform.OS,
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Error inserting push token:', insertError);
        } else {
          console.log('Push token inserted to database');
        }
      } else {
        console.log('Push token updated in database');
      }
    } catch (error) {
      console.error('Error saving push token to database:', error);
    }
  }

  async getPushTokenFromStorage() {
    try {
      const token = await AsyncStorage.getItem('expoPushToken');
      return token;
    } catch (error) {
      console.error('Error getting push token from storage:', error);
      return null;
    }
  }

  setupNotificationListeners() {
    // Listener for when notification is received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      // (Reverted DB fetch patch – keep simple log)
      // Example: notificationUtils.getEventUnreadCount(data.target_user_id || null, data.eventId)
      // .then(count => {
      //   notifEventBus.emit('unread_update', { eventId: data.eventId, count });
      // })
      // .catch(() => {});
    });

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      
      const data = response.notification.request.content.data;
      if (data?.type === 'chat_message') {
        // Navigate to the specific chat/event
        this.handleChatNotificationTap(data);
      }
    });
  }

  handleChatNotificationTap(data) {
    // You'll implement navigation to the specific event/chat here
    console.log('Navigate to event:', data.eventId);
    // Example: NavigationService.navigate('EventDetail', { eventId: data.eventId });
  }

  removeNotificationListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  async scheduleLocalNotification(title, body, data = {}) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: { seconds: 1 },
    });
  }
}

export default new PushNotificationService(); 