// lib/utils/analyzeFlow.ts - GÜNCELLENMİŞ VE DÜZELTİLMİŞ
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
  console.log('🧪 analyzeFlow → Analiz başlatılıyor...');
  
  // 1. TEMEL SMS ANALİZİ
  const base = analyzeSMS(smsText);
  console.log(`📊 Temel analiz: ${base.riskLevel} risk, ${base.score} puan`);
  
  // 2. URL'LERİ ÇIKAR
  const { extractUrls } = await import('./analyze');
  const urls = extractUrls(smsText);
  
  if (urls.length === 0) {
    console.log('✅ URL bulunamadı - Temel analiz sonucunu döndür');
    return base;
  }
  
  console.log(`🔗 ${urls.length} URL bulundu:`, urls);
  
  // 3. TEK SEFERDE TÜM URL'LERİ KONTROL ET
  let safeBrowsingThreats = 0;
  let domainThreats = 0;
  let threatDetails: string[] = [];
  
  try {
    // ÇOKLU URL KONTROLÜ (TEK API ÇAĞRISI)
    console.log(`🔄 ${urls.length} URL Safe Browsing\'e gönderiliyor (TEK SEFERDE)...`);
    
    const batchResults = await checkMultipleUrls(urls);
    
    // 4. DOMAIN ANALİZİ
    console.log(`🔍 ${urls.length} domain analiz ediliyor...`);
    
    urls.forEach(url => {
      const safeBrowsingResult = batchResults[url];
      const domain = extractDomainFromUrl(url);
      
      // Debug: Domain'i göster
      console.log(`   ${url} -> domain: ${domain}`);
      
      // Safe Browsing tehdidi
      if (safeBrowsingResult?.unsafe) {
        safeBrowsingThreats++;
        const threatType = safeBrowsingResult.threatTypes?.[0] || 'MALWARE';
        const threatDesc = threatType === 'SOCIAL_ENGINEERING' ? 'Phishing' : 'Malware';
        threatDetails.push(`${threatDesc} tespit edildi: ${url}`);
      }
      
      // Domain analizi tehdidi
      if (domain) {
        const isSuspicious = checkSuspiciousDomain(domain);
        console.log(`      Şüpheli mi? ${isSuspicious}`);
        
        if (isSuspicious) {
          domainThreats++;
          threatDetails.push(`Şüpheli domain: ${domain} (${url})`);
        }
      }
    });
    
    console.log(`📈 Domain analizi sonuç: ${domainThreats} şüpheli domain`);
    
  } catch (error: any) {
    console.warn('❌ Batch Safe Browsing hatası:', error.message);
    
    // HATA DURUMUNDA: tek tek kontrol et
    console.log('⚠️ Batch başarısız, tek tek kontrol ediliyor...');
    
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
            threatDetails.push(`Şüpheli domain: ${domain} (${url})`);
          }
        }
        
      } catch (singleError: any) {
        console.warn(`Tekil URL kontrol hatası (${url}):`, singleError.message);
        continue;
      }
    }
  }
  
  // 5. RİSK SKORU VE SEVİYESİ HESAPLA
  
  // Başlangıç skoru temel analizden
  let riskScore = base.score;
  
  // Tehditlerden puan ekle:
  // Safe Browsing tehditleri: yüksek risk (+40 puan)
  riskScore += safeBrowsingThreats * 40;
  
  // Domain tehditleri: orta risk (+20 puan)
  riskScore += domainThreats * 20;
  
  // Maksimum 100, minimum 0
  riskScore = Math.max(0, Math.min(100, riskScore));
  
  console.log(`📈 Puan durumu: Temel=${base.score}, +SB=${safeBrowsingThreats*40}, +Domain=${domainThreats*20}, Final=${riskScore}`);
  console.log(`📊 Tehditler: Safe Browsing=${safeBrowsingThreats}, Domain=${domainThreats}, Toplam=${safeBrowsingThreats + domainThreats}`);
  
  // 6. RİSK SEVİYESİNİ HESAPLA (TUTARLI BİR ŞEKİLDE)
  let riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'fraud';
  
  // TEK VE TUTARLI BİR MANTIK KULLAN:
  // Risk seviyesini SADECE final riskScore'a göre belirle
  if (riskScore >= 80) {
    riskLevel = 'fraud';
  } else if (riskScore >= 60) {
    riskLevel = 'high';
  } else if (riskScore >= 40) {
    riskLevel = 'medium';
  } else if (riskScore >= 20) {
    riskLevel = 'low';
  } else {
    riskLevel = 'safe';
  }
  
  // DEBUG: Eski ve yeni risk seviyelerini karşılaştır
  console.log(`🔍 DEBUG: base.riskLevel = ${base.riskLevel}`);
  console.log(`🔍 DEBUG: riskScore = ${riskScore}`);
  console.log(`🔍 DEBUG: Yeni riskLevel = ${riskLevel}`);
  
  // ÖZEL DURUM: Eğer hiç tehdit yoksa ve temel analizde fraud varsa
  // (Bu nadir bir durum, ama temel analizin kritik sinyallerini de dikkate al)
  if (safeBrowsingThreats === 0 && domainThreats === 0) {
    if (base.riskLevel === 'fraud' && riskScore < 80) {
      // Temel analiz fraud diyorsa puanı artır
      riskScore = Math.max(riskScore, 80);
      riskLevel = 'fraud';
      console.log(`⚠️  Özel durum: Temel analiz fraud, tehdit yok ama fraud olarak işaretlendi`);
    } else if (base.riskLevel === 'high' && riskScore < 60) {
      // Temel analiz high diyorsa puanı artır
      riskScore = Math.max(riskScore, 60);
      riskLevel = 'high';
      console.log(`⚠️  Özel durum: Temel analiz high, tehdit yok ama high olarak işaretlendi`);
    }
  }
  
  // 7. SEBEPLERİ BİRLEŞTİR VE FORMATLA
  const formattedThreats = threatDetails.map(detail => {
    if (detail.includes('Phishing')) return `🎣 ${detail}`;
    if (detail.includes('Malware')) return `🦠 ${detail}`;
    if (detail.includes('Şüpheli domain')) return `⚠️ ${detail}`;
    return `⚠️ ${detail}`;
  });
  
  // Sebepleri birleştir (en fazla 5)
  const allReasons = [
    ...formattedThreats,
    ...base.reasons
  ].slice(0, 5);
  
  // Eğer hiç sebep yoksa, risk seviyesine göre genel bir açıklama ekle
  if (allReasons.length === 0) {
    if (riskLevel === 'safe') {
      allReasons.push('✅ Güvenli mesaj - risk bulunamadı');
    } else if (riskLevel === 'low') {
      allReasons.push('⚠️ Düşük risk seviyesi');
    }
  }
  
  console.log(`🎯 Final Sonuç: ${riskLevel} risk, ${riskScore} puan, ${allReasons.length} sebep`);
  
  return {
    riskLevel,
    score: riskScore,
    reasons: allReasons,
    metadata: {
      ...base.metadata,
      urlCount: urls.length,
      safeBrowsingThreats,
      domainThreats,
      totalThreats: safeBrowsingThreats + domainThreats,
      allUrls: urls,
      threats: threatDetails,
      baseRiskLevel: base.riskLevel,
      baseScore: base.score
    }
  };
}