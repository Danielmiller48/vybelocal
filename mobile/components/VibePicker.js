import React, { useRef, useMemo } from 'react';
import { Animated, Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Visual constants
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Desired layout: show ~2.8 pills on screen for bigger size
const PILL_MARGIN = 4;
const SPACER_WIDTH = 12;

// Compute new item width so 2.8 full items fit with peeks
const ITEM_TOTAL = (SCREEN_WIDTH - 2 * SPACER_WIDTH) / 2.8;
const PILL_WIDTH = ITEM_TOTAL - PILL_MARGIN * 2;
const PILL_HEIGHT = 42;

// Amount we need to subtract from contentOffset so that a pill's left edge aligns with screen centre
const CENTER_SHIFT = (SCREEN_WIDTH - ITEM_TOTAL) / 2;

const COLORS = {
  all:  ['#f0d89e', '#faebd0'],        // sand pastel → lighter
  active:['#ffbc8b', '#ffd9b6'],      // soft orange → lighter
  creative:['#e8b0d4', '#f4d4e8'],    // pastel magenta → lighter
  hype:['#9fb4e5', '#c9d3f3'],        // pastel indigo → lighter
  chill:['#b5ccb5', '#d7e3d7'],       // pastel sage → lighter
};

export default function VibePicker({ active, onChange, translateY = new Animated.Value(0) }) {
  const vibes = ['all', 'active', 'creative', 'hype', 'chill'];
  const scrollX = useRef(new Animated.Value(0)).current;

  // ----- infinite wheel setup -----
  const COPIES = 20; // number of times to repeat the vibe list
  const TOTAL_ITEMS = vibes.length * COPIES;

  const data = useMemo(() => {
    const arr = [];
    for (let c = 0; c < COPIES; c++) {
      for (let i = 0; i < vibes.length; i++) {
        arr.push({ vibe: vibes[i], key: `${vibes[i]}-${c}-${i}` });
      }
    }
    return arr;
  }, []);

  const listRef = useRef(null);

  // Helper to invoke scrollToOffset safely across both FlatList and Animated.FlatList refs
  const safeScrollToOffset = (params) => {
    if (!listRef.current) return;
    if (typeof listRef.current.scrollToOffset === 'function') {
      listRef.current.scrollToOffset(params);
    } else if (
      typeof listRef.current.getNode === 'function' &&
      typeof listRef.current.getNode() === 'object' &&
      typeof listRef.current.getNode().scrollToOffset === 'function'
    ) {
      listRef.current.getNode().scrollToOffset(params);
    }
  };

  // Helper to compute offset for a given logical index (within one copy) so we always land in the middle copy
  const scrollToLogicalIndex = (logicalIdx, animated = true) => {
    const middleCopyStart = Math.floor(COPIES / 2) * vibes.length;
    const absoluteIdx = middleCopyStart + logicalIdx; // keep in middle copy
    const offset = SPACER_WIDTH + absoluteIdx * ITEM_TOTAL - CENTER_SHIFT;
    safeScrollToOffset({ offset, animated });
  };

  // keep list centered on active vibe when prop changes
  React.useEffect(() => {
    const idx = vibes.indexOf(active);
    if (idx >= 0) scrollToLogicalIndex(idx, true);
  }, [active]);

  return (
    <Animated.View style={[styles.outer, { transform: [{ translateY }] }]}>      
      <Animated.FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => item.key}
        horizontal
        bounces={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_TOTAL}
        snapToAlignment="center"
        decelerationRate="fast"
        contentContainerStyle={{ alignItems: 'center', paddingHorizontal: SPACER_WIDTH }}
        onMomentumScrollEnd={(ev) => {
          const offset = ev.nativeEvent.contentOffset.x;
          const index = Math.round((offset + CENTER_SHIFT - SPACER_WIDTH) / ITEM_TOTAL);

          // Normalised vibe index (0..vibes.length-1)
          const logicalIdx = ((index % vibes.length) + vibes.length) % vibes.length;

          if (vibes[logicalIdx] !== active) {
            onChange(vibes[logicalIdx]);
          }

          // recentre when near ends to maintain infinite illusion
          if (index <= vibes.length || index >= TOTAL_ITEMS - vibes.length) {
            scrollToLogicalIndex(logicalIdx, false);
          }
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        renderItem={({ item, index }) => {
          // all items have same width now; no spacer views needed

          const realIdx = index;
          const centerOffset = SPACER_WIDTH + realIdx * ITEM_TOTAL - CENTER_SHIFT;
          const inputRange = [
            centerOffset - ITEM_TOTAL,
            centerOffset,
            centerOffset + ITEM_TOTAL,
          ];
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.8, 1, 0.8],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.7, 1, 0.7],
            extrapolate: 'clamp',
          });

          const vibe = item.vibe;
          const isActive = active === vibe;
          const gradient = COLORS[vibe];
          const fillColor = gradient[0];
          const textColor = '#222';
          const shadowStyle = isActive ? {
            shadowColor: COLORS[vibe],
            shadowOpacity:0.8,
            shadowRadius:6,
            shadowOffset:{ width:0, height:0 },
            elevation:6,
          } : {};
          // solid fill now; gradient removed

          return (
            <Animated.View style={{ width: PILL_WIDTH, marginHorizontal: PILL_MARGIN, alignItems: 'center' }}>
              <AnimatedTouchableOpacity
                activeOpacity={0.8}
                onPress={() => onChange(vibe)}
                style={[{ width: '100%', height: PILL_HEIGHT, transform:[{scale}], opacity, backgroundColor: fillColor, borderRadius:32, justifyContent:'center', alignItems:'center', paddingHorizontal:14 }, shadowStyle]}
              >
                <Text
                  style={{
                    color: textColor,
                    textTransform: 'capitalize',
                    fontWeight: '600',
                    fontFamily: 'SpaceGrotesk',
                    fontSize: 17,
                  }}
                >
                  {vibe}
                </Text>
              </AnimatedTouchableOpacity>
            </Animated.View>
          );
        }}
      />
    </Animated.View>
  );
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 8,
  },
  pill: {
    borderRadius:32,
    overflow:'hidden',
  },
}); 