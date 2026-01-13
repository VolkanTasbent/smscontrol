// lib/feedback.ts
import { RiskLevel } from '../types';

interface FeedbackRecord {
  id: string;
  smsHash: string; // SMS'in hash'i (gizlilik için)
  predictedRisk: RiskLevel;
  userFeedback: boolean; // true = dolandırıcılıktı, false = gerçekti
  createdAt: Date;
  ipHash?: string; // Anonim kullanıcı takibi için
  userAgent?: string;
}

// Geçici in-memory storage (üretimde database'e geçin)
const feedbackStore: Map<string, FeedbackRecord> = new Map();

/**
 * SMS içeriğinden hash oluşturur (gizlilik için)
 */
export function hashSMS(smsText: string): string {
  // Basit hash fonksiyonu - üretimde crypto kullanın
  let hash = 0;
  for (let i = 0; i < smsText.length; i++) {
    const char = smsText.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Geri bildirim kaydeder
 */
export async function saveFeedback(
  smsText: string,
  predictedRisk: RiskLevel,
  userFeedback: boolean,
  userAgent?: string
): Promise<void> {
  const smsHash = hashSMS(smsText);
  const ipHash = 'anonymous'; // Gerçekte: hashIP(request.ip)
  
  const record: FeedbackRecord = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    smsHash,
    predictedRisk,
    userFeedback,
    createdAt: new Date(),
    ipHash,
    userAgent,
  };
  
  feedbackStore.set(record.id, record);
  
  // Gerçek veritabanı için:
  // await db.insert(feedback).values(record);
  
  console.log('Geri bildirim kaydedildi:', {
    id: record.id,
    smsHash: smsHash.substring(0, 10) + '...',
    predictedRisk,
    userFeedback,
  });
}

/**
 * Geri bildirim istatistiklerini getirir
 */
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
    
    // Gerçek dolandırıcılık ise ve kullanıcı onayladıysa doğru tahmin
    // Gerçek güvenli ise ve kullanıcı onayladıysa doğru tahmin
    if (
      (level === 'fraud' && record.userFeedback === true) ||
      (level === 'safe' && record.userFeedback === false) ||
      (level === 'suspicious') // Şüpheli için net bir doğruluk kriteri yok
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

/**
 * Analiz kurallarını iyileştirmek için feedback verilerini kullanır
 */
export function getImprovementSuggestions() {
  const records = Array.from(feedbackStore.values());
  const suggestions = [];
  
  // Yanlış pozitifleri bul (güvenli dedik ama dolandırıcılıkmış)
  const falsePositives = records.filter(
    r => r.predictedRisk === 'safe' && r.userFeedback === true
  );
  
  // Yanlış negatifleri bul (dolandırıcılık dedik ama güvenliymiş)
  const falseNegatives = records.filter(
    r => r.predictedRisk === 'fraud' && r.userFeedback === false
  );
  
  if (falsePositives.length > 5) {
    suggestions.push({
      type: 'false_positive',
      count: falsePositives.length,
      message: `${falsePositives.length} mesajı güvenli olarak işaretledik ama kullanıcılar dolandırıcılık olduğunu belirtti. Daha sıkı kurallar gerekebilir.`,
    });
  }
  
  if (falseNegatives.length > 5) {
    suggestions.push({
      type: 'false_negative',
      count: falseNegatives.length,
      message: `${falseNegatives.length} mesajı dolandırıcılık olarak işaretledik ama kullanıcılar gerçek olduğunu belirtti. Bazı kurallar çok agresif olabilir.`,
    });
  }
  
  return suggestions;
}