// lib/utils/phishingCheck.ts
export function checkPhishingKeywords(text: string): {
  hasPhishing: boolean;
  keywords: string[];
  score: number;
} {
  const phishingKeywords = [
    'şifrenizi girin',
    'hesabınızı güncelleyin',
    'ödeme yapın',
    'kart bilgileriniz',
    'güvenlik nedeniyle',
    'hesabınız askıya alındı',
    'acil müdahale',
    'son 24 saat',
    'sınırlı süre',
    'bedava hediye',
    'kazandınız',
    'ödülünüz',
    'bloke olacak',
    'askıya alınacak'
  ];
  
  const foundKeywords = phishingKeywords.filter(keyword => 
    text.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return {
    hasPhishing: foundKeywords.length > 0,
    keywords: foundKeywords,
    score: foundKeywords.length * 10
  };
}