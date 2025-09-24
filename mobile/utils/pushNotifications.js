import * as Notifications from 'expo-notifications';
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
        return null;
      }
      
      try {
        // Get project ID from the official EAS configuration
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        
        if (projectId) {
          token = (await Notifications.getExpoPushTokenAsync({ 
            projectId: projectId 
          })).data;
        } else {
          token = (await Notifications.getExpoPushTokenAsync()).data;
        }
      } catch (error) {
        return null;
      }
    } else {
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
      return true;
    } catch (error) {
      return false;
    }
  }

  async savePushTokenToStorage(token) {
    try {
      await AsyncStorage.setItem('expoPushToken', token);
    } catch (error) {
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
        }
      } else {
      }
    } catch (error) {
    }
  }

  async getPushTokenFromStorage() {
    try {
      const token = await AsyncStorage.getItem('expoPushToken');
      return token;
    } catch (error) {
      return null;
    }
  }

  setupNotificationListeners() {
    // Listener for when notification is received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data || {};
      try {
        if (data.type === 'bank_created') {
          // Send a simple event the app can listen to
          globalThis.__vybe_push_event__ = { type: 'bank_created', accountId: data.accountId, bankAccountId: data.bankAccountId, ts: Date.now() };
        }
      } catch {}
    });

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data || {};
      try {
        if (data.type === 'bank_created') {
          globalThis.__vybe_push_event__ = { type: 'bank_created', accountId: data.accountId, bankAccountId: data.bankAccountId, ts: Date.now() };
        }
      } catch {}
    });
  }

  handleChatNotificationTap(data) {
    // You'll implement navigation to the specific event/chat here
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