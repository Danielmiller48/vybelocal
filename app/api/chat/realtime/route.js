import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Real-time chat endpoint using Redis with long-polling for React Native
// Fixed: Ensure POST method is properly exported and deployed
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const userId = searchParams.get('userId');
  const lastTimestamp = searchParams.get('lastTimestamp') || '0';

  if (!eventId || !userId) {
    return Response.json({ error: 'eventId and userId are required' }, { status: 400 });
  }

  try {
    // Long-polling with timeout - server waits for new messages
    const startTime = Date.now();
    const timeout = 30000; // 30 second timeout
    const pollInterval = 15000; // Check every 15 seconds (chat doesn't need sub-second response)
    
    console.log(`🔄 Long-polling started for event ${eventId}, user ${userId}, since ${lastTimestamp}`);
    
    while (Date.now() - startTime < timeout) {
      // Check for new messages since lastTimestamp
      const roomKey = `chat:event:${eventId}`;
      const rawMessages = await redis.zrange(roomKey, 0, -1);
      
      if (rawMessages && rawMessages.length > 0) {
        const messages = [];
        for (const messageStr of rawMessages) {
          try {
            let message;
            if (typeof messageStr === 'object') {
              message = messageStr;
            } else {
              message = JSON.parse(messageStr);
            }
            
            // Only include messages newer than lastTimestamp
            if (message.timestamp > parseInt(lastTimestamp)) {
              messages.push(message);
            }
          } catch (error) {
            console.warn('Failed to parse message:', error.message);
            continue;
          }
        }
        
        if (messages.length > 0) {
          messages.sort((a, b) => a.timestamp - b.timestamp);
          console.log(`🔥 Returning ${messages.length} new messages for event ${eventId}`);
          
          return Response.json({
            type: 'messages',
            eventId,
            messages,
            timestamp: Date.now()
          });
        }
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // Timeout - return heartbeat
    console.log(`💓 Heartbeat timeout for event ${eventId}`);
    return Response.json({
      type: 'heartbeat',
      eventId,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Real-time chat error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { eventId, userId, action, lastTimestamp } = await request.json();

    if (!eventId || !userId) {
      return Response.json(
        { error: 'eventId and userId are required' },
        { status: 400 }
      );
    }

    const channelName = `chat:event:${eventId}:updates`;

    if (action === 'subscribe') {
      console.log(`🔌 User ${userId} subscribing to real-time updates for event ${eventId}`);
      
      // Store subscription in Redis for tracking
      const subscriptionKey = `chat:subscriptions:${eventId}`;
      await redis.sadd(subscriptionKey, userId);
      await redis.expire(subscriptionKey, 86400); // 24 hour expiry
      
      return Response.json({
        success: true,
        message: 'Subscribed to real-time chat updates',
        channel: channelName,
        pollUrl: `/api/chat/realtime?eventId=${eventId}&userId=${userId}&lastTimestamp=${lastTimestamp || Date.now()}`
      });
      
    } else if (action === 'unsubscribe') {
      console.log(`🔌 User ${userId} unsubscribing from event ${eventId}`);
      
      // Remove subscription from Redis
      const subscriptionKey = `chat:subscriptions:${eventId}`;
      await redis.srem(subscriptionKey, userId);
      
      return Response.json({
        success: true,
        message: 'Unsubscribed from real-time chat updates'
      });
      
    } else if (action === 'heartbeat') {
      // Keep connection alive
      return Response.json({
        success: true,
        timestamp: Date.now()
      });
      
    } else {
      return Response.json(
        { error: 'Invalid action. Use "subscribe", "unsubscribe", or "heartbeat"' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('Real-time subscription error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}