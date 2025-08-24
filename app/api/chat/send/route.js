import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/utils/supabase/admin';
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function POST(request) {
  try {
    const { 
      eventId,
      eventTitle,
      message,
      userId,
      userName
    } = await request.json();

    if (!eventId || !message?.text || !userId || !userName) {
      return NextResponse.json(
        { error: 'eventId, message.text, userId, and userName are required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Get event details for validation and TTL calculation
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('starts_at, ends_at, title')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Check if chat is locked (1 hour after event ends)
    const eventEndTime = new Date(event.ends_at || event.starts_at).getTime();
    const lockoutTime = eventEndTime + (60 * 60 * 1000); // 1 hour after event end
    const now = Date.now();
    
    if (now > lockoutTime) {
      return NextResponse.json(
        { error: 'Chat is locked - event ended over an hour ago' },
        { status: 403 }
      );
    }

    // Create message object
    const messageData = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: message.text,
      userId,
      userName,
      timestamp: Date.now(),
    };

    // Save message to Redis
    const roomKey = `chat:event:${eventId}`;
    await redis.zadd(roomKey, { 
      score: messageData.timestamp, 
      member: JSON.stringify(messageData) 
    });

    // Set expiration to 1 hour after event ends
    const ttlSeconds = Math.max(0, Math.floor((lockoutTime - now) / 1000));
    if (ttlSeconds > 0) {
      await redis.expire(roomKey, ttlSeconds);
    }

    // Get RSVP'd users for push notifications (excluding sender)
    console.log('🔍 Looking for RSVP users for event:', eventId, 'excluding sender:', userId);
    const { data: rsvps, error: rsvpError } = await supabase
      .from('rsvps')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('status', 'going')
      .neq('user_id', userId);
    
    console.log('📊 RSVP query result:', { rsvps, rsvpError, count: rsvps?.length || 0 });

    if (!rsvpError && rsvps && rsvps.length > 0) {
      // Send smart push notifications
      const userIds = rsvps.map(rsvp => rsvp.user_id);
      console.log('🔔 Found RSVP users for notifications:', userIds);
      
      // Calculate message counts for each user (simple approach: get from Redis count)
      const notifications = await Promise.all(userIds.map(async (targetUserId) => {
        // For simplicity, we'll use Redis to get current message count for this event
        const allMessages = await redis.zrange(roomKey, 0, -1);
        const messageCount = allMessages.length;
        
        // Determine if this is first message for this user session
        // For now, we'll consider messages > 1 as replacement candidates
        const isFirstMessage = messageCount === 1;
        const notificationBody = isFirstMessage 
          ? `${userName}: ${message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text}`
          : `${messageCount} new messages`;
          
        return {
          userId: targetUserId,
          isFirstMessage,
          count: messageCount,
          body: notificationBody
        };
      }));

      // Call smart notification API
      try {
        const notificationPayload = {
          userIds,
          eventId,
          eventTitle: eventTitle || event.title,
          notifications,
          senderName: userName,
          data: {
            type: 'chat_message',
            eventId,
            eventTitle: eventTitle || event.title,
            senderId: userId,
            senderName: userName
          }
        };

        const notificationUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://vybelocal.com'}/api/notifications/send-chat`;
        console.log('🚀 Calling notification API:', notificationUrl);
        console.log('🚀 Notification payload:', JSON.stringify(notificationPayload, null, 2));
        
        const notifResponse = await fetch(notificationUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(notificationPayload)
        });

        console.log('📡 Notification response status:', notifResponse.status);
        
        if (!notifResponse.ok) {
          const errorText = await notifResponse.text();
          console.error('❌ Push notification failed:', errorText);
        } else {
          const responseData = await notifResponse.json();
          console.log('✅ Push notification success:', responseData);
        }
      } catch (notifError) {
        console.error('Push notification error:', notifError);
        // Don't fail the message send if notifications fail
      }
    } else {
      console.log('ℹ️ No notifications sent:', { 
        rsvpError: !!rsvpError, 
        rsvpCount: rsvps?.length || 0,
        reason: rsvpError ? 'RSVP query error' : 'No RSVP users found'
      });
    }

    console.log('Chat message sent:', {
      eventId,
      userId,
      userName,
      messageLength: message.text.length,
      recipientCount: rsvps?.length || 0
    });

    return NextResponse.json({
      success: true,
      message: messageData
    });

  } catch (error) {
    console.error('Error in chat send API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Chat Send API",
    description: "Send messages and trigger push notifications",
    usage: "POST with eventId, eventTitle, message, userId, userName"
  });
}
