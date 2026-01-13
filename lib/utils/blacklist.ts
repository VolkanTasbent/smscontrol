// lib/utils/blacklist.ts
export function checkUrlBlacklist(url: string): boolean {
  const blacklistedPatterns = [
    /fake-login\./i,
    /phishing-site\./i,
    /malware-download\./i,
    /credit-card-steal\./i,
    /hack-account\./i,
    /steal-password\./i
  ];
  
  return blacklistedPatterns.some(pattern => pattern.test(url));
}