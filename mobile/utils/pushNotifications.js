import * as Notifications from 'expo-notifications';
import { Share } from 'react-native';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import Constants from 'expo-constants';
// (Reverted EventEmitter patch)

// Configure how notifications are displayed
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Always show notifications, even when app is in foreground
    console.log('📱 Handling notification in foreground:', notification.request.content.title);
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
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
      // Create notification channels for different types
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        showBadge: true,
      });
      
      await Notifications.setNotificationChannelAsync('chat', {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        showBadge: true,
        sound: 'default',
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
      if (this._savedOnce) return; // debounce once per session
      const { data: sessionData } = await supabase.auth.getSession();
      const access = sessionData?.session?.access_token;
      if (!access) return;
      const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || process.env?.EXPO_PUBLIC_API_BASE_URL || 'https://vybelocal.com';
      const controller = new AbortController();
      const to = setTimeout(()=>controller.abort(), 10000);
      const resp = await fetch(`${API_BASE_URL}/api/push-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
        body: JSON.stringify({ push_token: token, platform: Platform.OS }),
        signal: controller.signal,
      });
      clearTimeout(to);
      if (!resp.ok) {
        console.error('Error saving push token via API');
        return;
      }
      console.log('Push token saved via API');
      this._savedOnce = true;
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
      console.log('📩 Notification received in foreground:', {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data,
        shouldShow: true
      });
      
      // For chat messages, we could show an in-app banner or update chat UI
      const data = notification.request.content.data;
      if (data?.type === 'chat_message') {
        console.log('💬 Chat notification received while app is open');
        // Could emit an event here to update chat UI or show in-app notification
      }
    });

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', {
        title: response.notification.request.content.title,
        data: response.notification.request.content.data
      });
      
      const data = response.notification.request.content.data;
      if (data?.type === 'chat_message') {
        // Navigate to the specific chat/event
        this.handleChatNotificationTap(data);
      } else if (data?.type === 'share_event') {
        try {
          const url = data?.url || '';
          const title = data?.title || 'VybeLocal';
          const message = data?.shareText || `Join my event on VybeLocal! ${url}`;
          Share.share({ message, title });
        } catch (e) {
          console.warn('Share from notification failed:', e);
        }
      }
    });
  }

  handleChatNotificationTap(data) {
    // You'll implement navigation to the specific event/chat here
    console.log('Navigate to event:', data.eventId);
    // Example: NavigationService.navigate('EventDetail', { eventId: data.eventId });
  }

  removeNotificationListeners() {
    if (this.notificationListener && typeof this.notificationListener.remove === 'function') {
      this.notificationListener.remove();
    }
    if (this.responseListener && typeof this.responseListener.remove === 'function') {
      this.responseListener.remove();
    }
    this.notificationListener = null;
    this.responseListener = null;
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