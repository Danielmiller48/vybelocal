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

export default function EventChatModal({ visible, onClose, event }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [showChat, setShowChat] = useState(false);
  // Removed attendees and hostName state for performance
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const initialLoadRef = useRef(null); // track loaded eventId
  const [chatLocked, setChatLocked] = useState(false);
  const [messageIds, setMessageIds] = useState(new Set());
  const [userColors, setUserColors] = useState(new Map());
  const scrollViewRef = useRef(null);
  const [userName, setUserName] = useState('User');

  // 🔥 REAL-TIME STATE
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Fetch user's display name from profiles table
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchUserName = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .maybeSingle();
        
        if (data?.name) {
          setUserName(data.name);
        }
      } catch (error) {
        // Keep default 'User' if fetch fails
      }
    };
    
    fetchUserName();
  }, [user?.id]);

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

  // 🔥 REAL-TIME MESSAGE HANDLER (Fixed: No nested state updates + Instant message handling)
  const handleRealTimeMessages = (newMessages) => {

    
    setMessages(prevMessages => {
      const existingIds = new Set(prevMessages.map(msg => msg.id));
      const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
      
      if (uniqueNewMessages.length === 0) {
        return prevMessages;
      }

      let updatedMessages = [...prevMessages];
      
      // 🚀 REPLACE INSTANT MESSAGES: Match by text, user, and close timestamp
      for (const newMsg of uniqueNewMessages) {
        const instantIndex = updatedMessages.findIndex(msg => 
          msg.id.startsWith('instant-') && 
          msg.text === newMsg.text && 
          msg.userId === newMsg.userId &&
          Math.abs(msg.timestamp - newMsg.timestamp) < 30000 // Within 30 seconds
        );
        
        if (instantIndex !== -1) {
          // Replace instant message with server message
          updatedMessages[instantIndex] = newMsg;
    
        } else {
          // Add new message normally (from other users or no instant match)
          updatedMessages.push(newMsg);
        }
      }
      
      updatedMessages.sort((a, b) => a.timestamp - b.timestamp);
      
      
      
      return updatedMessages;
    });

    // 🔧 SEPARATE STATE UPDATE: Update message IDs separately to avoid nesting
    setMessageIds(prev => {
      const existingIds = new Set(prev);
      const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
      
      if (uniqueNewMessages.length === 0) {
        return prev;
      }

      const newSet = new Set(prev);
      uniqueNewMessages.forEach(msg => newSet.add(msg.id));
      return newSet;
    });

    // 🔄 AUTO-SCROLL: Non-blocking, outside state updates
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // 🔥 SETUP REAL-TIME CONNECTION (Fixed: Don't re-run on modal visibility changes)
  useEffect(() => {
    // Only setup when modal is visible AND user has joined chat
    if (!visible || !showChat || !event?.id || !user?.id) {
      return;
    }

    const setupRealTimeConnection = async () => {
      try {
        setConnectionStatus('connecting');

        await realTimeChatManager.subscribeToEvent(
          event.id,
          user.id,
          handleRealTimeMessages
        );

        setIsConnected(true);
        setConnectionStatus('connected');

      } catch (error) {
        console.error('❌ Failed to setup real-time connection:', error);
        setConnectionStatus('error');
      }
    };

    setupRealTimeConnection();

    // Cleanup when component unmounts or event/user changes
    return () => {
      if (event?.id && user?.id) {
        realTimeChatManager.unsubscribeFromEvent(event.id, user.id);
        setIsConnected(false);
        setConnectionStatus('disconnected');
      }
    };
  }, [visible, showChat, event?.id, user?.id]); // Re-run when modal opens/closes for this event

  // 🔥 LOAD INITIAL MESSAGES AND DATA (Only once per event, when modal opens)
  useEffect(() => {
    if (!visible || !showChat || !event?.id) {
      // Reset when modal is closed
      setMessagesLoading(true);
      setMessages([]);
      initialLoadRef.current = null;
      return;
    }

    // Prevent duplicate initial loads for same event
    if (initialLoadRef.current === event.id) return;
    initialLoadRef.current = event.id;

    const loadInitialData = async () => {
      // 🚀 Show input immediately, but messages load async
      setLoading(false); // Chat input is ready immediately
      setMessagesLoading(true); // Messages still loading
      
      try {
        // 🚀 Load messages in background - non-blocking
        const loadMessages = async () => {
          try {
            const initialMessages = await realTimeChatManager.getInitialMessages(event.id);
            setMessages(initialMessages);
            const ids = new Set(initialMessages.map(msg => msg.id));
            setMessageIds(ids);
            setMessagesLoading(false);
            
            // Auto-scroll when messages load
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: false });
            }, 100);
      } catch (error) {
        setMessages([]);
        setMessagesLoading(false);
      }
        };

        // 🔄 Load messages and reset unread count in parallel (both non-blocking)
        loadMessages();
        realTimeChatManager.resetUnreadCount(event.id, user.id).catch(() => {});

      } catch (error) {
        setLoading(false);
        setMessagesLoading(false);
      }
    };

    loadInitialData();
  }, [visible, showChat, event?.id]); // Runs only when modal opens for a new event

  // 🔥 SEND MESSAGE - INSTANT DISPLAY
  const handleSendMessage = async () => {
    // Validation checks
    const trimmedText = messageText.trim();
    if (!trimmedText || loading) {
      return;
    }

    // Check user data with flexible name handling
    if (!user?.id) {
      return;
    }

    // Use the fetched userName from profiles table
    


    // 🚀 INSTANT DISPLAY: Add message to UI immediately (simple approach)
    const instantMessage = {
      id: `instant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: trimmedText,
      userId: user.id,
      userName,
      timestamp: Date.now()
    };

    // Add to messages instantly
    setMessages(prevMessages => {
      const newMessages = [...prevMessages, instantMessage];
      newMessages.sort((a, b) => a.timestamp - b.timestamp);
      return newMessages;
    });

    // Prevent duplicate sends
    setLoading(true);
    setMessageText(''); // Clear immediately to prevent duplicate typing

    try {


      const result = await realTimeChatManager.sendMessage(
        event.id,
        user.id,
        userName,
        event.title || 'Event',
        trimmedText
      );



    } catch (error) {
      // Remove the instant message if send failed
      setMessages(prevMessages => {
        return prevMessages.filter(msg => msg.id !== instantMessage.id);
      });
      
      // Put the message back if it failed
      setMessageText(trimmedText);
      
      // Show user-friendly error
      alert(`Failed to send message: ${error.message || 'Network error'}`);
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
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);

      if (profileError) throw profileError;

      setAttendees(profileData || []);
    } catch (error) {
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
      const { data: hostProfiles, error: hostError } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', eventData.host_id);

      if (hostError) throw hostError;

      // Handle case where host profile doesn't exist
      const hostData = hostProfiles && hostProfiles.length > 0 ? hostProfiles[0] : null;
      setHostName(hostData?.name || 'Host');
    } catch (error) {
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
    
        realTimeChatManager.pause();
      } else if (nextAppState === 'active') {

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
      // ✅ CONNECTION ALREADY ESTABLISHED
      // Real-time connection is already set up when modal opens
      
      setShowChat(true);
    }
  };

  // Handle close modal
  const handleClose = () => {

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
                {message.userName || 'Unknown User'}
              </Text>
            )}
            <Text style={[
              styles.messageText, 
              { color: isOwnMessage ? 'white' : colors.textPrimary }
            ]}>
              {message.text || '(Message content missing)'}
            </Text>
            <Text style={[
              styles.messageTime,
              { color: isOwnMessage ? 'rgba(255, 255, 255, 0.8)' : colors.textMuted }
            ]}>
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

            <View style={styles.attendeesPreview}>
              <Text style={styles.attendeesTitle}>
                {event.title} Chat
              </Text>
            </View>

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
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
          >
            {renderConnectionStatus()}

            {/* Chat Expiry Notice */}
            <View style={styles.expiryNotice}>
              <Text style={styles.expiryText}>
                💬 Chat closes 1 hour after event ends
              </Text>
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {messagesLoading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>💬 Loading messages...</Text>
                </View>
              ) : messages.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>🔥 Real-time chat is ready!</Text>
                  <Text style={styles.emptySubtext}>Start the conversation</Text>
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
                placeholder={isConnected ? "Send a real-time message..." : "Type a message... (will send when connected)"}
                multiline
                maxLength={500}
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!messageText.trim() || loading) && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!messageText.trim() || loading}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={messageText.trim() && !loading ? colors.primary : '#ccc'} 
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
  expiryNotice: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 6,
    alignItems: 'center',
  },
  expiryText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
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
    // Color will be set dynamically based on message type
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
    // Color will be set dynamically based on message type
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
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