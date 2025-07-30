import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  ScrollView,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  AppState
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../utils/supabase';
import realTimeChatManager from '../utils/realTimeChat';

export default function EventChatModal({ visible, onClose, event, onNewMessage }) {
  const { user } = useAuth();
  const [attendees, setAttendees] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [hostName, setHostName] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);
  const [messageIds, setMessageIds] = useState(new Set());
  const [userColors, setUserColors] = useState(new Map());
  const scrollViewRef = useRef(null);

  // 🔥 REAL-TIME STATE
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Color palette for chat users - all colors tested for readability on white
  const chatColors = [
    '#E74C3C', '#16A085', '#3498DB', '#27AE60', '#F39C12', '#9B59B6',
    '#E67E22', '#8E44AD', '#2980B9', '#D35400', '#C0392B', '#1ABC9C',
    '#34495E', '#9B59B6', '#F1C40F', '#E67E22'
  ];

  // Get or assign color for a user
  const getUserColor = (userId) => {
    if (userColors.has(userId)) {
      return userColors.get(userId);
    }
    const colorIndex = Array.from(userColors.keys()).length % chatColors.length;
    const color = chatColors[colorIndex];
    setUserColors(prev => new Map(prev).set(userId, color));
    return color;
  };

  // 🔥 REAL-TIME MESSAGE HANDLER
  const handleRealTimeMessages = (newMessages) => {
    console.log('🔥 HANDLING REAL-TIME MESSAGES:', newMessages.length);
    
    setMessages(prevMessages => {
      const existingIds = new Set(prevMessages.map(msg => msg.id));
      const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
      
      if (uniqueNewMessages.length === 0) {
        return prevMessages;
      }

      // Update message IDs set
      setMessageIds(prev => {
        const newSet = new Set(prev);
        uniqueNewMessages.forEach(msg => newSet.add(msg.id));
        return newSet;
      });

      const updatedMessages = [...prevMessages, ...uniqueNewMessages];
      updatedMessages.sort((a, b) => a.timestamp - b.timestamp);
      
      console.log('🔥 ADDED', uniqueNewMessages.length, 'NEW MESSAGES');
      
      // Auto-scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      return updatedMessages;
    });
  };

  // 🔥 SETUP REAL-TIME CONNECTION
  useEffect(() => {
    if (!visible || !showChat || !event?.id || !user?.id) {
      return;
    }

    const setupRealTimeConnection = async () => {
      try {
        console.log('🔥 SETTING UP REAL-TIME CONNECTION for event:', event.id);
        setConnectionStatus('connecting');

        await realTimeChatManager.subscribeToEvent(
          event.id,
          user.id,
          handleRealTimeMessages
        );

        setIsConnected(true);
        setConnectionStatus('connected');
        console.log('🔥 REAL-TIME CONNECTION ESTABLISHED');

      } catch (error) {
        console.error('❌ Failed to setup real-time connection:', error);
        setConnectionStatus('error');
      }
    };

    setupRealTimeConnection();

    // Cleanup on unmount or when modal closes
    return () => {
      if (event?.id && user?.id) {
        console.log('🔥 CLEANING UP REAL-TIME CONNECTION');
        realTimeChatManager.unsubscribeFromEvent(event.id, user.id);
        setIsConnected(false);
        setConnectionStatus('disconnected');
      }
    };
  }, [visible, showChat, event?.id, user?.id]);

  // 🔥 LOAD INITIAL MESSAGES AND DATA
  useEffect(() => {
    if (!visible || !showChat || !event?.id) {
      return;
    }

    const loadInitialData = async () => {
      setLoading(true);
      try {
        // Load initial messages
        const initialMessages = await realTimeChatManager.getInitialMessages(event.id);
        setMessages(initialMessages);
        
        const ids = new Set(initialMessages.map(msg => msg.id));
        setMessageIds(ids);

        console.log('🔥 LOADED', initialMessages.length, 'INITIAL MESSAGES');

        // Reset unread count when opening chat
        await realTimeChatManager.resetUnreadCount(event.id, user.id);

        // Load attendees and host info
        await Promise.all([
          loadAttendees(),
          loadHostInfo()
        ]);

        // Auto-scroll to bottom
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }, 500);

      } catch (error) {
        console.error('❌ Failed to load initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [visible, showChat, event?.id]);

  // 🔥 SEND MESSAGE - REAL-TIME
  const handleSendMessage = async () => {
    if (!messageText.trim() || loading || !user?.full_name) {
      return;
    }

    const trimmedText = messageText.trim();
    setMessageText('');
    setLoading(true);

    try {
      console.log('🔥 SENDING REAL-TIME MESSAGE');

      await realTimeChatManager.sendMessage(
        event.id,
        user.id,
        user.full_name,
        event.title || 'Event',
        trimmedText
      );

      console.log('🔥 MESSAGE SENT SUCCESSFULLY');

    } catch (error) {
      console.error('❌ Error sending message:', error);
      // Put the message back if it failed
      setMessageText(trimmedText);
    } finally {
      setLoading(false);
    }
  };

  // Load attendees
  const loadAttendees = async () => {
    try {
      // First get the RSVP user IDs
      const { data: rsvpData, error: rsvpError } = await supabase
        .from('rsvps')
        .select('user_id')
        .eq('event_id', event.id)
        .eq('status', 'attending');

      if (rsvpError) throw rsvpError;

      if (!rsvpData || rsvpData.length === 0) {
        setAttendees([]);
        return;
      }

      const userIds = rsvpData.map(rsvp => rsvp.user_id);

      // Then get the user profiles
      const { data: profileData, error: profileError } = await supabase
        .from('public_user_cards')
        .select('id, full_name, profile_picture_url')
        .in('id', userIds);

      if (profileError) throw profileError;

      setAttendees(profileData || []);
    } catch (error) {
      console.error('Error loading attendees:', error);
      setAttendees([]); // Set empty array on error
    }
  };

  // Load host info
  const loadHostInfo = async () => {
    try {
      // First get the event host_id
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('host_id')
        .eq('id', event.id)
        .single();

      if (eventError) throw eventError;

      if (!eventData?.host_id) {
        setHostName('Host');
        return;
      }

      // Then get the host profile
      const { data: hostData, error: hostError } = await supabase
        .from('public_user_cards')
        .select('full_name')
        .eq('id', eventData.host_id)
        .single();

      if (hostError) throw hostError;

      setHostName(hostData?.full_name || 'Host');
    } catch (error) {
      console.error('Error loading host info:', error);
      setHostName('Host'); // Set default on error
    }
  };

  // Check if chat is locked
  const checkChatLock = () => {
    if (!event?.ends_at) return false;
    
    const eventEndTime = new Date(event.ends_at);
    const lockoutTime = new Date(eventEndTime.getTime() + (60 * 60 * 1000)); // 1 hour after
    const now = new Date();
    
    return now > lockoutTime;
  };

  // 🔥 APP STATE MANAGEMENT
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'background') {
        console.log('⏸️ APP BACKGROUNDED - pausing real-time connections');
        realTimeChatManager.pause();
      } else if (nextAppState === 'active') {
        console.log('▶️ APP FOREGROUNDED - resuming real-time connections');
        realTimeChatManager.resume();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Handle join chat
  const handleJoinChat = async () => {
    const isLocked = checkChatLock();
    setChatLocked(isLocked);
    
    if (!isLocked) {
      // 🔥 FALLBACK AUTO-SUBSCRIPTION FOR LEGACY EVENTS
      // Check if user is already subscribed, if not, auto-subscribe them
      try {
        if (!realTimeChatManager.isConnectedToEvent(event.id)) {
          console.log('🔥 FALLBACK: Auto-subscribing to chat for legacy event:', event.id);
          await realTimeChatManager.subscribeToEvent(
            event.id,
            user.id,
            () => {}, // No callback needed for background subscription
            () => {}  // No unread callback needed for background subscription
          );
          console.log('🔥 FALLBACK: Successfully subscribed to legacy event chat');
        } else {
          console.log('✅ Already subscribed to chat for event:', event.id);
        }
      } catch (chatError) {
        console.error('❌ Failed to auto-subscribe to legacy event chat:', chatError);
        // Don't fail chat entry if subscription fails
      }
      
      setShowChat(true);
    }
  };

  // Handle close modal
  const handleClose = () => {
    console.log('🔥 CLOSING CHAT MODAL');
    setShowChat(false);
    setMessages([]);
    setMessageIds(new Set());
    setUserColors(new Map());
    setConnectionStatus('disconnected');
    setIsConnected(false);
    onClose();
  };

  // Render connection status
  const renderConnectionStatus = () => {
    if (connectionStatus === 'connecting') {
      return (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>🔄 Connecting to real-time chat...</Text>
        </View>
      );
    } else if (connectionStatus === 'error') {
      return (
        <View style={[styles.statusBar, styles.errorBar]}>
          <Text style={styles.statusText}>❌ Connection error - retrying...</Text>
        </View>
      );
    } else if (connectionStatus === 'connected') {
      return (
        <View style={[styles.statusBar, styles.connectedBar]}>
          <Text style={styles.statusText}>🔥 Real-time chat active</Text>
        </View>
      );
    }
    return null;
  };

  // Render message item
  const renderMessage = (message) => {
    const isOwnMessage = message.userId === user?.id;
    const userColor = getUserColor(message.userId);
    
    return (
      <View key={message.id} style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownBubble : styles.otherBubble
        ]}>
          {!isOwnMessage && (
            <Text style={[styles.senderName, { color: userColor }]}>
              {message.userName}
            </Text>
          )}
          <Text style={styles.messageText}>{message.text}</Text>
          <Text style={styles.messageTime}>
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {event?.title || 'Event Chat'}
          </Text>
          <View style={styles.placeholder} />
        </View>

        {!showChat ? (
          /* Guidelines Screen */
          <View style={styles.guidelinesContainer}>
            <Text style={styles.guidelinesTitle}>Community Guidelines</Text>
            <ScrollView style={styles.guidelinesScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.guidelinesText}>
                Welcome to the event chat! Please follow these guidelines:
                {'\n\n'}
                🤝 Be respectful and kind to all participants
                {'\n\n'}
                💬 Keep conversations relevant to the event
                {'\n\n'}
                🚫 No spam, harassment, or inappropriate content
                {'\n\n'}
                📱 No sharing personal contact information
                {'\n\n'}
                🎉 Have fun and connect with fellow attendees!
                {'\n\n'}
                Chat will automatically close 1 hour after the event ends.
              </Text>
            </ScrollView>

            {attendees.length > 0 && (
              <View style={styles.attendeesPreview}>
                <Text style={styles.attendeesTitle}>
                  {attendees.length} attending • Hosted by {hostName}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attendeesScroll}>
                  {attendees.slice(0, 10).map((attendee, index) => (
                    <Image
                      key={attendee.id}
                      source={{ 
                        uri: attendee.profile_picture_url || 'https://via.placeholder.com/40x40?text=?' 
                      }}
                      style={styles.attendeeAvatar}
                    />
                  ))}
                  {attendees.length > 10 && (
                    <View style={styles.moreAttendees}>
                      <Text style={styles.moreAttendeesText}>+{attendees.length - 10}</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.joinButton, chatLocked && styles.lockedButton]} 
              onPress={handleJoinChat}
              disabled={chatLocked}
            >
              <Text style={[styles.joinButtonText, chatLocked && styles.lockedButtonText]}>
                {chatLocked ? '🔒 Chat Locked (Event Ended)' : '🔥 Start Real-Time Chat!'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Real-Time Chat Screen */
          <KeyboardAvoidingView 
            style={styles.chatContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            {renderConnectionStatus()}

            {/* Messages */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {loading && messages.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>🔥 Loading real-time chat...</Text>
                </View>
              ) : messages.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>🔥 Real-time chat is ready!</Text>
                  <Text style={styles.emptySubtext}>Be the first to say something</Text>
                </View>
              ) : (
                messages.map(renderMessage)
              )}
            </ScrollView>

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={messageText}
                onChangeText={setMessageText}
                placeholder={isConnected ? "Send a real-time message..." : "Connecting..."}
                multiline
                maxLength={500}
                editable={isConnected && !loading}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!messageText.trim() || loading || !isConnected) && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!messageText.trim() || loading || !isConnected}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={messageText.trim() && isConnected && !loading ? colors.primary : '#ccc'} 
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  placeholder: {
    width: 40,
  },
  
  // Guidelines Screen
  guidelinesContainer: {
    flex: 1,
    padding: 20,
  },
  guidelinesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  guidelinesScroll: {
    flex: 1,
    marginBottom: 20,
  },
  guidelinesText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: 'left',
  },
  attendeesPreview: {
    marginBottom: 20,
  },
  attendeesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  attendeesScroll: {
    flexDirection: 'row',
  },
  attendeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: colors.card,
  },
  moreAttendees: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreAttendeesText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  joinButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  lockedButton: {
    backgroundColor: colors.card,
  },
  lockedButtonText: {
    color: colors.textMuted,
  },

  // Real-Time Chat Screen
  chatContainer: {
    flex: 1,
  },
  statusBar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  connectedBar: {
    backgroundColor: '#d4edda',
  },
  errorBar: {
    backgroundColor: '#f8d7da',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
  },
  messageContainer: {
    marginBottom: 12,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  ownBubble: {
    backgroundColor: colors.primary,
  },
  otherBubble: {
    backgroundColor: colors.card,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    color: 'white',
  },
  messageTime: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.card,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
}); 