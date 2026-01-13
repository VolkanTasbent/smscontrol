import 'server-only';

// lib/utils/safeBrowsing.ts

// ==================== ARAYÜZLER ====================
interface SafeBrowsingResult {
  unsafe: boolean;
  threatTypes?: string[];
  platformTypes?: string[];
  cacheDuration?: string;
  error?: string;
}

interface BatchSafeBrowsingResult {
  [url: string]: SafeBrowsingResult;
}

// ==================== YARDIMCI FONKSİYONLAR ====================
function normalizeAndValidateUrl(url: string): { valid: boolean; normalized?: string; error?: string } {
  try {
    let cleanUrl = url.trim();
    
    // Tırnak işaretlerini kaldır
    cleanUrl = cleanUrl.replace(/^["']|["']$/g, '');
    
    // Noktalama işaretlerini kaldır
    cleanUrl = cleanUrl.replace(/[.,!?;:]$/g, '');
    
    // Eğer http/https yoksa EKLE
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'http://' + cleanUrl;
    }
    
    // URL objesi oluşturarak doğrula
    new URL(cleanUrl);
    
    return { valid: true, normalized: cleanUrl };
  } catch (error) {
    return { valid: false, error: 'INVALID_URL' };
  }
}

// IDN domain'leri normalize et (Türkçe karakterler için)
function normalizeIDNDomain(domain: string): string {
  try {
    // IDN domain'leri küçük harfe çevir ve temizle
    return domain.toLowerCase().normalize('NFKC');
  } catch {
    return domain.toLowerCase();
  }
}

// ==================== URL ÇIKARMA ====================
export function extractUrlsFromText(text: string): string[] {
  if (!text) return [];
  
  // Pattern: 
  // 1. http:// veya https:// ile başlayanlar
  // 2. www. ile başlayanlar  
  // 3. domain.extension formatındakiler (gov-online-bank.com gibi)
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+\.[^\s]+)|(\b[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?\b)/gi;
  
  const matches = text.match(urlRegex) || [];
  
  const validUrls: string[] = [];
  
  matches.forEach(match => {
    let cleanMatch = match.trim();
    cleanMatch = cleanMatch.replace(/[.,!?;:]$/g, '');
    
    // www. ile başlıyorsa http:// ekle
    if (cleanMatch.startsWith('www.')) {
      cleanMatch = 'http://' + cleanMatch;
    }
    
    const validation = normalizeAndValidateUrl(cleanMatch);
    if (validation.valid && validation.normalized) {
      validUrls.push(validation.normalized);
    }
  });
  
  return [...new Set(validUrls)];
}

// ==================== ÇOKLU URL KONTROLÜ ====================
export async function checkMultipleUrls(urls: string[]): Promise<BatchSafeBrowsingResult> {
  const API_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  
  if (!API_KEY || API_KEY === 'your_api_key_here') {
    console.warn('⚠️ Safe Browsing: API key bulunamadı');
    const result: BatchSafeBrowsingResult = {};
    urls.forEach(url => {
      result[url] = { 
        unsafe: false, 
        error: 'API_KEY_NOT_FOUND' 
      };
    });
    return result;
  }

  // URL'leri normalize et
  const validatedUrls: { original: string; normalized: string }[] = [];
  const invalidUrls: string[] = [];

  urls.forEach(originalUrl => {
    const validation = normalizeAndValidateUrl(originalUrl);
    
    if (validation.valid && validation.normalized) {
      validatedUrls.push({ 
        original: originalUrl, 
        normalized: validation.normalized 
      });
    } else {
      console.warn(`❌ Geçersiz URL: ${originalUrl}`);
      invalidUrls.push(originalUrl);
    }
  });

  console.log(`🔍 Safe Browsing: ${validatedUrls.length} geçerli URL, ${invalidUrls.length} geçersiz`);

  if (validatedUrls.length === 0) {
    const result: BatchSafeBrowsingResult = {};
    urls.forEach(url => {
      result[url] = { 
        unsafe: false, 
        error: 'NO_VALID_URLS' 
      };
    });
    return result;
  }

  try {
    const requestBody = {
      client: {
        clientId: "smskontrol",
        clientVersion: "1.0.0"
      },
      threatInfo: {
        threatTypes: [
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION"
        ],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: validatedUrls.map(item => ({ url: item.normalized }))
      }
    };

    console.log(`📤 ${validatedUrls.length} URL API'ye gönderiliyor...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    console.log('📡 Safe Browsing HTTP STATUS:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Hatası:', response.status, errorText);
      
      const result: BatchSafeBrowsingResult = {};
      urls.forEach(url => {
        result[url] = { 
          unsafe: false, 
          error: `API_ERROR_${response.status}` 
        };
      });
      return result;
    }

    const data = await response.json();
    
    // SONUÇLARI HAZIRLA
    const result: BatchSafeBrowsingResult = {};
    
    // Tüm geçerli URL'leri safe olarak işaretle
    validatedUrls.forEach(item => {
      result[item.original] = { unsafe: false };
    });
    
    // Geçersiz URL'leri işaretle
    invalidUrls.forEach(url => {
      result[url] = { 
        unsafe: false, 
        error: 'INVALID_URL_FORMAT' 
      };
    });

    // Eşleşen URL'leri tehlikeli olarak işaretle
    if (data.matches && Array.isArray(data.matches)) {
      data.matches.forEach((match: any) => {
        const matchedUrl = match.threat?.url;
        
        // Normalize edilmiş URL'yi bul
        const originalEntry = validatedUrls.find(
          item => item.normalized === matchedUrl
        );
        
        if (originalEntry && result[originalEntry.original]) {
          result[originalEntry.original] = {
            unsafe: true,
            threatTypes: [match.threatType],
            platformTypes: [match.platformType],
            cacheDuration: match.cacheDuration || '300s'
          };
        }
      });
    }

    const unsafeCount = Object.values(result).filter(r => r.unsafe).length;
    console.log(`✅ Kontrol tamamlandı: ${urls.length} URL, ${unsafeCount} tehlikeli`);

    return result;

  } catch (error: any) {
    console.error('❌ Safe Browsing hatası:', error.message);
    
    const result: BatchSafeBrowsingResult = {};
    urls.forEach(url => {
      result[url] = { 
        unsafe: false, 
        error: 'API_CALL_FAILED' 
      };
    });
    return result;
  }
}

// ==================== TEK URL KONTROLÜ ====================
export async function checkSafeBrowsing(url: string): Promise<SafeBrowsingResult> {
  console.log('🔍 Tek URL kontrolü:', url);
  
  // checkMultipleUrls'i kullan (1 URL'lik batch)
  const results = await checkMultipleUrls([url]);
  
  const result = results[url];
  
  if (result) {
    console.log(`✅ Tek URL sonucu: ${url} - ${result.unsafe ? 'Tehlikeli' : 'Güvenli'}`);
    return result;
  }
  
  // URL bulunamazsa
  const foundUrl = Object.keys(results).find(key => 
    key.toLowerCase() === url.toLowerCase()
  );
  
  if (foundUrl) {
    console.log(`⚠️ URL bulundu (case-insensitive): ${foundUrl}`);
    return results[foundUrl];
  }
  
  console.warn(`❌ URL sonucu bulunamadı: ${url}`);
  return { 
    unsafe: false, 
    error: 'RESULT_NOT_FOUND' 
  };
}

// ==================== DOMAIN ANALİZİ ====================
export function checkSuspiciousDomain(domain: string): boolean {
  if (!domain) return false;
  
  // IDN domain'leri normalize et
  const cleanDomain = normalizeIDNDomain(domain.replace(/^www\./, ''));

  // Kısaltılmış URL servisleri
  const shortenerDomains = [
    'bit.ly', 't.co', 'tinyurl.com', 'cutt.ly', 'rebrand.ly',
    'is.gd', 'v.gd', 'shorturl.at', 'ow.ly', 'buff.ly',
    't.ly', 'rb.gy', 'shorte.st', 'adf.ly', 'bc.vc',
    'goo.gl', 'bitly.com', 'bl.ink', 'short.cm', 'clck.ru',
    'shrtco.de', 'tiny.cc', 'soo.gd', 's.id'
  ];

  // GERÇEK RESMİ DOMAİNLER (whitelist)
  const OFFICIAL_DOMAINS = [
    'ptt.gov.tr', 'ptt.com.tr', 'edevlet.gov.tr', 'turkiye.gov.tr',
    'gib.gov.tr', 'garanti.com.tr', 'garantibbva.com.tr', 'isbank.com.tr',
    'ziraatbank.com.tr', 'ziraat.com.tr', 'yapikredi.com.tr', 'akbank.com.tr',
    'qnb.com.tr', 'ing.com.tr', 'teb.com.tr', 'turkcell.com.tr',
    'vodafone.com.tr', 'turktelekom.com.tr'
  ];

  // Resmi domain'leri kontrol et (WHITELIST) - ÖNCE BU!
  const isOfficialDomain = OFFICIAL_DOMAINS.some(official => 
    cleanDomain === official || cleanDomain.endsWith('.' + official)
  );
  
  if (isOfficialDomain) {
    console.log(`✅ Resmi domain: ${domain}`);
    return false; // Resmi domain'ler şüpheli DEĞİL
  }

  // Gov imposter pattern'leri (DÜZELTİLMİŞ)
  const govImposterPatterns = [
    // SADECE "gov-" veya "-gov" ile başlayan/lar
    /^gov[-.][a-z0-9]+\.(com|net|org|info|biz)$/i,           // gov-online-bank.com ✓
    /^[a-z0-9]+[-.]gov\.(com|net|org|info)$/i,               // online-gov.com ✓
    /gov.*\.(com|net|org|info)/i,                            // govphishing.com ✓
    // Türkçe karakterli gov pattern'leri
    /icra[-.].*gov.*\.(com|net|org)/i,                       // icra-ödeme-gov.com ✓
  ];

  // GENİŞLETİLMİŞ Sahte kurum pattern'leri
  const fakeInstitutionPatterns = [
    // PTT ile ilgili sahteler (her yerde "ptt" geçenler)
    /ptt[-.][a-z0-9]+\.(com|net|org|info)$/i,                // ptt-sahte.com ✓
    /[a-z0-9]+[-.]ptt\.(com|net|org|info)$/i,                // kargo-ptt.com ✓
    /ptt.*\.(com|net|org|info)/i,                            // herhangi bir yerde ptt varsa
    
    // Banka/finans sahteleri
    /bank.*\.(com|net|org)/i,                                // online-bank.com ✓
    /garanti.*\.(com|net|org)/i,                             // garanti-login.com ✓
    /bankasi?[-.][a-z0-9]+\.(com|net|org)$/i,                // garanti-bankasi.com ✓
    /finans.*\.(com|net|org)/i,                              // online-finans.com ✓
    
    // Secure login/verify sahteleri
    /secure[-.][a-z0-9]+[-.]login\./i,                       // secure-garanti-login.com ✓
    /secure[-.][a-z0-9]+[-.]verify\./i,                      // secure-bank-verify.com ✓
    /secure.*login.*\.(com|net|org)/i,                       // secure-herhangi-login.com ✓
    /secure.*verify.*\.(com|net|org)/i,                      // secure-account-verify.com ✓
    /login[-.][a-z0-9]+\.(com|net|org)/i,                    // login-secure.com ✓
    /verify[-.][a-z0-9]+\.(com|net|org)/i,                   // verify-account.com ✓
    
    // Payment/ödeme sahteleri
    /pay[-.][a-z0-9]+\.(com|net|org)/i,                      // pay-fast.com ✓
    /payment[-.][a-z0-9]+\.(com|net|org)/i,                  // payment-online.com ✓
    /ödeme.*\.(com|net|org)/i,                               // ödeme-güvenli.com ✓
    /payment.*online.*\.(com|net|org)/i,                     // payment-online-verify.com ✓
    
    // Kargo/teslimat sahteleri
    /kargo.*\.(com|net|org)/i,                               // ptt-kargo.com ✓
    /teslimat.*\.(com|net|org)/i,                            // teslimat-ptt.com ✓
    /delivery.*\.(com|net|org)/i,                            // fast-delivery.com ✓
    
    // Update/account sahteleri
    /update[-.][a-z0-9]+\.(com|net|org)/i,                   // update-account.com ✓
    /account[-.][a-z0-9]+\.(com|net|org)/i,                  // account-verify.com ✓
    
    // E-devlet/edevlet sahteleri
    /edevlet.*\.(com|net|org)/i,                             // edevlet-güvenli.com ✓
    /e[-.]?devlet.*\.(com|net|org)/i,                        // e-devlet-online.com ✓
    
    // Genel güvenlik/security sahteleri
    /security[-.][a-z0-9]+\.(com|net|org)/i,                 // security-login.com ✓
    /güvenlik.*\.(com|net|org)/i,                            // güvenlik-onay.com ✓
    
    // Diğer şüpheli pattern'ler
    /online[-.]bank\.(com|net|org)$/i,                       // online-bank.com ✓
    /fast[-.][a-z0-9]+\.(com|net|org)/i,                     // fast-payment.com ✓
    /quick[-.][a-z0-9]+\.(com|net|org)/i,                    // quick-verify.com ✓
    /instant[-.][a-z0-9]+\.(com|net|org)/i,                  // instant-pay.com ✓
  ];

  // Sayısal domain'ler
  const numericPattern = /^\d{3,}\.(com|net|org|info)$/;
  
  // 1. Kısaltılmış URL mi?
  const isShortener = shortenerDomains.some(shortDomain => 
    cleanDomain === shortDomain || cleanDomain.endsWith('.' + shortDomain)
  );
  
  if (isShortener) {
    console.log(`⚠️ Kısaltılmış domain: ${domain}`);
    return true;
  }

  // 2. Gov imposter mi? (gov.tr hariç)
  const isGovImposter = govImposterPatterns.some(pattern => pattern.test(cleanDomain));
  if (isGovImposter && !cleanDomain.endsWith('.gov.tr')) {
    console.log(`⚠️ Gov imposter domain: ${domain}`);
    return true;
  }

  // 3. Sahte kurum domain'i mi?
  const isFakeInstitution = fakeInstitutionPatterns.some(pattern => pattern.test(cleanDomain));
  if (isFakeInstitution) {
    console.log(`⚠️ Sahte kurum domain: ${domain}`);
    return true;
  }

  // 4. Sayısal domain mi?
  if (numericPattern.test(cleanDomain)) {
    console.log(`⚠️ Sayısal domain: ${domain}`);
    return true;
  }

  // 5. Çok kısa veya tuhaf domain
  const domainParts = cleanDomain.split('.');
  if (domainParts.length >= 2) {
    const mainPart = domainParts[0];
    if (mainPart.length < 3 || /[^a-z0-9-]/i.test(mainPart)) {
      console.log(`⚠️ Tuhaf domain formatı: ${domain}`);
      return true;
    }
  }

  console.log(`✅ Normal domain: ${domain}`);
  return false;
}

// ==================== URL'DEN DOMAIN ÇIKARMA ====================
export function extractDomainFromUrl(url: string): string | null {
  try {
    const validation = normalizeAndValidateUrl(url);
    if (!validation.valid || !validation.normalized) return null;
    
    const parsed = new URL(validation.normalized);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// ==================== SMS ANALİZ FONKSİYONU ====================
export async function analyzeSMSContent(smsText: string): Promise<{
  safe: boolean;
  urls: string[];
  results: BatchSafeBrowsingResult;
  suspiciousDomains: string[];
  summary: string;
}> {
  console.log('📱 SMS Analizi başlatılıyor...');
  
  // URL'leri çıkar
  const urls = extractUrlsFromText(smsText);
  console.log(`🔍 ${urls.length} URL çıkarıldı:`, urls);
  
  if (urls.length === 0) {
    return {
      safe: true,
      urls: [],
      results: {},
      suspiciousDomains: [],
      summary: 'URL bulunamadı'
    };
  }
  
  // TEK SEFERDE tüm URL'leri kontrol et
  const results = await checkMultipleUrls(urls);
  
  // Domain analizi (YENİ FONKSİYONU KULLAN)
  const suspiciousDomains: string[] = [];
  urls.forEach(url => {
    const domain = extractDomainFromUrl(url);
    if (domain) {
      const isSuspicious = checkSuspiciousDomain(domain);
      if (isSuspicious) {
        suspiciousDomains.push(domain);
      }
    }
  });
  
  // Genel güvenlik durumu
  const hasUnsafeUrl = Object.values(results).some(r => r.unsafe);
  const hasSuspiciousDomain = suspiciousDomains.length > 0;
  const safe = !hasUnsafeUrl && !hasSuspiciousDomain;
  
  const summary = safe 
    ? `✅ ${urls.length} URL temiz`
    : `🚨 ${hasUnsafeUrl ? 'Tehlikeli URL' : ''} ${hasSuspiciousDomain ? 'Şüpheli domain' : ''}`.trim();
  
  console.log(`📊 SMS Analizi sonuç: ${safe ? 'GÜVENLİ' : 'RİSKLİ'}`);
  console.log(`   🔗 URL'ler: ${urls.length}`);
  console.log(`   🚨 Tehlikeli URL: ${hasUnsafeUrl ? 'EVET' : 'HAYIR'}`);
  console.log(`   ⚠️  Şüpheli Domain: ${suspiciousDomains.length > 0 ? suspiciousDomains.join(', ') : 'YOK'}`);
  
  return {
    safe,
    urls,
    results,
    suspiciousDomains,
    summary
  };
}

// ==================== BATCH YÖNETİMİ ====================
export function createUrlBatches(urls: string[], batchSize: number = 500): string[][] {
  const batches: string[][] = [];
  
  for (let i = 0; i < urls.length; i += batchSize) {
    batches.push(urls.slice(i, i + batchSize));
  }
  
  console.log(`📦 ${urls.length} URL, ${batches.length} batch'e bölündü`);
  return batches;
}

export async function checkLargeUrlList(urls: string[]): Promise<BatchSafeBrowsingResult> {
  if (urls.length <= 500) {
    return await checkMultipleUrls(urls);
  }
  
  console.log(`📊 Büyük URL listesi: ${urls.length} URL`);
  
  const batches = createUrlBatches(urls);
  const allResults: BatchSafeBrowsingResult = {};
  
  for (let i = 0; i < batches.length; i++) {
    console.log(`🔄 Batch ${i + 1}/${batches.length} işleniyor (${batches[i].length} URL)...`);
    
    try {
      const batchResults = await checkMultipleUrls(batches[i]);
      Object.assign(allResults, batchResults);
      
      // Rate limiting için bekleme
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`❌ Batch ${i + 1} hatası:`, error);
      batches[i].forEach(url => {
        allResults[url] = { 
          unsafe: false, 
          error: 'BATCH_PROCESSING_ERROR' 
        };
      });
    }
  }
  
  console.log(`✅ Tüm batch'ler tamamlandı: ${urls.length} URL kontrol edildi`);
  return allResults;
}

// ==================== TEST FONKSİYONU ====================
export function testDomainPatterns() {
  const testDomains = [
    // BEKLENEN: Şüpheli OLMALI
    'kargo-update-ptt.com',        // ptt pattern ✓
    'secure-garanti-login.com',    // secure-login pattern ✓  
    'pay-fast.com',                // pay pattern ✓
    'secure-login-verify.com',     // secure-verify pattern ✓
    'online-bank-payment.com',     // bank pattern ✓
    'ödeme-güvenli.com',           // ödeme pattern ✓
    
    // BEKLENEN: Şüpheli OLMAMALI
    'ptt.gov.tr',                  // resmi domain ✗
    'ptt.com.tr',                  // resmi domain ✗
    'google.com',                  // normal domain ✗
    'github.com',                  // normal domain ✗
  ];
  
  console.log('🧪 Domain Pattern Testleri');
  console.log('─'.repeat(60));
  
  testDomains.forEach(domain => {
    const result = checkSuspiciousDomain(domain);
    console.log(`${result ? '⚠️' : '✅'} ${domain} -> ${result ? 'Şüpheli' : 'Normal'}`);
  });
}