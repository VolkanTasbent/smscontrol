// lib/utils/analyzeFlow.ts - TAM DÜZELTMELİ VERSİYON
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
  console.log('🔍 analyzeFlow → Analiz başlatılıyor...');
  
  // 1. TEMEL SMS ANALİZİ
  const base = analyzeSMS(smsText);
  console.log(`📊 Temel analiz: ${base.riskLevel} risk, ${base.score} puan`);
  console.log(`📋 Temel sebepler:`, base.reasons);
  
  // 2. URL'LERİ ÇIKAR
  const { extractUrls } = await import('./analyze');
  const urls = extractUrls(smsText);
  
  if (urls.length === 0) {
    console.log('✅ URL bulunamadı');
    return {
      ...base,
      metadata: {
        ...base.metadata,
        urlCount: 0,
        totalThreats: 0,
        allUrls: []
      }
    };
  }
  
  console.log(`🔗 ${urls.length} URL bulundu:`, urls);
  
  // 3. URL ANALİZİ
  let safeBrowsingThreats = 0;
  let domainThreats = 0;
  let threatDetails: string[] = [];
  
  // URL analizi yap (batch veya tekil)
  if (urls.length > 0) {
    try {
      // Önce batch kontrolü dene
      const batchResults = await checkMultipleUrls(urls);
      
      // Her URL için analiz yap
      for (const url of urls) {
        const safeBrowsingResult = batchResults[url];
        const domain = extractDomainFromUrl(url);
        
        // Safe Browsing kontrolü
        if (safeBrowsingResult?.unsafe) {
          safeBrowsingThreats++;
          const threatType = safeBrowsingResult.threatTypes?.[0] || 'MALWARE';
          const threatDesc = threatType === 'SOCIAL_ENGINEERING' ? 'Phishing' : 'Malware';
          threatDetails.push(`${threatDesc} tespit edildi: ${url}`);
        }
        
        // Domain kontrolü
        if (domain) {
          const isSuspicious = checkSuspiciousDomain(domain);
          if (isSuspicious) {
            domainThreats++;
            threatDetails.push(`Şüpheli domain: ${domain}`);
          }
        }
      }
    } catch (error: any) {
      console.warn('Batch hatası, tekil kontrol:', error.message);
      
      // Batch başarısızsa tekil kontrol
      for (const url of urls) {
        try {
          const result = await checkSafeBrowsing(url);
          if (result.unsafe) {
            safeBrowsingThreats++;
            const threatType = result.threatTypes?.[0] || 'MALWARE';
            const threatDesc = threatType === 'SOCIAL_ENGINEERING' ? 'Phishing' : 'Malware';
            threatDetails.push(`${threatDesc} tespit edildi: ${url}`);
          }
          
          const domain = extractDomainFromUrl(url);
          if (domain) {
            const isSuspicious = checkSuspiciousDomain(domain);
            if (isSuspicious) {
              domainThreats++;
              threatDetails.push(`Şüpheli domain: ${domain}`);
            }
          }
        } catch (singleError) {
          console.warn(`URL kontrol hatası: ${url}`, singleError);
        }
      }
    }
  }
  
  // 4. RİSK HESAPLAMA (YENİ VE TUTARLI MANTIK)
  console.log('\n🎯 RİSK HESAPLAMA:');
  console.log(`   - Temel puan: ${base.score}`);
  console.log(`   - Domain tehditleri: ${domainThreats}`);
  console.log(`   - Safe Browsing tehditleri: ${safeBrowsingThreats}`);
  
  // YENİ PUAN HESAPLAMA MANTIĞI
  let finalScore = base.score;
  
  // Tehdit puanlarını EKLE (eskiden olduğu gibi)
  finalScore += domainThreats * 15;      // Domain tehdidi: +15 puan
  finalScore += safeBrowsingThreats * 30; // Safe Browsing tehdidi: +30 puan
  
  // PUANI SINIRLA: 0-100 arası
  finalScore = Math.max(0, Math.min(100, finalScore));
  
  console.log(`   - Hesaplanan puan: ${finalScore}`);
  
  // 5. RİSK SEVİYESİ BELİRLEME (PUANA GÖRE - BU KRİTİK KISIM)
  let riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'fraud';
  
  // TUTARLI MANTIK: SADECE PUANA BAK
  if (finalScore >= 80) {
    riskLevel = 'fraud';
    console.log(`   → Puan ${finalScore} >= 80 → fraud`);
  } else if (finalScore >= 60) {
    riskLevel = 'high';
    console.log(`   → Puan ${finalScore} >= 60 → high`);
  } else if (finalScore >= 40) {
    riskLevel = 'medium';
    console.log(`   → Puan ${finalScore} >= 40 → medium`);
  } else if (finalScore >= 20) {
    riskLevel = 'low';
    console.log(`   → Puan ${finalScore} >= 20 → low`);
  } else {
    riskLevel = 'safe';
    console.log(`   → Puan ${finalScore} < 20 → safe`);
  }
  
  // ÖZEL DURUM: Eğer Safe Browsing'den MALWARE veya PHISHING varsa, riski artır
  const hasCriticalThreat = threatDetails.some(t => 
    t.includes('Phishing') || t.includes('Malware')
  );
  
  if (hasCriticalThreat && riskLevel !== 'fraud') {
    riskLevel = 'fraud';
    console.log(`   → Kritik tehdit (malware/phishing) tespit edildi → fraud`);
  }
  
  // 6. SEBEPLERİ BİRLEŞTİR
  const formattedThreats = threatDetails.map(detail => {
    if (detail.includes('Phishing')) return `🎣 ${detail}`;
    if (detail.includes('Malware')) return `🦠 ${detail}`;
    return `⚠️ ${detail}`;
  });
  
  // Tüm sebepleri birleştir (max 5)
  const allReasons = [
    ...formattedThreats,
    ...base.reasons
  ].slice(0, 5);
  
  // Eğer hiç sebep yoksa, genel bir açıklama ekle
  if (allReasons.length === 0) {
    if (riskLevel === 'safe') {
      allReasons.push('✅ Güvenli mesaj');
    } else {
      allReasons.push(`⚠️ ${riskLevel} risk seviyesi`);
    }
  }
  
  // 7. SONUÇ
  console.log('\n✅ ANALİZ SONUCU:');
  console.log(`   - Risk Seviyesi: ${riskLevel}`);
  console.log(`   - Risk Puanı: ${finalScore}/100`);
  console.log(`   - Sebepler: ${allReasons.length} adet`);
  console.log(`   - URL Sayısı: ${urls.length}`);
  console.log(`   - Tehditler: ${threatDetails.length}`);
  
  return {
    riskLevel,
    score: finalScore,
    reasons: allReasons,
    metadata: {
      ...base.metadata,
      urlCount: urls.length,
      safeBrowsingThreats,
      domainThreats,
      totalThreats: safeBrowsingThreats + domainThreats,
      allUrls: urls,
      threats: threatDetails,
      hasCriticalThreat,
      baseRiskLevel: base.riskLevel, // Debug için
      baseScore: base.score          // Debug için
    }
  };
}