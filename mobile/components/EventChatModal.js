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
import { chatUtils } from '../utils/redis';

export default function EventChatModal({ visible, onClose, event }) {
  const { user } = useAuth();
  const [attendees, setAttendees] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [hostName, setHostName] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);
  const [pollingCleanup, setPollingCleanup] = useState(null);
  const [messageIds, setMessageIds] = useState(new Set()); // Track message IDs to prevent duplicates
  const [userColors, setUserColors] = useState(new Map()); // Track colors for each user
  const scrollViewRef = useRef(null);

  // Color palette for chat users - all colors tested for readability on white
  const chatColors = [
    '#E74C3C', // Dark Red
    '#16A085', // Dark Teal  
    '#3498DB', // Dark Blue
    '#27AE60', // Dark Green
    '#F39C12', // Dark Orange
    '#9B59B6', // Dark Purple
    '#E67E22', // Dark Orange-Red
    '#8E44AD', // Dark Violet
    '#2980B9', // Dark Blue
    '#D35400', // Dark Orange
    '#C0392B', // Dark Red-Brown
    '#7F8C8D', // Dark Gray
  ];

  // Load attendees and host info when modal opens
  useEffect(() => {
    if (!visible || !event?.id) return;
    loadAttendees();
    loadHostInfo();
    
    // Reset chat state when modal opens
    if (!showChat) {
      setMessages([]);
      setChatLocked(false);
    }
  }, [visible, event?.id]);

  // Cleanup polling when modal closes OR when leaving chat view
  useEffect(() => {
    if (!visible || !showChat) {
      // Clean up polling when modal closes or leaving chat
      if (pollingCleanup) {
        if (__DEV__) {
          console.log('🧹 Cleaning up chat polling', { visible, showChat });
        }
        pollingCleanup();
        setPollingCleanup(null);
      }
      
      // Reset state when modal closes (but not when just leaving chat)
      if (!visible) {
        setShowChat(false);
        setMessages([]);
        setMessageText('');
        setMessageIds(new Set()); // Reset message ID tracking
        setUserColors(new Map()); // Reset user colors
      }
    }
  }, [visible, showChat, pollingCleanup]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0 && showChat) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, showChat]);

  // Handle app state changes (pause polling when app goes to background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Pause polling when app goes to background
        if (pollingCleanup) {
          if (__DEV__) {
            console.log('📱 App backgrounded - pausing chat polling');
          }
          pollingCleanup();
          setPollingCleanup(null);
        }
      } else if (nextAppState === 'active' && showChat && visible && !pollingCleanup) {
        // Resume polling when app comes back to foreground
        if (__DEV__) {
          console.log('📱 App foregrounded - resuming chat polling');
        }
        startMessagePolling().then(cleanup => {
          setPollingCleanup(cleanup);
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, [showChat, visible, pollingCleanup]);

  // Get or assign a color for a user
  const getUserColor = (userId) => {
    if (userColors.has(userId)) {
      return userColors.get(userId);
    }
    
    // Assign a new color based on user ID hash
    const colorIndex = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % chatColors.length;
    const color = chatColors[colorIndex];
    
    setUserColors(prev => new Map(prev).set(userId, color));
    return color;
  };

  const loadAttendees = async () => {
    try {
      const { data: rsvpRows } = await supabase
        .from('rsvps')
        .select('user_id')
        .eq('event_id', event.id);
      
      const userIds = (rsvpRows || []).map(r => r.user_id);
      if (!userIds.length) return;

      const { data: profiles } = await supabase
        .from('public_user_cards')
        .select('uuid, name, avatar_url')
        .in('uuid', userIds);

      const attendeesWithAvatars = await Promise.all(
        (profiles || []).map(async (profile) => ({
          ...profile,
          avatarUrl: await resolveAvatarUrl(profile.avatar_url)
        }))
      );

      setAttendees(attendeesWithAvatars.filter(a => a.avatarUrl));
    } catch (error) {
      console.error('Error loading attendees:', error);
    }
  };

  const resolveAvatarUrl = async (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    try {
      const { data } = await supabase.storage
        .from('profile-images')
        .createSignedUrl(path, 3600, {
          transform: { width: 64, height: 64, resize: 'cover', quality: 60 },
        });
      return data?.signedUrl || null;
    } catch {
      return null;
    }
  };

  const loadHostInfo = async () => {
    try {
      const { data: hostProfile } = await supabase
        .from('public_user_cards')
        .select('name')
        .eq('uuid', event.host_id)
        .single();
      
      if (hostProfile?.name) {
        setHostName(hostProfile.name);
      }
    } catch (error) {
      console.error('Error loading host info:', error);
    }
  };

  const handleJoinChat = async () => {
    // Prevent multiple polling sessions
    if (pollingCleanup) {
      if (__DEV__) {
        console.log('🛑 Cleaning up existing polling before starting new one');
      }
      pollingCleanup();
      setPollingCleanup(null);
    }
    
    // Check if chat is locked before entering
    const isLocked = chatUtils.isChatLocked(event);
    setChatLocked(isLocked);
    
    if (isLocked) {
      alert('This chat has expired - the event ended over an hour ago.');
      return;
    }
    
    setShowChat(true);
    await loadMessages();
    const cleanup = await startMessagePolling();
    setPollingCleanup(cleanup); // Store the cleanup function directly, not wrapped
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const chatMessages = await chatUtils.getMessages(event.id, event);
      
      // Filter out any duplicates and track IDs
      const uniqueMessages = [];
      const newMessageIds = new Set();
      
      for (const msg of chatMessages) {
        if (msg.id && !newMessageIds.has(msg.id)) {
          uniqueMessages.push(msg);
          newMessageIds.add(msg.id);
        }
      }
      
      setMessages(uniqueMessages);
      setMessageIds(newMessageIds);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const startMessagePolling = async () => {
    try {
      const cleanup = await chatUtils.subscribeToMessages(event.id, event, (newMessages) => {
        setMessages(prev => {
          // Filter out any messages we already have
          const newUniqueMessages = newMessages.filter(msg => 
            msg.id && !messageIds.has(msg.id)
          );
          
          if (newUniqueMessages.length === 0) {
            return prev; // No new messages
          }
          
          // Update message IDs set
          setMessageIds(prevIds => {
            const newIds = new Set(prevIds);
            newUniqueMessages.forEach(msg => newIds.add(msg.id));
            return newIds;
          });
          
          const combined = [...prev, ...newUniqueMessages];
          // Sort by timestamp to maintain chronological order
          return combined.sort((a, b) => a.timestamp - b.timestamp);
        });
      });
      
      // Store cleanup function to call when modal closes
      return cleanup;
    } catch (error) {
      console.error('Error starting message polling:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || loading) return;
    
    try {
      setLoading(true);
      
      // Get user profile for userName
      const { data: profile } = await supabase
        .from('public_user_cards')
        .select('name')
        .eq('uuid', user.id)
        .single();
      
      const message = {
        text: messageText.trim(),
        userId: user.id,
        userName: profile?.name || 'Anonymous',
      };
      
      const sentMessage = await chatUtils.sendMessage(event.id, message, event);
      
      // Add to local messages immediately for better UX (if not already there)
      if (!messageIds.has(sentMessage.id)) {
        setMessages(prev => [...prev, sentMessage]);
        setMessageIds(prev => new Set([...prev, sentMessage.id]));
      }
      
      setMessageText('');
      
    } catch (error) {
      console.error('Error sending message:', error);
      if (error.message.includes('locked')) {
        setChatLocked(true);
        alert('Chat has expired - the event ended over an hour ago.');
      } else {
        alert('Failed to send message. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {showChat ? event?.title : 'Community Guidelines'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {!showChat ? (
          // Community Guidelines view
          <View style={styles.content}>
            <Text style={styles.eventTitle}>{event?.title}</Text>
            
            {/* Guidelines */}
            <ScrollView style={styles.guidelinesContainer}>
              <View style={styles.guidelineItem}>
                <Text style={styles.guidelineEmoji}>🌟</Text>
                <Text style={styles.guidelineText}>
                  <Text style={styles.guidelineBold}>Be welcoming.</Text> This is about making new friends and building community.
                </Text>
              </View>
              
              <View style={styles.guidelineItem}>
                <Text style={styles.guidelineEmoji}>💬</Text>
                <Text style={styles.guidelineText}>
                  <Text style={styles.guidelineBold}>Stay on topic.</Text> Keep conversations related to the event and getting to know each other.
                </Text>
              </View>
              
              <View style={styles.guidelineItem}>
                <Text style={styles.guidelineEmoji}>🤝</Text>
                <Text style={styles.guidelineText}>
                  <Text style={styles.guidelineBold}>Be respectful.</Text> No harassment, spam, or inappropriate content.
                </Text>
              </View>
              
              <View style={styles.guidelineItem}>
                <Text style={styles.guidelineEmoji}>📱</Text>
                <Text style={styles.guidelineText}>
                  <Text style={styles.guidelineBold}>Keep it local.</Text> Focus on connecting with people you'll actually meet at the event.
                </Text>
              </View>
            </ScrollView>

            {/* Join Chat CTA */}
            <TouchableOpacity 
              style={styles.joinChatButton} 
              onPress={handleJoinChat}
            >
              <Text style={styles.joinChatText}>
                Got it, let's chat! 💬
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Chat view
          <KeyboardAvoidingView 
            style={styles.chatContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            {/* Messages area */}
            <ScrollView 
              ref={scrollViewRef}
              style={styles.messagesContainer}
            >
              {loading && messages.length === 0 && (
                <View style={styles.emptyChat}>
                  <Text style={styles.emptyChatText}>Loading messages...</Text>
                </View>
              )}
              {!loading && messages.length === 0 && (
                <View style={styles.emptyChat}>
                  <Text style={styles.emptyChatText}>
                    Be the first to say hi! 🎉
                  </Text>
                </View>
              )}
              {messages.map((message, index) => (
                <View key={`${message.id}-${message.timestamp}-${index}`} style={styles.messageItem}>
                  <View style={styles.messageHeader}>
                    <Text style={[styles.messageSender, { color: getUserColor(message.userId) }]}>
                      {message.userName}
                    </Text>
                    <Text style={styles.messageTime}>
                      {new Date(message.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  </View>
                  <Text style={styles.messageText}>{message.text}</Text>
                </View>
              ))}
              {chatLocked && (
                <View style={styles.lockedMessage}>
                  <Text style={styles.lockedMessageText}>
                    💬 Chat has ended - this event finished over an hour ago
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Message input */}
            <View style={styles.messageInputContainer}>
              <TextInput
                style={styles.messageInput}
                placeholder="Say something nice..."
                placeholderTextColor="#999"
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={200}
              />
              <TouchableOpacity 
                style={[styles.sendButton, (!messageText.trim() || loading || chatLocked) && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!messageText.trim() || loading || chatLocked}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={(messageText.trim() && !loading && !chatLocked) ? colors.secondary : '#ccc'} 
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  guidelinesContainer: {
    flex: 1,
    paddingVertical: 8,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  guidelineEmoji: {
    fontSize: 24,
    marginRight: 16,
    marginTop: 2,
  },
  guidelineText: {
    flex: 1,
    fontSize: 16,
    color: '#444',
    lineHeight: 22,
  },
  guidelineBold: {
    fontWeight: '600',
    color: '#333',
  },
  joinChatButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  joinChatText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyChatText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  messageItem: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 20,
  },
  lockedMessage: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ffc107',
  },
  lockedMessageText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    fontStyle: 'italic',
  },
}); 