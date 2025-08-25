import 'react-native-get-random-values';
import { Redis } from '@upstash/redis';
import Constants from 'expo-constants';
import promiseRetry from 'promise-retry';
import https from 'https';
import Expo from 'expo-server-sdk';

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

// Debug logging removed

// Warning removed

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
    
    // Debug logging removed
    
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
          }
          
          // Try different parsing approaches
          try {
            // Maybe it has extra quotes or escaping
            const unescaped = msgStr.replace(/\\"/g, '"').replace(/^"/, '').replace(/"$/, '');
            parsedMessages.push(JSON.parse(unescaped));
          } catch (secondError) {
            // Skip malformed messages silently in production
            if (__DEV__) {
            }
          }
        }
      }
    }
    
    return parsedMessages;
  },
  
  // Subscribe to new messages (for real-time updates)
  // 🚫 DEPRECATED: Old 2-second polling system - REPLACED by real-time long-polling
  subscribeToMessages: async (eventId, event, callback) => {
    // Deprecated warnings removed
    
    // NO MORE 2-SECOND POLLING! Return empty cleanup function
    return () => {
    };
  },
};

export default redis; 