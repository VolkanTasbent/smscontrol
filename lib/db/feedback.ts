// lib/db/feedback.ts
import { RiskLevel } from '../../types';

interface FeedbackRecord {
  id: string;
  smsHash: string;
  predictedRisk: RiskLevel;
  userFeedback: boolean;
  createdAt: Date;
}

const feedbackStore: Map<string, FeedbackRecord> = new Map();

export function hashSMS(smsText: string): string {
  let hash = 0;
  for (let i = 0; i < smsText.length; i++) {
    const char = smsText.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export async function saveFeedback(
  smsText: string,
  predictedRisk: RiskLevel,
  userFeedback: boolean
): Promise<void> {
  const smsHash = hashSMS(smsText);
  
  const record: FeedbackRecord = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    smsHash,
    predictedRisk,
    userFeedback,
    createdAt: new Date(),
  };
  
  feedbackStore.set(record.id, record);
  
  console.log('Geri bildirim kaydedildi:', {
    id: record.id,
    smsHash: smsHash.substring(0, 10) + '...',
    predictedRisk,
    userFeedback,
  });
}

export async function getFeedbackStats(): Promise<{
  total: number;
  correctPredictions: number;
  accuracy: number;
  byRiskLevel: Record<RiskLevel, { total: number; correct: number }>;
}> {
  const records = Array.from(feedbackStore.values());
  const total = records.length;
  
  let correctPredictions = 0;
  const byRiskLevel: Record<RiskLevel, { total: number; correct: number }> = {
    fraud: { total: 0, correct: 0 },
    suspicious: { total: 0, correct: 0 },
    safe: { total: 0, correct: 0 },
  };
  
  records.forEach(record => {
    const level = record.predictedRisk;
    byRiskLevel[level].total++;
    
    if (
      (level === 'fraud' && record.userFeedback === true) ||
      (level === 'safe' && record.userFeedback === false) ||
      (level === 'suspicious')
    ) {
      correctPredictions++;
      byRiskLevel[level].correct++;
    }
  });
  
  const accuracy = total > 0 ? (correctPredictions / total) * 100 : 0;
  
  return {
    total,
    correctPredictions,
    accuracy: parseFloat(accuracy.toFixed(2)),
    byRiskLevel,
  };
}