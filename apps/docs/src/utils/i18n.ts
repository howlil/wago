export type Lang = 'en' | 'id';

export const translations = {
  en: {
    siteTitle: "Wago - Self-Hosted WhatsApp Gateway",
    navHome: "Home",
    navDocs: "Docs",
    navApi: "API Reference",
    navDeploy: "Deployment",
    navApp: "Frontend App",
    badgeText: "Node.js + Baileys • Single-account gateway",
    heroTitlePrefix: "Self-Hosted",
    heroTitleHighlight: "WhatsApp API Gateway",
    heroDescription: "Run one WhatsApp account behind a protected REST API and control dashboard, with durable local state, recipient policy, outbound guardrails, account-health signals, and sanitized audit events on infrastructure you control.",
    btnDocs: "Explore Documentation",
    btnConsole: "Open Gateway Console App",
    featuresTitle: "Core Gateway Features",
    featuresSubtitle: "A deliberately small runtime focused on inspectable behavior, durable local state, and controlled outbound messaging.",
    feat1Title: "Baileys Socket Integration",
    feat1Desc: "One WhatsApp Multi-Device session per Wago instance with QR pairing, reconnect handling, and explicit rebind.",
    feat2Title: "Durable Local State",
    feat2Desc: "SQLite application state in `/app/data/wago.db` plus Baileys authentication under `/app/data/auth`, both designed to survive normal container restarts.",
    feat3Title: "Protected REST API",
    feat3Desc: "Bearer-authenticated recipient, messaging, session, account-health, and structured audit endpoints for external applications.",
    feat4Title: "Recipient Policy",
    feat4Desc: "Explicit allow and opt-out controls, phone normalization, idempotency, and local outbound guardrails before a send reaches Baileys.",
    feat5Title: "First-Run Bootstrap",
    feat5Desc: "Optional browser credential bootstrap with HttpOnly session cookies, or a pre-provisioned API key managed by deployment configuration.",
    feat6Title: "Docker Native",
    feat6Desc: "A multi-stage production image serving the API and React dashboard from one Node.js process, with GHCR images for amd64 and arm64.",
    archTitle: "Architectural Overview",
    playgroundTitle: "Hybrid API Explorer",
    playgroundSubtitle: "Generate request snippets or optionally call your own Wago instance directly from the browser.",
    docsOverviewTitle: "Documentation Overview",
    docsApiTitle: "Complete API Specification",
    docsDeployTitle: "Deployment & Docker Guide",
    langToggle: "ID",
    footerText: "Lightweight self-hosted WhatsApp gateway. Open source and developer-first."
  },
  id: {
    siteTitle: "Wago - Gateway WhatsApp Self-Hosted",
    navHome: "Beranda",
    navDocs: "Dokumentasi",
    navApi: "Referensi API",
    navDeploy: "Panduan Deploy",
    navApp: "Aplikasi Frontend",
    badgeText: "Node.js + Baileys • Gateway single-account",
    heroTitlePrefix: "Self-Hosted",
    heroTitleHighlight: "WhatsApp API Gateway",
    heroDescription: "Jalankan satu akun WhatsApp di balik REST API terproteksi dan control dashboard, dengan state lokal yang durable, recipient policy, outbound guardrail, sinyal account health, dan audit event tersanitasi di infrastruktur yang Anda kendalikan.",
    btnDocs: "Pelajari Dokumentasi",
    btnConsole: "Buka Konsol Aplikasi Frontend",
    featuresTitle: "Fitur Inti Gateway",
    featuresSubtitle: "Runtime yang sengaja dibuat kecil dengan fokus pada perilaku yang mudah diaudit, state lokal yang durable, dan outbound messaging yang terkontrol.",
    feat1Title: "Integrasi Socket Baileys",
    feat1Desc: "Satu session WhatsApp Multi-Device per instance Wago dengan QR pairing, reconnect handling, dan rebind eksplisit.",
    feat2Title: "State Lokal yang Durable",
    feat2Desc: "Application state di SQLite `/app/data/wago.db` dan autentikasi Baileys di `/app/data/auth`, keduanya dipertahankan pada restart container normal.",
    feat3Title: "REST API Terproteksi",
    feat3Desc: "Endpoint Bearer-authenticated untuk recipient, messaging, session, account health, dan structured audit bagi aplikasi eksternal.",
    feat4Title: "Recipient Policy",
    feat4Desc: "Allow dan opt-out eksplisit, normalisasi nomor, idempotency, serta local outbound guardrail sebelum send diteruskan ke Baileys.",
    feat5Title: "First-Run Bootstrap",
    feat5Desc: "Bootstrap credential browser secara opsional dengan HttpOnly session cookie, atau gunakan API key yang diprovisikan dari konfigurasi deployment.",
    feat6Title: "Docker Native",
    feat6Desc: "Production image multi-stage yang menyajikan API dan dashboard React dari satu proses Node.js, dengan image GHCR untuk amd64 dan arm64.",
    archTitle: "Gambaran Arsitektur Sistem",
    playgroundTitle: "Hybrid API Explorer",
    playgroundSubtitle: "Buat snippet request atau secara opsional panggil instance Wago milik Anda langsung dari browser.",
    docsOverviewTitle: "Ringkasan Dokumentasi",
    docsApiTitle: "Spesifikasi API Lengkap",
    docsDeployTitle: "Panduan Deployment & Docker",
    langToggle: "EN",
    footerText: "Gateway WhatsApp self-hosted yang ringan. Open source dan developer-first."
  }
};

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/');
  if (lang === 'id') return 'id';
  return 'en';
}

export function useTranslations(lang: Lang) {
  return translations[lang] || translations.en;
}
