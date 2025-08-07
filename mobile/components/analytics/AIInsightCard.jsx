import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
const { generateAIInsight } = require('../../utils/aiInsights');

/**
 * AI Insight Card Component
 * Displays AI-generated insights for analytics charts
 */
const AIInsightCard = ({ 
  chartType, 
  chartData, 
  context = {},
  style = {} 
}) => {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInsight = async () => {
      try {
        setLoading(true);
        const result = await generateAIInsight(chartType, chartData, context);
        setInsight(result);
      } catch (error) {
        console.error('Failed to load AI insight:', error);
        setInsight({
          message: "Unable to generate insights at this time.",
          recommendation: "Please try again later.",
          icon: 'alert-circle',
          color: '#6b7280',
          confidence: 0
        });
      } finally {
        setLoading(false);
      }
    };

    if (chartData && chartType) {
      loadInsight();
    }
  }, [chartType, chartData, context]);

  if (loading) {
    return (
      <View style={[{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }, style]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons 
            name="hourglass" 
            size={20} 
            color="#6b7280" 
            style={{ marginRight: 12 }} 
          />
          <Text style={{ 
            fontSize: 14, 
            color: '#6b7280', 
            fontStyle: 'italic' 
          }}>
            Generating AI insights...
          </Text>
        </View>
      </View>
    );
  }

  if (!insight) {
    return null;
  }

  return (
    <View style={[{
      backgroundColor: 'white',
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      borderLeftWidth: 4,
      borderLeftColor: insight.color || '#3b82f6',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Ionicons 
          name={insight.icon || 'bulb'} 
          size={20} 
          color={insight.color || '#3b82f6'} 
          style={{ marginRight: 12, marginTop: 2 }} 
        />
        <View style={{ flex: 1 }}>
          <Text style={{ 
            fontSize: 14, 
            color: '#1f2937', 
            marginBottom: 8,
            lineHeight: 20 
          }}>
            {insight.message}
          </Text>
          <Text style={{ 
            fontSize: 13, 
            color: insight.color || '#3b82f6', 
            fontWeight: '500',
            lineHeight: 18 
          }}>
            💡 {insight.recommendation}
          </Text>
          
          {/* Optional: Show confidence indicator */}
          {insight.confidence !== undefined && insight.confidence < 0.7 && (
            <Text style={{
              fontSize: 11,
              color: '#9ca3af',
              marginTop: 4,
              fontStyle: 'italic'
            }}>
              Confidence: {(insight.confidence * 100).toFixed(0)}%
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

export default AIInsightCard;