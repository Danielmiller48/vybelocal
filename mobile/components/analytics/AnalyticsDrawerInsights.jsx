import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
const { generateAIInsight } = require('../../utils/aiInsights');

/**
 * AI-powered insights for the main analytics drawer
 * Analyzes overall performance metrics and provides strategic recommendations
 */
const AnalyticsDrawerInsights = ({ analytics }) => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateAnalyticsInsights();
  }, [analytics]);

  const generateAnalyticsInsights = () => {
    if (!analytics) return;

    setLoading(true);
    const quickInsights = [];

    // Generate quick insights using fallback logic for speed and variety
    if (analytics.avgSellOutSpeed > 0 && analytics.avgSellOutSpeed < 24) {
      quickInsights.push({
        message: `Events sell out in ${analytics.avgSellOutSpeed.toFixed(1)} hours - killer demand!`,
        recommendation: 'Consider raising prices by $3-5 or booking bigger venues to capture more revenue. You could also try hosting multiple sessions of the same event. This level of demand means you\'re leaving money on the table.',
        icon: 'trending-up',
        color: '#10b981'
      });
    } else if (analytics.avgSellOutSpeed > 168) {
      quickInsights.push({
        message: `Takes ${(analytics.avgSellOutSpeed/24).toFixed(1)} days to sell out.`,
        recommendation: 'Start promoting earlier and create more urgency around your events. Try early bird pricing or limited-time offers to accelerate bookings. Consider improving your event descriptions to better highlight the value.',
        icon: 'time',
        color: '#f59e0b'
      });
    }

    if (analytics.repeatGuestRate > 0.3) {
      quickInsights.push({
        message: `${(analytics.repeatGuestRate * 100).toFixed(1)}% repeat guests - building community!`,
        recommendation: 'Launch a loyalty program or VIP perks to reward your regulars. Consider exclusive pre-sale access or member-only events. Your community is your biggest asset - nurture these relationships.',
        icon: 'heart',
        color: '#ec4899'
      });
    } else if (analytics.repeatGuestRate < 0.15 && analytics.totalEvents > 3) {
      quickInsights.push({
        message: `Only ${(analytics.repeatGuestRate * 100).toFixed(1)}% repeat guests.`,
        recommendation: 'Focus on post-event follow-up and building deeper connections with attendees. Send thank you messages, create group chats, or host casual meetups. Work on making your events more memorable and community-focused.',
        icon: 'person-add',
        color: '#8b5cf6'
      });
    }

    if (analytics.refundRate > 0.15) {
      quickInsights.push({
        message: `${(analytics.refundRate * 100).toFixed(1)}% refund rate is high.`,
        recommendation: 'Tighten your refund window to 24-48 hours or improve event descriptions for clarity. High refunds often mean unclear expectations or last-minute changes. Consider requiring a small non-refundable deposit to reduce frivolous bookings.',
        icon: 'warning',
        color: '#ef4444'
      });
    }

    if (analytics.revenuePerAttendee > 0 && analytics.revenuePerAttendee < 10) {
      quickInsights.push({
        message: `$${analytics.revenuePerAttendee.toFixed(2)} per person - room to grow.`,
        recommendation: 'Add merchandise, premium tiers, or upsells to increase per-person value. Consider bundling experiences or offering VIP packages. Even small add-ons like branded items or exclusive content can boost revenue significantly.',
        icon: 'cash',
        color: '#06b6d4'
      });
    }

    if (analytics.capacityFillRate < 0.4 && analytics.capacityFillRate > 0) {
      quickInsights.push({
        message: 'Capacity fill rate below 40%.',
        recommendation: 'Try booking smaller, more intimate venues to create better atmosphere and reduce costs. A packed smaller space feels more energetic than a half-empty large one. This also improves your profit margins and creates FOMO for future events.',
        icon: 'contract',
        color: '#f97316'
      });
    }

    if (analytics.peakRsvpDay && analytics.peakRsvpDay.includes('day before')) {
      quickInsights.push({
        message: `Most RSVPs happen ${analytics.peakRsvpDay}.`,
        recommendation: 'Start promoting 2-3 days earlier to capture peak booking interest. Post reminder content and create urgency around limited spots. Consider last-minute pricing strategies to capitalize on this booking pattern.',
        icon: 'time-outline',
        color: '#84cc16'
      });
    }

    // Always show at least one insight for new hosts
    if (analytics.totalEvents < 3) {
      quickInsights.push({
        message: 'Just getting started! More events unlock deeper insights.',
        recommendation: 'Host 2-3 more events to establish patterns and unlock meaningful analytics. Focus on consistency and learning what works for your audience. Each event teaches you something valuable about your community.',
        icon: 'rocket',
        color: '#3b82f6'
      });
    }

    // Limit to 3-4 insights max and ensure variety
    const limitedInsights = quickInsights.slice(0, 4);
    setInsights(limitedInsights);
    setLoading(false);
  };

  const InsightCard = ({ insight, recommendation, type = 'info', icon, color }) => {
    const getTypeStyle = (type) => {
      switch (type) {
        case 'success':
          return { borderColor: '#10b981', iconColor: '#10b981' };
        case 'warning':
          return { borderColor: '#f59e0b', iconColor: '#f59e0b' };
        case 'info':
        default:
          return { borderColor: '#3b82f6', iconColor: '#3b82f6' };
      }
    };

    const typeStyle = getTypeStyle(type);
    const borderColor = color || typeStyle.borderColor;
    const iconColor = color || typeStyle.iconColor;

    return (
      <View style={{
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
        borderLeftWidth: 3,
        borderLeftColor: borderColor,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Ionicons 
            name={icon || 'bulb'} 
            size={18} 
            color={iconColor} 
            style={{ marginRight: 10, marginTop: 1 }} 
          />
          <View style={{ flex: 1 }}>
            <Text style={{ 
              fontSize: 13, 
              color: '#1f2937', 
              marginBottom: 4,
              lineHeight: 16,
              fontWeight: '500'
            }}>
              {insight}
            </Text>
            <Text style={{ 
              fontSize: 11, 
              color: iconColor, 
              fontWeight: '600',
              lineHeight: 14 
            }}>
              💡 {recommendation}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ marginTop: 16 }}>
        <InsightCard
          insight="Analyzing your event performance..."
          recommendation="AI insights loading..."
          type="info"
          icon="hourglass"
        />
      </View>
    );
  }

  if (!insights.length) {
    return (
      <View style={{ marginTop: 16 }}>
        <InsightCard
          insight="Keep hosting events to unlock personalized insights!"
          recommendation="More data means better recommendations."
          type="info"
          icon="rocket"
        />
      </View>
    );
  }

  return (
    <View style={{ marginTop: 16 }}>
      {insights.map((insight, index) => (
        <InsightCard
          key={index}
          insight={insight.message}
          recommendation={insight.recommendation}
          icon={insight.icon}
          color={insight.color}
        />
      ))}
    </View>
  );
};

export default AnalyticsDrawerInsights;