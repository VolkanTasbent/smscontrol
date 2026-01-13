// types.ts
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'fraud';

export interface AnalysisResult {
  riskLevel: RiskLevel;
  score: number;
  reasons: string[];
  metadata?: {
    urlCount?: number;
    safeBrowsingThreats?: number;
    domainThreats?: number;
    totalThreats?: number;
    allUrls?: string[];
    hasMaliciousUrls?: boolean;
    hasSuspiciousDomains?: boolean;
    batchMethodUsed?: boolean;
    threats?: string[];
    // Diğer metadata alanları
    [key: string]: any;
  };
}