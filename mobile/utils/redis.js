import 'react-native-get-random-values';
import { Redis } from '@upstash/redis';
import Constants from 'expo-constants';

// Get Upstash credentials from environment variables
// Try multiple sources for environment variables in Expo
const UPSTASH_REDIS_REST_URL = 
  process.env.UPSTASH_REDIS_REST_URL || 
  Constants.expoConfig?.extra?.UPSTASH_REDIS_REST_URL ||
  Constants.manifest?.extra?.UPSTASH_REDIS_REST_URL;

const UPSTASH_REDIS_REST_TOKEN = 
  process.env.UPSTASH_REDIS_REST_TOKEN || 
  Constants.expoConfig?.extra?.UPSTASH_REDIS_REST_TOKEN ||
  Constants.manifest?.extra?.UPSTASH_REDIS_REST_TOKEN;

// Debug logging to see what's available
if (__DEV__) {
  console.log('Redis Config Debug:', {
    'process.env.UPSTASH_REDIS_REST_URL': process.env.UPSTASH_REDIS_REST_URL ? 'FOUND' : 'MISSING',
    'process.env.UPSTASH_REDIS_REST_TOKEN': process.env.UPSTASH_REDIS_REST_TOKEN ? 'FOUND' : 'MISSING',
    'Constants.expoConfig?.extra': Constants.expoConfig?.extra,
    'final UPSTASH_REDIS_REST_URL': UPSTASH_REDIS_REST_URL ? 'FOUND' : 'MISSING',
    'final UPSTASH_REDIS_REST_TOKEN': UPSTASH_REDIS_REST_TOKEN ? 'FOUND' : 'MISSING'
  });
}

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.warn('Upstash Redis credentials not found. Chat functionality will be disabled.');
}

// Create Redis client
export const redis = UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN 
  ? new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Chat utility functions
export const chatUtils = {
  // Generate room key for event chat
  getRoomKey: (eventId) => `chat:event:${eventId}`,
  
  // Check if chat is locked (1 hour after event end)
  isChatLocked: (event) => {
    // Use ends_at if available, fallback to starts_at (matches database view logic)
    const eventEndTimeStr = event.ends_at || event.starts_at;
    const eventEndTime = new Date(eventEndTimeStr).getTime();
    const lockoutTime = eventEndTime + (60 * 60 * 1000); // 1 hour after event end
    const now = Date.now();
    
    // Debug logging to verify UTC conversion (only log once per chat session)
    if (__DEV__ && !chatUtils._lockCheckLogged) {
      console.log('Chat lock check:', {
        eventEndStr: eventEndTimeStr,
        eventEndLocal: new Date(eventEndTime).toLocaleString(),
        lockoutLocal: new Date(lockoutTime).toLocaleString(),
        nowLocal: new Date(now).toLocaleString(),
        isLocked: now > lockoutTime
      });
      chatUtils._lockCheckLogged = true; // Prevent repeated logging
    }
    
    return now > lockoutTime;
  },

  // Send message to event chat
  sendMessage: async (eventId, message, event) => {
    if (!redis) {
      throw new Error('Redis not configured');
    }
    
    // Check if chat is locked
    if (chatUtils.isChatLocked(event)) {
      throw new Error('Chat is locked - event ended over an hour ago');
    }
    
    const roomKey = chatUtils.getRoomKey(eventId);
    const messageData = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // More unique ID
      text: message.text,
      userId: message.userId,
      userName: message.userName,
      timestamp: Date.now(),
    };
    
    // Add message to sorted set (by timestamp)
    await redis.zadd(roomKey, { score: messageData.timestamp, member: JSON.stringify(messageData) });
    
    // Set expiration to 1 hour after event ends
    const eventEndTime = new Date(event.ends_at || event.starts_at).getTime();
    const destructTime = eventEndTime + (60 * 60 * 1000); // 1 hour after event end
    const ttlSeconds = Math.max(0, Math.floor((destructTime - Date.now()) / 1000));
    
    if (ttlSeconds > 0) {
      await redis.expire(roomKey, ttlSeconds);
    }
    
    return messageData;
  },
  
  // Get messages from event chat
  getMessages: async (eventId, event, limit = 50) => {
    if (!redis) {
      throw new Error('Redis not configured');
    }
    
    const roomKey = chatUtils.getRoomKey(eventId);
    
    // Check if chat has been destroyed (1 hour after event end)
    if (chatUtils.isChatLocked(event)) {
      return []; // Chat is destroyed, return empty
    }
    
    // Get latest messages in chronological order (oldest to newest)  
    const messages = await redis.zrange(roomKey, -limit, -1);
    
    if (!messages || messages.length === 0) {
      return [];
    }
    
    const parsedMessages = [];
    for (const msgStr of messages) {
      // Check if it's already an object
      if (typeof msgStr === 'object' && msgStr !== null) {
        parsedMessages.push(msgStr);
        continue;
      }
      
      // If it's a string, try to parse it
      if (typeof msgStr === 'string') {
        try {
          parsedMessages.push(JSON.parse(msgStr));
        } catch (parseError) {
          // Only log parsing errors in dev mode and limit frequency
          if (__DEV__) {
            console.warn('Chat message parse error:', parseError.message);
          }
          
          // Try different parsing approaches
          try {
            // Maybe it has extra quotes or escaping
            const unescaped = msgStr.replace(/\\"/g, '"').replace(/^"/, '').replace(/"$/, '');
            parsedMessages.push(JSON.parse(unescaped));
          } catch (secondError) {
            // Skip malformed messages silently in production
            if (__DEV__) {
              console.warn('Skipping malformed message');
            }
          }
        }
      }
    }
    
    return parsedMessages;
  },
  
  // Subscribe to new messages (for real-time updates)
  subscribeToMessages: async (eventId, event, callback) => {
    if (!redis) {
      throw new Error('Redis not configured');
    }
    
    // Check if chat is already locked
    if (chatUtils.isChatLocked(event)) {
      return () => {}; // Return empty cleanup function
    }
    
    // For React Native, we'll use polling instead of websockets
    const roomKey = chatUtils.getRoomKey(eventId);
    let lastTimestamp = Date.now();
    let knownMessageIds = new Set(); // Track message IDs to prevent duplicates
    let isActive = true; // Track if polling should continue
    
    const pollForMessages = async () => {
      try {
        // Stop polling if deactivated or chat is now locked
        if (!isActive || chatUtils.isChatLocked(event)) {
          clearInterval(intervalId);
          return;
        }
        
        // Get all messages and filter by timestamp manually
        const allMessages = await redis.zrange(roomKey, 0, -1);
        const newMessages = [];
        
        if (allMessages && allMessages.length > 0) {
           for (const messageStr of allMessages) {
             let message = null;
             
             // Check if it's already an object
             if (typeof messageStr === 'object' && messageStr !== null) {
               message = messageStr;
             } else if (typeof messageStr === 'string') {
               try {
                 message = JSON.parse(messageStr);
               } catch (parseError) {
                 // Only log parsing errors in dev mode during polling
                 if (__DEV__) {
                   console.warn('Polling message parse error:', parseError.message);
                 }
                 
                 // Try different parsing approaches
                 try {
                   const unescaped = messageStr.replace(/\\"/g, '"').replace(/^"/, '').replace(/"$/, '');
                   message = JSON.parse(unescaped);
                 } catch (secondError) {
                   // Skip malformed messages silently
                   continue;
                 }
               }
             }
             
             if (message && message.timestamp > lastTimestamp && !knownMessageIds.has(message.id)) {
               newMessages.push(message);
               knownMessageIds.add(message.id);
               lastTimestamp = Math.max(lastTimestamp, message.timestamp);
             }
           }
         }
        
        if (newMessages.length > 0) {
          // Sort new messages by timestamp to maintain chronological order
          newMessages.sort((a, b) => a.timestamp - b.timestamp);
          callback(newMessages);
        }
      } catch (error) {
        // Only log polling errors in dev mode to reduce noise
        if (__DEV__) {
          console.warn('Chat polling error:', error.message);
        }
      }
    };
    
    // Poll every 2 seconds
    const intervalId = setInterval(pollForMessages, 2000);
    
    // Return cleanup function
    return () => {
      if (__DEV__) {
        console.log('🛑 Clearing chat polling interval');
      }
      isActive = false; // Signal polling to stop
      clearInterval(intervalId);
    };
  },
};

export default redis; 