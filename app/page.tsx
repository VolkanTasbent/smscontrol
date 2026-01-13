'use client';

import { useState } from 'react';
import { AnalysisResult } from '@/types';

export default function HomePage() {
  const [smsText, setSmsText] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!smsText.trim()) {
      setError('Lütfen SMS metnini girin');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ smsText }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Analiz başarısız');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // HATA DÜZELTMESİ: riskLevel undefined olabilir, kontrol et
  const getRiskLabel = (riskLevel?: string) => {
    if (!riskLevel) return 'BELİRLENEMEDİ';
    
    switch (riskLevel.toLowerCase()) {
      case 'fraud':
        return 'DOLANDIRICILIK';
      case 'high':
        return 'YÜKSEK RİSK';
      case 'medium':
        return 'ORTA RİSK';
      case 'low':
        return 'DÜŞÜK RİSK';
      case 'safe':
        return 'GÜVENLİ';
      // 'suspicious' için backward compatibility
      case 'suspicious':
        return 'ŞÜPHELİ';
      default:
        return riskLevel.toUpperCase();
    }
  };

  // HATA DÜZELTMESİ: riskLevel undefined olabilir, kontrol et
  const getRiskColor = (riskLevel?: string) => {
    if (!riskLevel) return '#475569'; // Kurumsal gri
    
    switch (riskLevel.toLowerCase()) {
      case 'fraud':
        return '#dc2626'; // Kurumsal kırmızı
      case 'high':
        return '#ea580c'; // Kurumsal turuncu
      case 'medium':
        return '#eab308'; // Kurumsal sarı
      case 'low':
        return '#3b82f6'; // Kurumsal mavi
      case 'safe':
        return '#059669'; // Kurumsal yeşil
      // 'suspicious' için backward compatibility
      case 'suspicious':
        return '#ea580c'; // Kurumsal turuncu
      default:
        return '#475569'; // Kurumsal gri
    }
  };

  // HATA DÜZELTMESİ: riskLevel undefined olabilir, kontrol et
  const getRiskIcon = (riskLevel?: string) => {
    if (!riskLevel) return 'ℹ️';
    
    switch (riskLevel.toLowerCase()) {
      case 'fraud':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return '🔶';
      case 'low':
        return '📊';
      case 'safe':
        return '✅';
      // 'suspicious' için backward compatibility
      case 'suspicious':
        return '🔍';
      default:
        return 'ℹ️';
    }
  };

  // Hata gösterimi için yardımcı fonksiyon
  const renderError = () => {
    if (!error) return null;
    
    return (
      <div style={{
        marginTop: '20px',
        padding: '16px',
        backgroundColor: '#fee2e2',
        border: '1px solid #fecaca',
        borderRadius: '12px',
        color: '#991b1b',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '20px' }}>❌</span>
        <span style={{ fontWeight: '500', fontFamily: "'Inter', sans-serif" }}>{error}</span>
      </div>
    );
  };

  // Sonuç gösterimi için yardımcı fonksiyon
  const renderResult = () => {
    if (!result) return null;
    
    // result.riskLevel undefined olabilir, kontrol et
    const riskLevel = result.riskLevel || 'safe';
    const score = result.score || 0;
    const reasons = result.reasons || [];
    
    return (
      <div style={{
        marginTop: '30px',
        padding: '32px',
        backgroundColor: '#f8fafc',
        borderRadius: '16px',
        border: `3px solid ${getRiskColor(riskLevel)}`,
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
      }} className="fade-in">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontSize: '64px',
            marginBottom: '16px'
          }} className="bounce">
            {getRiskIcon(riskLevel)}
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: getRiskColor(riskLevel),
            marginBottom: '12px',
            letterSpacing: '-0.5px',
            fontFamily: "'Inter', sans-serif"
          }}>
            {getRiskLabel(riskLevel)}
          </div>
          <div style={{
            display: 'inline-block',
            padding: '8px 20px',
            backgroundColor: getRiskColor(riskLevel),
            color: 'white',
            borderRadius: '20px',
            fontSize: '18px',
            fontWeight: '600',
            marginTop: '8px',
            fontFamily: "'Inter', sans-serif"
          }}>
            Risk Skoru: {score}/100
          </div>
          
          {/* Ekstra bilgiler */}
          {result.metadata && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              marginTop: '20px',
              flexWrap: 'wrap'
            }}>
              {result.metadata.urlCount !== undefined && (
                <div style={{
                  padding: '8px 16px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#475569'
                }}>
                  🔗 {result.metadata.urlCount} URL
                </div>
              )}
              {result.metadata.totalThreats !== undefined && result.metadata.totalThreats > 0 && (
                <div style={{
                  padding: '8px 16px',
                  backgroundColor: '#fee2e2',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#991b1b'
                }}>
                  ⚠️ {result.metadata.totalThreats} Tehdit
                </div>
              )}
            </div>
          )}
        </div>

        {reasons.length > 0 && (
          <div>
            <h4 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#0f172a',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: "'Inter', sans-serif"
            }}>
              <span>🔎</span>
              Tespit Edilen İşaretler
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reasons.map((reason, index) => (
                <div key={index} style={{
                  padding: '16px',
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(4px)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                }}
                >
                  <span style={{
                    fontSize: '20px',
                    flexShrink: 0
                  }}>•</span>
                  <span style={{
                    color: '#334155',
                    fontWeight: '400',
                    fontSize: '15px',
                    fontFamily: "'Inter', sans-serif"
                  }}>{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '20px 0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#000'
            }}>
              🛡️
            </div>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: '700',
                color: '#0f172a',
                letterSpacing: '-0.5px',
                fontFamily: "'Inter', sans-serif"
              }}>
                SMS Control
              </h1>
              <p style={{
                margin: 0,
                fontSize: '13px',
                color: '#475569',
                fontWeight: '500',
                fontFamily: "'Inter', sans-serif"
              }}>
                Güvenli SMS Analizi
              </p>
            </div>
          </div>
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <span style={{
              padding: '6px 12px',
              backgroundColor: '#eff6ff',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#1e40af',
              fontFamily: "'Inter', sans-serif"
            }}>
              🔒 Güvenli
            </span>
            <span style={{
              padding: '6px 12px',
              backgroundColor: '#eff6ff',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#1e40af',
              fontFamily: "'Inter', sans-serif"
            }}>
              ⚡ Hızlı
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        backgroundColor: '#1e40af',
        padding: '80px 20px',
        textAlign: 'center',
        color: 'white'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '48px',
            fontWeight: '700',
            margin: '0 0 20px 0',
            letterSpacing: '-1px',
            lineHeight: '1.2',
            fontFamily: "'Inter', sans-serif"
          }}>
            SMS Dolandırıcılık Kontrolü
          </h2>
          <p style={{
            fontSize: '20px',
            margin: '0 0 40px 0',
            opacity: 0.95,
            lineHeight: '1.6',
            fontFamily: "'Inter', sans-serif",
            fontWeight: '400'
          }}>
            Mesajınızı analiz edin, dolandırıcılık riskini anında öğrenin.
            <br />
            <span style={{ fontSize: '16px', opacity: 0.9, fontWeight: '400' }}>
              Google Safe Browsing teknolojisi ile güçlendirilmiş
            </span>
          </p>
          
          {/* Stats */}
          <div style={{
            display: 'flex',
            gap: '40px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '50px'
          }}>
            <div>
              <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px', fontFamily: "'Inter', sans-serif" }}>100%</div>
              <div style={{ fontSize: '14px', opacity: 0.9, fontFamily: "'Inter', sans-serif", fontWeight: '400' }}>Ücretsiz</div>
            </div>
            <div>
              <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px', fontFamily: "'Inter', sans-serif" }}>Anında</div>
              <div style={{ fontSize: '14px', opacity: 0.9, fontFamily: "'Inter', sans-serif", fontWeight: '400' }}>Sonuç</div>
            </div>
            <div>
              <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px', fontFamily: "'Inter', sans-serif" }}>Gizli</div>
              <div style={{ fontSize: '14px', opacity: 0.9, fontFamily: "'Inter', sans-serif", fontWeight: '400' }}>Veri Saklanmaz</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main style={{
        maxWidth: '900px',
        margin: '-40px auto 0',
        padding: '0 20px 80px',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Analysis Card */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#0f172a',
              marginBottom: '8px',
              fontFamily: "'Inter', sans-serif"
            }}>
              SMS Metnini Girin
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#000000',
              margin: 0,
              fontFamily: "'Inter', sans-serif",
              fontWeight: '400'
            }}>
              Mesajınızı aşağıdaki alana yapıştırın veya yazın
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <textarea
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              placeholder="Örnek: Hesabınız askıya alınacak! Hemen onayla: bit.ly/xyz"
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '16px',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '16px',
                fontFamily: "'Inter', sans-serif",
                resize: 'vertical',
                boxSizing: 'border-box',
                transition: 'all 0.2s',
                backgroundColor: '#f8fafc',
                color: '#0f172a'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#1e40af';
                e.target.style.backgroundColor = '#ffffff';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.backgroundColor = '#f8fafc';
              }}
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px 32px',
              backgroundColor: loading ? '#94a3b8' : '#1e40af',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading 
                ? 'none' 
                : '0 4px 6px -1px rgba(30, 64, 175, 0.3)',
              transform: loading ? 'none' : 'translateY(0)',
              fontFamily: "'Inter', sans-serif"
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.backgroundColor = '#1e3a8a';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(30, 64, 175, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.backgroundColor = '#1e40af';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(30, 64, 175, 0.3)';
              }
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></span>
                Analiz ediliyor...
              </span>
            ) : (
              '🔍 Analiz Et'
            )}
          </button>

          {/* Hata gösterimi */}
          {renderError()}

          {/* Sonuç gösterimi */}
          {renderResult()}
        </div>

        {/* Features Section */}
        <div style={{
          marginTop: '60px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '24px'
        }}>
          <div style={{
            padding: '32px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔐</div>
            <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px', fontFamily: "'Inter', sans-serif" }}>
              Gizlilik
            </h4>
            <p style={{ fontSize: '14px', color: '#475569', margin: 0, fontFamily: "'Inter', sans-serif", fontWeight: '400' }}>
              SMS metniniz hiçbir yerde saklanmaz
            </p>
          </div>
          <div style={{
            padding: '32px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚡</div>
            <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px', fontFamily: "'Inter', sans-serif" }}>
              Hızlı Analiz
            </h4>
            <p style={{ fontSize: '14px', color: '#475569', margin: 0, fontFamily: "'Inter', sans-serif", fontWeight: '400' }}>
              Sonuçlar anında hazır
            </p>
          </div>
          <div style={{
            padding: '32px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🛡️</div>
            <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px', fontFamily: "'Inter', sans-serif" }}>
              Güvenli
            </h4>
            <p style={{ fontSize: '14px', color: '#475569', margin: 0, fontFamily: "'Inter', sans-serif", fontWeight: '400' }}>
              Google Safe Browsing teknolojisi
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        backgroundColor: '#0f172a',
        color: '#cbd5e1',
        padding: '40px 20px',
        marginTop: '80px'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
          <p style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            fontWeight: '600',
            fontFamily: "'Inter', sans-serif"
          }}>
            SMS Control
          </p>
          <p style={{
            margin: 0,
            fontSize: '14px',
            opacity: 0.8,
            fontFamily: "'Inter', sans-serif",
            fontWeight: '400'
          }}>
            © 2024 SMS Control. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .bounce {
          animation: bounce 1s infinite;
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}