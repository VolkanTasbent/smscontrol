// lib/utils/analyze.ts
import { AnalysisResult, RiskLevel } from '../../types';

// YENİ GÜNCELLENMİŞ URL ÇIKARMA FONKSİYONU
export function extractUrls(text: string): string[] {
  // ESKİ: Sadece http/https/www ile başlayanları yakala
  // YENİ: Tüm domain.extension formatını yakala
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+\.[^\s]+)|([a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
  
  const matches = text.match(urlRegex) || [];

  return matches.map(url => {
    // Temizle
    let cleanUrl = url.trim();
    
    // Noktalama işaretlerini kaldır
    cleanUrl = cleanUrl.replace(/[.,!?;:]$/g, '');
    
    // Eğer http/https yoksa ekle
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      // www. ile başlıyorsa https:// ekle
      if (cleanUrl.startsWith('www.')) {
        cleanUrl = 'https://' + cleanUrl;
      } else {
        // Domain.ext formatındaysa http:// ekle
        cleanUrl = 'http://' + cleanUrl;
      }
    }
    
    return cleanUrl;
  }).filter(url => {
    // Geçerli URL kontrolü
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
}

/* =========================
   KONFİGÜRASYON
========================= */

export const OFFICIAL_DOMAINS = [
  'ptt.gov.tr',
  'ptt.com.tr',
  'edevlet.gov.tr',
  'turkiye.gov.tr',
  'gib.gov.tr',
  'garanti.com.tr',
  'garantibbva.com.tr',
  'isbank.com.tr',
  'ziraatbank.com.tr',
  'ziraat.com.tr',
  'yapikredi.com.tr',
  'akbank.com.tr',
  'qnb.com.tr',
  'ing.com.tr',
  'teb.com.tr',
  'turkcell.com.tr',
  'vodafone.com.tr',
  'turktelekom.com.tr',
];

const OFFICIAL_INSTITUTIONS = [
  'ptt',
  'e-devlet',
  'edevlet',
  'garanti',
  'bbva',
  'ziraat',
  'iş bank',
  'yapı kredi',
  'akbank',
  'qnb',
  'ing',
  'teb',
  'turkcell',
  'vodafone',
  'türk telekom',
];

const SHORT_URL_DOMAINS = [
  'bit.ly',
  't.co',
  'tinyurl',
  'cutt.ly',
  'rebrand.ly',
  'is.gd',
  'v.gd',
];

const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.[a-z]{2,})/gi;

export function extractDomains(text: string): string[] {
  const matches = text.match(URL_PATTERN) || [];
  return matches
    .map(link => {
      const m = link.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/i);
      return m ? m[1].toLowerCase() : null;
    })
    .filter(Boolean) as string[];
}

function isOfficialDomain(domain: string): boolean {
  return OFFICIAL_DOMAINS.some(
    o => domain === o || domain.endsWith('.' + o)
  );
}

function isShortUrl(domain: string): boolean {
  return SHORT_URL_DOMAINS.some(s => domain.includes(s));
}

function isSuspiciousDomain(domain: string): boolean {
  return (
    domain.includes('-gov') ||
    domain.includes('gov-') ||
    domain.includes('secure') ||
    domain.includes('support') ||
    domain.includes('online-bank') ||
    domain.includes('verify-login') ||
    /\d/.test(domain)
  );
}

function hasPersonalInfo(text: string): boolean {
  return (
    /\b\d{4}\b/.test(text) ||
    /\b\d+\s*tl\b/i.test(text) ||
    /\b\d{2}:\d{2}\b/.test(text) ||
    /\b\d{2}\/\d{2}\/\d{4}\b/.test(text)
  );
}

/* =========================
   ANA ANALİZ
========================= */

export function analyzeSMS(smsText: string): AnalysisResult {
  const text = smsText.toLowerCase();

  const signals = {
    critical: [] as string[],
    strong: [] as string[],
    weak: [] as string[],
  };

  if (text.includes('icra')) {
    signals.critical.push('İcra tehdidi');
  }

  if (
    (text.includes('hesap') && text.includes('askıya')) ||
    (text.includes('kart') && text.includes('bloke'))
  ) {
    signals.strong.push('Hesap/Kart askıya alma tehdidi');
  }

  if (text.includes('kargo')) {
    signals.weak.push('Kargo ifadesi');
  }

  if (
    text.includes('teslim edilemedi') ||
    text.includes('dağıtıma çıkarılamadı')
  ) {
    signals.strong.push('Gönderi teslim sorunu');
  }

  if (
    text.includes('onayla') ||
    text.includes('doğrula') ||
    text.includes('aktif et')
  ) {
    signals.strong.push('Doğrulama/Onay isteği');
  }

  if (
    text.includes('olağandışı') ||
    text.includes('şüpheli işlem') ||
    text.includes('güvenlik nedeniyle') ||
    text.includes('erişim kısıtlaması')
  ) {
    signals.weak.push('Şüpheli işlem / güvenlik bildirimi');
  }

  const urgencyWords = [
    'hemen',
    'derhal',
    'son uyarı',
    '24 saat',
    'aksi halde',
    'acil',
    'geciktirme',
    'kaçırmayın',
  ];

  if (urgencyWords.some(w => text.includes(w))) {
    signals.strong.push('Aciliyet / baskı dili');
  }

  const domains = extractDomains(text);
  const hasLink = domains.length > 0;

  let hasOfficialLink = false;
  let hasShortLink = false;
  let hasSuspiciousLink = false;

  for (const d of domains) {
    if (isOfficialDomain(d)) {
      hasOfficialLink = true;
      continue;
    }
    if (isShortUrl(d)) hasShortLink = true;
    if (isSuspiciousDomain(d)) hasSuspiciousLink = true;
  }

  if (hasShortLink) signals.critical.push('Kısaltılmış link');
  if (hasSuspiciousLink) signals.critical.push('Sahte domain');
  if (hasLink && !hasOfficialLink)
    signals.strong.push('Resmi olmayan link');

  const mentionsInstitution = OFFICIAL_INSTITUTIONS.some(inst =>
    text.includes(inst)
  );

  if (mentionsInstitution && hasLink && !hasOfficialLink)
    signals.critical.push('Kurum adı + sahte link');

  if (mentionsInstitution && !hasLink && !hasPersonalInfo(text))
    signals.weak.push('Genel kurum mesajı');

  const personalInfo = hasPersonalInfo(text);

  let riskLevel: RiskLevel;

  // Risk seviyesi hesaplama
  if (signals.critical.length > 0) {
    riskLevel = 'fraud';
  } else if (signals.strong.length >= 2) {
    riskLevel = 'fraud';
  } else if (signals.strong.length === 1) {
    riskLevel = 'high';
  } else if (signals.weak.length >= 2) {
    riskLevel = 'medium';
  } else if (signals.weak.length === 1) {
    riskLevel = 'low';
  } else {
    riskLevel = 'safe';
  }

  // Özel durum: Resmi link + kişisel bilgi varsa daha güvenli
  if (riskLevel === 'high' && personalInfo && hasOfficialLink) {
    riskLevel = 'safe';
  }

  let score = 0;
  score += signals.critical.length * 40;
  score += signals.strong.length * 20;
  score += signals.weak.length * 5;
  if (personalInfo) score -= 10;
  if (hasOfficialLink) score -= 15;

  score = Math.max(0, Math.min(100, score));

  const reasons = [
    ...signals.critical,
    ...signals.strong,
    ...signals.weak,
  ].slice(0, 5); // 5 sebep göster

  return { 
    riskLevel, 
    score, 
    reasons,
    metadata: {
      domainCount: domains.length,
      hasOfficialLink,
      hasShortLink,
      hasSuspiciousLink,
      personalInfo,
      criticalSignals: signals.critical.length,
      strongSignals: signals.strong.length,
      weakSignals: signals.weak.length,
      allDomains: domains
    }
  };
}

// TEST FONKSİYONU (opsiyonel)
export function testExtractUrls() {
  const testTexts = [
    "Test: gov-online-bank.com ve https://google.com",
    "www.example.com ve example.org/test",
    "bit.ly/abc ve http://testsafebrowsing.appspot.com"
  ];
  
  testTexts.forEach((text, i) => {
    console.log(`Test ${i + 1}:`, text);
    console.log('Çıkarılan URL\'ler:', extractUrls(text));
    console.log('---');
  });
}