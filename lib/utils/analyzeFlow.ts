// lib/utils/analyzeFlow.ts - TAM DÜZELTMELİ VE DEBUGLU VERSİYON
import { AnalysisResult } from '../../types';
import { analyzeSMS } from './analyze';
import { 
  checkMultipleUrls, 
  extractDomainFromUrl, 
  checkSuspiciousDomain,
  checkSafeBrowsing 
} from './safeBrowsing';

export async function analyzeFlow(
  smsText: string
): Promise<AnalysisResult> {
  console.log('🔍 === SMS ANALİZİ BAŞLIYOR ===');
  console.log('📱 SMS:', smsText);
  
  // 1. ÖNCE TEMEL ANALİZİ DEBUG EDELİM
  console.log('\n📊 1. TEMEL ANALİZ (analyzeSMS ÇIKTISI)');
  const base = analyzeSMS(smsText);
  
  // TEMEL ANALİZİN İÇİNDE NELER OLDUĞUNU GÖRELİM
  console.log('   - riskLevel:', base.riskLevel);
  console.log('   - score:', base.score);
  console.log('   - reasons:', base.reasons);
  
  if (base.metadata) {
    console.log('   - criticalSignals:', base.metadata.criticalSignals);
    console.log('   - strongSignals:', base.metadata.strongSignals);
    console.log('   - weakSignals:', base.metadata.weakSignals);
    console.log('   - allDomains:', base.metadata.allDomains);
  }
  
  // 2. URL ÇIKARMA
  console.log('\n🔗 2. URL ÇIKARMA');
  const { extractUrls } = await import('./analyze');
  const urls = extractUrls(smsText);
  console.log('   - Bulunan URL\'ler:', urls);
  
  // 3. TEHDİT ANALİZİ
  let safeBrowsingThreats = 0;
  let domainThreats = 0;
  let threatDetails: string[] = [];
  
  if (urls.length > 0) {
    console.log('\n⚠️  3. TEHDİT ANALİZİ');
    
    for (const url of urls) {
      console.log(`   🔍 URL analizi: ${url}`);
      
      // Domain kontrolü
      const domain = extractDomainFromUrl(url);
      if (domain) {
        console.log(`     → Domain: ${domain}`);
        const isSuspicious = checkSuspiciousDomain(domain);
        console.log(`     → Şüpheli mi? ${isSuspicious}`);
        
        if (isSuspicious) {
          domainThreats++;
          threatDetails.push(`Şüpheli domain: ${domain}`);
          console.log(`     ⚠️  Şüpheli domain eklendi`);
        }
      }
      
      // Safe Browsing kontrolü (basitleştirilmiş)
      try {
        const result = await checkSafeBrowsing(url);
        if (result.unsafe) {
          safeBrowsingThreats++;
          const threatType = result.threatTypes?.[0] || 'MALWARE';
          const threatDesc = threatType === 'SOCIAL_ENGINEERING' ? 'Phishing' : 'Malware';
          threatDetails.push(`${threatDesc} tespit edildi: ${url}`);
          console.log(`     🚨 Safe Browsing tehdidi: ${threatDesc}`);
        }
      } catch (error) {
        console.log(`     ℹ️  Safe Browsing kontrolü atlandı`);
      }
    }
  }
  
  // 4. YENİ RİSK HESAPLAMA SİSTEMİ
  console.log('\n🎯 4. YENİ RİSK HESAPLAMA SİSTEMİ');
  
  // AŞAMA 1: Temel puanı normalleştir (100 üzerinden çok yüksekse düşür)
  let normalizedBaseScore = base.score;
  
  // Eğer temel puan 50'den fazlaysa, orantılı olarak düşür
  if (normalizedBaseScore > 50) {
    console.log(`   ⚠️  Temel puan çok yüksek (${base.score}), normalleştiriliyor...`);
    normalizedBaseScore = 30 + (base.score / 100) * 20; // 30-50 arasına sıkıştır
    console.log(`   → Normalleştirilmiş puan: ${Math.round(normalizedBaseScore)}`);
  }
  
  // AŞAMA 2: Tehdit puanlarını ekle (AMA MAKUL SEVİYEDE)
  let finalScore = normalizedBaseScore;
  
  // Domain tehditleri: +10 puan (eskiden +20 idi)
  const domainPoints = domainThreats * 10;
  finalScore += domainPoints;
  console.log(`   + Domain tehditleri (${domainThreats} × 10): +${domainPoints} puan`);
  
  // Safe Browsing tehditleri: +20 puan (eskiden +40 idi)
  const sbPoints = safeBrowsingThreats * 20;
  finalScore += sbPoints;
  console.log(`   + Safe Browsing tehditleri (${safeBrowsingThreats} × 20): +${sbPoints} puan`);
  
  // AŞAMA 3: Puanı sınırla (0-100)
  finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));
  console.log(`   📈 Final puan: ${finalScore}/100`);
  
  // 5. YENİ VE DOĞRU RİSK SEVİYESİ TABLOSU
  console.log('\n📊 5. RİSK SEVİYESİ TABLOSU');
  
  let riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'fraud';
  
  // GERÇEKÇİ RİSK DAĞILIMI:
  // 0-15: safe (çok güvenli)
  // 16-35: low (düşük risk)
  // 36-60: medium (orta risk)
  // 61-85: high (yüksek risk)
  // 86-100: fraud (dolandırıcılık)
  
  if (finalScore >= 86) {
    riskLevel = 'fraud';
    console.log(`   → ${finalScore} ≥ 86 → FRAUD (dolandırıcılık)`);
  } else if (finalScore >= 61) {
    riskLevel = 'high';
    console.log(`   → ${finalScore} ≥ 61 → HIGH (yüksek risk)`);
  } else if (finalScore >= 36) {
    riskLevel = 'medium';
    console.log(`   → ${finalScore} ≥ 36 → MEDIUM (orta risk)`);
  } else if (finalScore >= 16) {
    riskLevel = 'low';
    console.log(`   → ${finalScore} ≥ 16 → LOW (düşük risk)`);
  } else {
    riskLevel = 'safe';
    console.log(`   → ${finalScore} < 16 → SAFE (güvenli)`);
  }
  
  // 6. KRİTİK DURUM KONTROLLERİ
  console.log('\n🔐 6. KRİTİK DURUM KONTROLLERİ');
  
  // KRİTİK 1: Hem "icra" hem şüpheli domain varsa → high/fraud
  const hasIcra = smsText.toLowerCase().includes('icra');
  const hasSuspiciousDomain = domainThreats > 0;
  
  if (hasIcra && hasSuspiciousDomain) {
    console.log(`   ⚠️  KRİTİK: "icra" + şüpheli domain tespit edildi`);
    if (riskLevel === 'medium') riskLevel = 'high';
    if (riskLevel === 'low') riskLevel = 'medium';
  }
  
  // KRİTİK 2: Safe Browsing'den phishing/malware varsa → fraud
  const hasMalwarePhishing = threatDetails.some(t => 
    t.includes('Phishing') || t.includes('Malware')
  );
  
  if (hasMalwarePhishing) {
    console.log(`   🚨 KRİTİK: Phishing/Malware tespit edildi → FRAUD`);
    riskLevel = 'fraud';
    finalScore = Math.max(finalScore, 90); // Minimum 90 puan
  }
  
  // 7. SEBEPLERİ HAZIRLA
  console.log('\n📝 7. SEBEP HAZIRLAMA');
  
  const formattedThreats = threatDetails.map(detail => {
    if (detail.includes('Phishing')) return `🎣 ${detail}`;
    if (detail.includes('Malware')) return `🦠 ${detail}`;
    return `⚠️ ${detail}`;
  });
  
  // Temel sebepleri de formatla
  const formattedBaseReasons = base.reasons.map(reason => {
    if (reason.toLowerCase().includes('icra')) return `⚖️ ${reason}`;
    if (reason.toLowerCase().includes('kritik')) return `🚨 ${reason}`;
    if (reason.toLowerCase().includes('sahte')) return `❌ ${reason}`;
    return `• ${reason}`;
  });
  
  // Tüm sebepleri birleştir
  const allReasons = [
    ...formattedThreats,
    ...formattedBaseReasons
  ];
  
  // Eğer çok fazla sebep varsa, en önemlilerini al
  const maxReasons = 5;
  const finalReasons = allReasons.slice(0, maxReasons);
  
  console.log(`   - Toplam sebep: ${allReasons.length}`);
  console.log(`   - Gösterilecek: ${finalReasons.length}`);
  console.log(`   - Sebepler:`, finalReasons);
  
  // 8. SONUÇ
  console.log('\n✅ === ANALİZ SONUCU ===');
  console.log(`   📊 RİSK SEVİYESİ: ${riskLevel.toUpperCase()}`);
  console.log(`   🎯 RİSK PUANI: ${finalScore}/100`);
  console.log(`   🔗 URL SAYISI: ${urls.length}`);
  console.log(`   ⚠️  TEHDİTLER: ${threatDetails.length}`);
  console.log(`   📋 SEBEPLER: ${finalReasons.length} adet`);
  console.log('================================\n');
  
  return {
    riskLevel,
    score: finalScore,
    reasons: finalReasons,
    metadata: {
      ...base.metadata,
      urlCount: urls.length,
      safeBrowsingThreats,
      domainThreats,
      totalThreats: safeBrowsingThreats + domainThreats,
      allUrls: urls,
      threats: threatDetails,
      hasIcraKeyword: hasIcra,
      hasCriticalThreat: hasMalwarePhishing,
      normalizedBaseScore: Math.round(normalizedBaseScore),
      originalBaseScore: base.score,
      finalScoreCalculation: {
        base: Math.round(normalizedBaseScore),
        domainPoints,
        sbPoints,
        total: finalScore
      }
    }
  };
}