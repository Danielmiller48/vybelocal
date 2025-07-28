import React, { useRef, useState } from 'react';
import { Animated, Dimensions, TouchableOpacity, StyleSheet, ScrollView, View, Share } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import colors from '../theme/colors';

export default function HomeDrawerOverlay() {
  const sheetH = Dimensions.get('window').height * 0.6;
  const peek = 28; // visible portion when closed
  const sheetY = useRef(new Animated.Value(sheetH - peek)).current;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigation = useNavigation();

  const openPos = sheetH * 0.35; // open slightly lower for better balance
  const openSheet = () => {
    Animated.timing(sheetY, { toValue: openPos, duration: 300, useNativeDriver: true }).start();
    setDrawerOpen(true);
  };
  const closeSheet = () => {
    Animated.timing(sheetY, { toValue: sheetH - peek, duration: 300, useNativeDriver: true }).start();
    setDrawerOpen(false);
  };
  const toggleSheet = () => {
    drawerOpen ? closeSheet() : openSheet();
  };

  return (
    <Animated.View style={[styles.container, { height: sheetH, transform: [{ translateY: sheetY }] }]}>
      {/* Handle */}
      <TouchableOpacity
        onPress={toggleSheet}
        style={styles.handleTouch}
        hitSlop={{ top: 16, bottom: 16, left: 20, right: 20 }}
      >
        <View style={styles.handleCircle}>
          <Ionicons
            name="chevron-up-sharp"
            size={28}
            color="#000"
            style={{ transform: [{ rotate: drawerOpen ? '180deg' : '0deg' }] }}
          />
        </View>
      </TouchableOpacity>

      {/* Inner shell */}
      <View style={styles.drawerInner}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 40 }}>
          <View style={{ marginTop: 24 }}>
            {[
              {
                key: 'upcoming',
                label: 'Upcoming Vybes',
                icon: 'sparkles-outline',
                action: () => {
                  closeSheet();
                  navigation.navigate('HomeMain');
                },
              },
              {
                key: 'calendar',
                label: 'View Full Calendar',
                icon: 'calendar-outline',
                action: () => {
                  closeSheet();
                  navigation.navigate('Calendar');
                },
              },
              {
                key: 'past',
                label: 'See Past Vybes',
                icon: 'time-outline',
                action: () => {
                  closeSheet();
                  // TODO: Past vybes implementation
                },
              },
              {
                key: 'invite',
                label: 'Invite to VybeLocal',
                icon: 'share-social-outline',
                action: async () => {
                  closeSheet();
                  await Share.share({ message: 'Join me on VybeLocal! https://vybelocal.com/app' });
                },
              },
              {
                key: 'guidelines',
                label: 'Community Guidelines',
                icon: 'document-text-outline',
                action: () => {
                  closeSheet();
                  navigation.navigate('Guidelines');
                },
              },
            ].map((row) => (
              <TouchableOpacity key={row.key} style={styles.actionRow} onPress={row.action}>
                <Ionicons
                  name={row.icon}
                  size={24}
                  color="#fff"
                  style={{
                    marginRight: 14,
                    textShadowColor: 'rgba(0,0,0,0.15)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                />
                <View>
                  <Animated.Text style={styles.rowText}>{row.label}</Animated.Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'visible',
    zIndex: 20,
    elevation: 20,
  },
  handleTouch: {
    position: 'absolute',
    top: -28,
    alignSelf: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  handleCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.sand,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  drawerInner: {
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
}); 