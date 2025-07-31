import AsyncStorage from '@react-native-async-storage/async-storage';

class RealTimeChatManager {
  constructor() {
    this.connections = new Map(); // eventId -> connection info
    this.messageCallbacks = new Map(); // eventId -> callback function
    this.unreadCallbacks = new Map(); // eventId -> unread count callback
    this.baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://www.vybelocal.com';
    this.isActive = true;
    
    // 📊 REQUEST TRACKING FOR DEBUGGING
    this.requestCounts = new Map(); // eventId -> request count
    this.initialMessageCounts = new Map(); // eventId -> initial message call count
    this.totalApiCalls = 0; // Global API call counter
  }

  /**
   * 🔥 REAL-TIME MESSAGE SUBSCRIPTION
   * Completely replaces the old polling bullshit
   */
  async subscribeToEvent(eventId, userId, onMessageReceived, onUnreadCountChanged) {
    // If there's already a live connection for **another** event, close it to conserve resources.
    if (this.connections.size > 0 && !this.connections.has(eventId)) {
      this.connections.forEach((conn, existingEventId) => {
        conn.isActive = false;
        // Abort any in-flight fetch for that connection
        if (conn.abortController) {
          try { conn.abortController.abort(); } catch(e){}
        }
      });
      this.connections.clear();
      this.messageCallbacks.clear();
      this.unreadCallbacks.clear();
      this.requestCounts.clear();
    }

    // 🔒 STRICT DUPLICATE PREVENTION
    if (this.connections.has(eventId)) {
      const existing = this.connections.get(eventId);

      // Update callbacks if new ones provided
      if (onMessageReceived) {
        this.messageCallbacks.set(eventId, onMessageReceived);
      }
      if (onUnreadCountChanged) {
        this.unreadCallbacks.set(eventId, onUnreadCountChanged);
      }

      // If a polling loop is already active, do NOT create another one
      if (existing.isPolling) {
        return; // prevents duplicate loops and request spam
      }

      // If previous connection exists but isn't polling (disconnected), let it continue below
    }



    // Store callbacks
    this.messageCallbacks.set(eventId, onMessageReceived || (() => {}));
    if (onUnreadCountChanged) {
      this.unreadCallbacks.set(eventId, onUnreadCountChanged);
    }

    // Store connection info with retry tracking
    const connection = {
      eventId,
      userId,
      isActive: true,
      lastTimestamp: Date.now(),
      startTime: Date.now(),
      errorCount: 0,
      lastErrorTime: 0,
      abortController: null, // track current fetch controller to allow clean abort
      isPolling: false // prevent duplicate loops
    };
    
    this.connections.set(eventId, connection);

    // Start real-time polling loop (only if not already running)
    this.startRealTimeLoop(eventId, connection);

    
    this.logActiveConnections();
  }

  logActiveConnections() {
    const activeConnections = Array.from(this.connections.entries()).map(([eventId, conn]) => ({
      eventId: eventId.slice(-8), // Show last 8 chars
      isActive: conn.isActive,
      errorCount: conn.errorCount || 0,
      requests: this.requestCounts.get(eventId) || 0,
      startTime: new Date(conn.startTime).toISOString(),
      age: ((Date.now() - conn.startTime) / 1000).toFixed(1) + 's'
    }));
    

    
    // 🚨 EMERGENCY: Show total requests across all connections
    const totalRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);
    if (totalRequests > 20) {
      console.error('🚨 HIGH REQUEST COUNT DETECTED!', {
        totalConnections: this.connections.size,
        totalRequests,
        averagePerConnection: (totalRequests / Math.max(this.connections.size, 1)).toFixed(1)
      });
    }
  }

  // 🛑 EMERGENCY STOP: Kill all connections if things go crazy
  emergencyStop() {
    console.error('🛑 EMERGENCY STOP: Killing all connections');
    
    this.connections.forEach((connection, eventId) => {
      connection.isActive = false;
      // Abort any in-flight fetch for that connection
      if (connection.abortController) {
        try { connection.abortController.abort(); } catch(e){}
      }
      console.log('🛑 Stopped connection for event:', eventId);
    });
    
    this.connections.clear();
    this.messageCallbacks.clear();
    this.unreadCallbacks.clear();
    this.requestCounts.clear();
    this.initialMessageCounts.clear();
    this.totalApiCalls = 0;
    
    console.log('🛑 All connections destroyed, counters reset');
  }

  // 🔄 MANUAL RESTART: Fix dead connections
  restartConnection(eventId) {
    const connection = this.connections.get(eventId);
    if (connection) {
      console.log('🔄 MANUALLY RESTARTING CONNECTION for event:', eventId);
      connection.errorCount = 0;
      connection.isActive = true;
      connection.lastErrorTime = 0;
      
      // Restart the polling loop
      this.startRealTimeLoop(eventId, connection);
      return true;
    }
    return false;
  }

  /**
   * 🔥 REAL-TIME POLLING LOOP
   * This is NOT the old shitty polling - this is efficient long-polling
   * The server holds the connection for 30 seconds and only responds when there are new messages
   */
  async startRealTimeLoop(eventId, connection) {
    // Prevent spawning multiple loops for the same connection
    if (connection.isPolling) {
      return; // already running
    }
    connection.isPolling = true;

    while (connection.isActive && this.isActive && this.connections.has(eventId)) {
      try {
        const pollStartTime = Date.now();
        
        // 📊 TRACK REQUEST COUNT & DETECT SPAM
        const currentCount = this.requestCounts.get(eventId) || 0;
        this.requestCounts.set(eventId, currentCount + 1);
        
        // 🚨 SPAM DETECTION: Alert if too many requests too quickly
        // Removed noisy spam warning log (kept internal tracking only)
        // if (currentCount > 5) {
        //   const timeSinceStart = Date.now() - connection.startTime;
        //   const requestRate = currentCount / (timeSinceStart / 60000); // requests per minute
          
        //   if (requestRate > 10) { // More than 10 requests/minute = SPAM
        //     console.error('🚨 REQUEST SPAM DETECTED!', {
        //       eventId,
        //       totalRequests: currentCount + 1,
        //       timeElapsed: (timeSinceStart / 1000).toFixed(1) + 's',
        //       requestRate: requestRate.toFixed(1) + ' req/min',
        //       connectionAge: ((Date.now() - connection.startTime) / 1000).toFixed(1) + 's',
        //       errorCount: connection.errorCount
        //     });
        //   }
        // }
        
        // 📊 GLOBAL API TRACKING
        this.totalApiCalls++;
        


        const controller = new AbortController();
        // Store so we can cancel if user navigates away or a new event is opened
        connection.abortController = controller;
        const timeoutId = setTimeout(() => {
          console.log('⏰ Long-poll timeout after 35 seconds for event:', eventId);
          controller.abort();
        }, 35000); // 35 second timeout (longer than server's 30 seconds)
        
        const response = await fetch(
          `${this.baseUrl}/api/chat/realtime?eventId=${eventId}&userId=${connection.userId}&lastTimestamp=${connection.lastTimestamp}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
        const pollDuration = ((Date.now() - pollStartTime) / 1000).toFixed(1);


        if (!response.ok) {
          connection.errorCount++;
          connection.lastErrorTime = Date.now();
          
          console.error('❌ Real-time connection error:', response.status, 'count:', connection.errorCount);
          
          // 🚨 CIRCUIT BREAKER: Stop aggressive retries after 5 consecutive errors
          if (connection.errorCount >= 5) {
            console.error('🛑 TOO MANY ERRORS - STOPPING POLLING for event:', eventId);
            connection.isActive = false;
            break;
          }
          
          // Exponential backoff: 5s, 10s, 20s, 40s, 60s
          const delayMs = Math.min(5000 * Math.pow(2, connection.errorCount - 1), 60000);
          console.log('⏳ Waiting', delayMs/1000, 'seconds before retry...');
          await this.delay(delayMs);
          continue;
        }
        
        // Reset error count on successful response
        connection.errorCount = 0;

        const data = await response.json();
        
        if (data.type === 'messages' && data.messages && data.messages.length > 0) {

          
          // Update last timestamp
          const latestMessage = data.messages[data.messages.length - 1];
          connection.lastTimestamp = latestMessage.timestamp + 1;
          
          // Call message callback
          const messageCallback = this.messageCallbacks.get(eventId);
          if (messageCallback) {
            messageCallback(data.messages);
          }

          // Update unread count (batch process, non-blocking)
          const otherUsersMessages = data.messages.filter(msg => msg.userId !== connection.userId);
          if (otherUsersMessages.length > 0) {
            // Non-blocking: don't await this
            this.batchIncrementUnreadCount(eventId, otherUsersMessages.length, connection.userId);
          }
          
        } else if (data.type === 'heartbeat') {
          // Just keep the connection alive
        }

      } catch (error) {
        const pollDuration = ((Date.now() - pollStartTime) / 1000).toFixed(1);
        
        if (error.name === 'AbortError') {

          // Don't log as error - this is expected after 35 seconds
        } else {
          connection.errorCount++;
          connection.lastErrorTime = Date.now();
          
          console.error('❌ Real-time loop error for event:', eventId, 'after:', pollDuration + 's', 'error:', error.message, 'count:', connection.errorCount);
          
          // 🚨 CIRCUIT BREAKER: Stop after too many errors
          if (connection.errorCount >= 5) {
            console.error('🛑 TOO MANY ERRORS - STOPPING POLLING for event:', eventId);
            connection.isActive = false;
            break;
          }
          
          if (connection.isActive && this.connections.has(eventId)) {
            // Exponential backoff for errors
            const delayMs = Math.min(5000 * Math.pow(2, connection.errorCount - 1), 60000);

            await this.delay(delayMs);
          }
        }
      }
    }

    // 🧹 CLEANUP DEAD CONNECTION
    this.connections.delete(eventId);
    this.messageCallbacks.delete(eventId);
    this.unreadCallbacks.delete(eventId);

    // Mark polling stopped
    connection.isPolling = false;
  }

  /**
   * 🔥 SEND MESSAGE - REAL-TIME
   */
  async sendMessage(eventId, userId, userName, eventTitle, messageText) {
    // 📊 GLOBAL API TRACKING
    this.totalApiCalls++;
    


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
    
    
    return result;
  }

  /**
   * 🔥 GET INITIAL MESSAGES
   * Load existing messages when opening chat
   */
  async getInitialMessages(eventId) {
    // 📊 TRACK INITIAL MESSAGE REQUESTS  
    if (!this.initialMessageCounts) this.initialMessageCounts = new Map();
    const currentCount = this.initialMessageCounts.get(eventId) || 0;
    this.initialMessageCounts.set(eventId, currentCount + 1);
    
    // 📊 GLOBAL API TRACKING
    this.totalApiCalls++;
    

    
    // 🚨 DETECT EXCESSIVE INITIAL MESSAGE CALLS
    if (currentCount > 3) {
      console.error('🚨 TOO MANY INITIAL MESSAGE CALLS for event:', eventId, 'count:', currentCount + 1);
    }

    const response = await fetch(`${this.baseUrl}/api/chat/messages?eventId=${eventId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to load messages: ${response.status}`);
    }

    const { messages } = await response.json();
    
    
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



    // Stop the connection
    connection.isActive = false;
    // Abort any fetch currently in-flight for this connection
    if (connection.abortController) {
      try { connection.abortController.abort(); }
      catch(e){}
    }
    this.connections.delete(eventId);
    this.messageCallbacks.delete(eventId);
    this.unreadCallbacks.delete(eventId);

    // Backend notification skipped (subscription tracking not needed for basic functionality)


  }

  /**
   * 📊 UNREAD COUNT MANAGEMENT
   */
  // 🚀 BATCH UNREAD COUNT: Process multiple messages efficiently
  async batchIncrementUnreadCount(eventId, messageCount, currentUserId) {
    try {
      const key = `chat_unread_${eventId}_${currentUserId}`;
      const current = await AsyncStorage.getItem(key);
      const count = parseInt(current || '0') + messageCount;
      
      await AsyncStorage.setItem(key, count.toString());

      
      // Notify callback once with final count
      const callback = this.unreadCallbacks.get(eventId);
      if (callback) {
        callback(count);
      }
      
      return count;
    } catch (error) {
      console.error('❌ Failed to batch increment unread count:', error);
      return 0;
    }
  }

  // 🔄 LEGACY: Keep for backwards compatibility
  async incrementUnreadCount(eventId, fromUserId, currentUserId) {
    // Don't increment for our own messages
    if (fromUserId === currentUserId) {
      return;
    }

    return this.batchIncrementUnreadCount(eventId, 1, currentUserId);
  }

  async resetUnreadCount(eventId, userId) {
    try {
      const key = `chat_unread_${eventId}_${userId}`;
      await AsyncStorage.setItem(key, '0');
  
      
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

    
    this.isActive = false;
    
    for (const [eventId, connection] of this.connections) {
      connection.isActive = false;
      // Abort any in-flight fetch for that connection
      if (connection.abortController) {
        try { connection.abortController.abort(); } catch(e){}
      }
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
      if (connection.isActive && !connection.isPolling) {
        this.startRealTimeLoop(eventId, connection);
      }
    }
  }
}

// 🔥 SINGLETON INSTANCE - BURN THE OLD SYSTEM
const realTimeChatManager = new RealTimeChatManager();

// 🔧 DEBUGGING: Expose manager globally for debugging
if (__DEV__) {
  global.realTimeChatManager = realTimeChatManager;
  global.chatDebug = {
    stats: () => realTimeChatManager.logActiveConnections(),
    stop: () => realTimeChatManager.emergencyStop(),
    requests: () => realTimeChatManager.totalApiCalls
  };
  
}

export default realTimeChatManager; 