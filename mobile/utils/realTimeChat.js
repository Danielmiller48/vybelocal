import AsyncStorage from '@react-native-async-storage/async-storage';

class RealTimeChatManager {
  constructor() {
    this.connections = new Map(); // eventId -> connection info
    this.messageCallbacks = new Map(); // eventId -> callback function
    this.unreadCallbacks = new Map(); // eventId -> unread count callback
    this.baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://vybelocal.com';
    this.isActive = true;
  }

  /**
   * 🔥 REAL-TIME MESSAGE SUBSCRIPTION
   * Completely replaces the old polling bullshit
   */
  async subscribeToEvent(eventId, userId, onMessageReceived, onUnreadCountChanged) {
    if (this.connections.has(eventId)) {
      console.log('🔌 Already connected to event:', eventId);
      return;
    }

    console.log('🔥 STARTING REAL-TIME CONNECTION for event:', eventId);

    // Store callbacks
    this.messageCallbacks.set(eventId, onMessageReceived);
    if (onUnreadCountChanged) {
      this.unreadCallbacks.set(eventId, onUnreadCountChanged);
    }

    // Subscribe to backend
    const subscribeResponse = await fetch(`${this.baseUrl}/api/chat/realtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        userId,
        action: 'subscribe',
        lastTimestamp: Date.now()
      })
    });

    if (!subscribeResponse.ok) {
      throw new Error(`Subscription failed: ${subscribeResponse.status}`);
    }

    const { pollUrl } = await subscribeResponse.json();
    
    // Store connection info
    const connection = {
      eventId,
      userId,
      isActive: true,
      lastTimestamp: Date.now(),
      pollUrl
    };
    
    this.connections.set(eventId, connection);

    // Start real-time polling loop
    this.startRealTimeLoop(eventId, connection);

    console.log('🔥 REAL-TIME CONNECTION ESTABLISHED for event:', eventId);
  }

  /**
   * 🔥 REAL-TIME POLLING LOOP
   * This is NOT the old shitty polling - this is efficient long-polling
   * The server holds the connection for 30 seconds and only responds when there are new messages
   */
  async startRealTimeLoop(eventId, connection) {
    while (connection.isActive && this.isActive && this.connections.has(eventId)) {
      try {
        console.log('🔄 Starting long-poll for event:', eventId, 'since:', connection.lastTimestamp);

        const response = await fetch(
          `${this.baseUrl}/api/chat/realtime?eventId=${eventId}&userId=${connection.userId}&lastTimestamp=${connection.lastTimestamp}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          }
        );

        if (!response.ok) {
          console.error('❌ Real-time connection error:', response.status);
          await this.delay(5000); // Wait 5 seconds before retry
          continue;
        }

        const data = await response.json();
        
        if (data.type === 'messages' && data.messages && data.messages.length > 0) {
          console.log('🔥 RECEIVED REAL-TIME MESSAGES:', data.messages.length);
          
          // Update last timestamp
          const latestMessage = data.messages[data.messages.length - 1];
          connection.lastTimestamp = latestMessage.timestamp + 1;
          
          // Call message callback
          const messageCallback = this.messageCallbacks.get(eventId);
          if (messageCallback) {
            messageCallback(data.messages);
          }

          // Update unread count for each message
          for (const message of data.messages) {
            await this.incrementUnreadCount(eventId, message.userId, connection.userId);
          }
          
        } else if (data.type === 'heartbeat') {
          console.log('💓 Heartbeat for event:', eventId);
          // Just keep the connection alive
        }

      } catch (error) {
        console.error('❌ Real-time loop error for event:', eventId, error.message);
        
        if (connection.isActive && this.connections.has(eventId)) {
          console.log('🔄 Retrying connection in 5 seconds...');
          await this.delay(5000);
        }
      }
    }

    console.log('🔌 Real-time loop ended for event:', eventId);
  }

  /**
   * 🔥 SEND MESSAGE - REAL-TIME
   */
  async sendMessage(eventId, userId, userName, eventTitle, messageText) {
    console.log('🔥 SENDING REAL-TIME MESSAGE to event:', eventId);

    const response = await fetch(`${this.baseUrl}/api/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        eventTitle,
        message: { text: messageText },
        userId,
        userName
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send message');
    }

    const result = await response.json();
    console.log('🔥 MESSAGE SENT SUCCESSFULLY:', result);
    
    return result;
  }

  /**
   * 🔥 GET INITIAL MESSAGES
   * Load existing messages when opening chat
   */
  async getInitialMessages(eventId) {
    console.log('🔥 LOADING INITIAL MESSAGES for event:', eventId);

    const response = await fetch(`${this.baseUrl}/api/chat/messages?eventId=${eventId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to load messages: ${response.status}`);
    }

    const { messages } = await response.json();
    console.log('🔥 LOADED', messages.length, 'INITIAL MESSAGES');
    
    return messages || [];
  }

  /**
   * 🔥 UNSUBSCRIBE FROM EVENT
   */
  async unsubscribeFromEvent(eventId, userId) {
    const connection = this.connections.get(eventId);
    
    if (!connection) {
      console.log('ℹ️ No active connection for event:', eventId);
      return;
    }

    console.log('🔥 DISCONNECTING from event:', eventId);

    // Stop the connection
    connection.isActive = false;
    this.connections.delete(eventId);
    this.messageCallbacks.delete(eventId);
    this.unreadCallbacks.delete(eventId);

    // Notify backend
    try {
      await fetch(`${this.baseUrl}/api/chat/realtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          userId,
          action: 'unsubscribe'
        })
      });
    } catch (error) {
      console.error('❌ Failed to notify backend of unsubscribe:', error);
    }

    console.log('🔥 DISCONNECTED from event:', eventId);
  }

  /**
   * 📊 UNREAD COUNT MANAGEMENT
   */
  async incrementUnreadCount(eventId, fromUserId, currentUserId) {
    // Don't increment for our own messages
    if (fromUserId === currentUserId) {
      return;
    }

    try {
      const key = `chat_unread_${eventId}_${currentUserId}`;
      const current = await AsyncStorage.getItem(key);
      const count = parseInt(current || '0') + 1;
      
      await AsyncStorage.setItem(key, count.toString());
      console.log('📊 Incremented unread count for event:', eventId, 'to:', count);
      
      // Notify callback
      const callback = this.unreadCallbacks.get(eventId);
      if (callback) {
        callback(count);
      }
      
      return count;
    } catch (error) {
      console.error('❌ Failed to increment unread count:', error);
      return 0;
    }
  }

  async resetUnreadCount(eventId, userId) {
    try {
      const key = `chat_unread_${eventId}_${userId}`;
      await AsyncStorage.setItem(key, '0');
      console.log('📊 Reset unread count for event:', eventId);
      
      // Notify callback
      const callback = this.unreadCallbacks.get(eventId);
      if (callback) {
        callback(0);
      }
    } catch (error) {
      console.error('❌ Failed to reset unread count:', error);
    }
  }

  async getUnreadCount(eventId, userId) {
    try {
      const key = `chat_unread_${eventId}_${userId}`;
      const count = await AsyncStorage.getItem(key);
      return parseInt(count || '0');
    } catch (error) {
      console.error('❌ Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * 🧹 CLEANUP ALL CONNECTIONS
   */
  async cleanup() {
    console.log('🔥 CLEANING UP ALL REAL-TIME CONNECTIONS');
    
    this.isActive = false;
    
    for (const [eventId, connection] of this.connections) {
      connection.isActive = false;
      try {
        await this.unsubscribeFromEvent(eventId, connection.userId);
      } catch (error) {
        console.error('❌ Failed to cleanup connection for event:', eventId, error);
      }
    }
    
    this.connections.clear();
    this.messageCallbacks.clear();
    this.unreadCallbacks.clear();
  }

  /**
   * 🎯 HELPER METHODS
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isConnectedToEvent(eventId) {
    return this.connections.has(eventId);
  }

  getActiveConnections() {
    return Array.from(this.connections.keys());
  }

  pause() {
    console.log('⏸️ PAUSING real-time chat connections');
    this.isActive = false;
  }

  resume() {
    console.log('▶️ RESUMING real-time chat connections');
    this.isActive = true;
    
    // Restart all connections
    for (const [eventId, connection] of this.connections) {
      if (connection.isActive) {
        this.startRealTimeLoop(eventId, connection);
      }
    }
  }
}

// 🔥 SINGLETON INSTANCE - BURN THE OLD SYSTEM
const realTimeChatManager = new RealTimeChatManager();

export default realTimeChatManager; 