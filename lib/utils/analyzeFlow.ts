// lib/utils/analyzeFlow.ts - GÜNCELLENMİŞ
import { AnalysisResult } from '../../types';
import { analyzeSMS } from './analyze';
import { 
  checkMultipleUrls, 
  extractDomainFromUrl, 
  checkSuspiciousDomain,  // YENİ FONKSİYON
  checkSafeBrowsing 
} from './safeBrowsing';

export async function analyzeFlow(
  smsText: string
): Promise<AnalysisResult> {
  console.log('🧪 analyzeFlow → Analiz başlatılıyor...');
  
  // 1. TEMEL SMS ANALİZİ
  const base = analyzeSMS(smsText);
  console.log(`📊 Temel analiz: ${base.riskLevel} risk, ${base.score} puan`);
  
  // 2. URL'LERİ ÇIKAR (safeBrowsing'den DEĞİL, analyze'den)
  const { extractUrls } = await import('./analyze');
  const urls = extractUrls(smsText);
  
  if (urls.length === 0) {
    console.log('✅ URL bulunamadı');
    return base;
  }
  
  console.log(`🔗 ${urls.length} URL bulundu:`, urls);
  
  // 3. TEK SEFERDE TÜM URL'LERİ KONTROL ET
  let safeBrowsingThreats = 0;
  let domainThreats = 0;
  let threatDetails: string[] = [];
  
  try {
    // ÇOKLU URL KONTROLÜ (TEK API ÇAĞRISI)
    console.log(`🔄 ${urls.length} URL Safe Browsing'e gönderiliyor (TEK SEFERDE)...`);
    
    const batchResults = await checkMultipleUrls(urls);
    
    // 4. DOMAIN ANALİZİ (YENİ FONKSİYONU KULLAN)
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
      
      // Domain analizi tehdidi (YENİ checkSuspiciousDomain)
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
  
  // 5. TEHDİT VARSA RİSK SEVİYESİNİ ARTIR
  const totalThreats = safeBrowsingThreats + domainThreats;
  
  // Risk puanını hesapla
  let riskScore = base.score;
  
  // Safe Browsing tehditleri: yüksek risk
  riskScore += safeBrowsingThreats * 40;
  
  // Domain tehditleri: orta risk
  riskScore += domainThreats * 20;
  
  // Maksimum 100, minimum 0
  riskScore = Math.max(0, Math.min(100, riskScore));
  
  console.log(`📈 Puan durumu: Temel=${base.score}, +SB=${safeBrowsingThreats*40}, +Domain=${domainThreats*20}, Final=${riskScore}`);
  console.log(`📊 Tehditler: Safe Browsing=${safeBrowsingThreats}, Domain=${domainThreats}, Toplam=${totalThreats}`);
  
  // Risk seviyesini belirle
  let riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'fraud';
  
  if (totalThreats > 0) {
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
  } else {
    // Tehdit yoksa temel analizin riskLevel'ını kullan
    riskLevel = base.riskLevel;
  }
  
  // Sebepleri birleştir
  const formattedThreats = threatDetails.map(detail => {
    if (detail.includes('Phishing')) return `🎣 ${detail}`;
    if (detail.includes('Malware')) return `🦠 ${detail}`;
    return `⚠️ ${detail}`;
  });
  
  const allReasons = [
    ...formattedThreats,
    ...base.reasons
  ].slice(0, 5);
  
  console.log(`🎯 Final: ${riskLevel} risk, ${riskScore} puan, ${totalThreats} tehdit`);
  
  return {
    riskLevel,
    score: riskScore,
    reasons: allReasons,
    metadata: {
      ...base.metadata,
      urlCount: urls.length,
      safeBrowsingThreats,
      domainThreats,
      totalThreats,
      allUrls: urls,
      threats: threatDetails
    }
  };
}