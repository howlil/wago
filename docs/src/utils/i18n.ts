export type Lang = 'en' | 'id';

export const translations = {
  en: {
    siteTitle: "Wago - Lightweight Baileys REST API Docs",
    navHome: "Home",
    navDocs: "Docs",
    navApi: "API Reference",
    navDeploy: "Deployment",
    navApp: "Frontend App",
    badgeText: "Node.js + Baileys Engine • Lightweight MVP",
    heroTitlePrefix: "Production-Ready",
    heroTitleHighlight: "WhatsApp API Gateway",
    heroDescription: "A self-hosted, lightweight WhatsApp REST API built with Express, TypeScript, and Baileys. Single-account session persistence with zero SaaS fees.",
    btnDocs: "Explore Documentation",
    btnConsole: "Open Gateway Console App",
    featuresTitle: "Core Engine Features",
    featuresSubtitle: "Engineered for speed, privacy, and architectural simplicity without enterprise bloat.",
    feat1Title: "Baileys Socket Integration",
    feat1Desc: "Direct WhatsApp Multi-Device socket connection without third-party proxy services.",
    feat2Title: "Persistent Session Auth",
    feat2Desc: "Filesystem & Docker volume authentication persistence (`/app/data/auth`). Survives container restarts.",
    feat3Title: "Clean REST Endpoints",
    feat3Desc: "Send messages (`POST /messages/send`), check live status, and monitor system health.",
    feat4Title: "Phone Normalization",
    feat4Desc: "Automatic international & local phone formatting (e.g. `0813...` -> `62813...`).",
    feat5Title: "Web Bootstrap Security",
    feat5Desc: "One-time web bootstrap key generation, HttpOnly browser session cookies & Bearer API Key auth.",
    feat6Title: "Docker Native",
    feat6Desc: "Multi-stage Docker builds serving API and frontend from a single lightweight container.",
    archTitle: "Architectural Overview",
    playgroundTitle: "Interactive Code Examples",
    playgroundSubtitle: "Copy ready-to-use request snippets in your favorite language or framework.",
    docsOverviewTitle: "Documentation Overview",
    docsApiTitle: "Complete API Specification",
    docsDeployTitle: "Deployment & Docker Guide",
    langToggle: "ID",
    footerText: "Lightweight WhatsApp API. Open Source & Developer-first."
  },
  id: {
    siteTitle: "Wago - Dokumentasi REST API Baileys",
    navHome: "Beranda",
    navDocs: "Dokumentasi",
    navApi: "Referensi API",
    navDeploy: "Panduan Deploy",
    navApp: "Aplikasi Frontend",
    badgeText: "Engine Node.js + Baileys • Ringan & Cepat",
    heroTitlePrefix: "Siap Produksi",
    heroTitleHighlight: "WhatsApp API Gateway",
    heroDescription: "Wago adalah REST API WhatsApp mandiri (self-hosted) berbahan Express, TypeScript, dan Baileys. Menyimpan sesi WhatsApp secara permanen tanpa biaya bulanan SaaS.",
    btnDocs: "Pelajari Dokumentasi",
    btnConsole: "Buka Konsol Aplikasi Frontend",
    featuresTitle: "Fitur Utama Engine",
    featuresSubtitle: "Dirancang untuk kecepatan, privasi data, dan kemudahan tanpa arsitektur yang berlebihan.",
    feat1Title: "Integrasi Socket Baileys",
    feat1Desc: "Koneksi langsung socket WhatsApp Multi-Device tanpa perantara layanan pihak ketiga.",
    feat2Title: "Sesi Permanen",
    feat2Desc: "Autentikasi tersimpan di sistem berkas & Docker volume (`/app/data/auth`). Aman dari restart container.",
    feat3Title: "REST API Bersih",
    feat3Desc: "Kirim pesan (`POST /messages/send`), cek status koneksi, dan pantau kesehatan server.",
    feat4Title: "Normalisasi Nomor HP",
    feat4Desc: "Format otomatis nomor lokal dan internasional (contoh: `0813...` menjadi `62813...`).",
    feat5Title: "Keamanan Web Bootstrap",
    feat5Desc: "Generasi kunci API sekali pakai, cookie sesi HttpOnly, dan otentikasi Bearer Token.",
    feat6Title: "Dukungan Docker Native",
    feat6Desc: "Build Docker multi-stage yang menyajikan API dan frontend dalam satu container ringkas.",
    archTitle: "Gambaran Arsitektur Sistem",
    playgroundTitle: "Contoh Kode Interaktif",
    playgroundSubtitle: "Salin potongan kode siap pakai dalam bahasa atau framework favorit Anda.",
    docsOverviewTitle: "Ringkasan Dokumentasi",
    docsApiTitle: "Spesifikasi API Lengkap",
    docsDeployTitle: "Panduan Deployment & Docker",
    langToggle: "EN",
    footerText: "WhatsApp API Ringan. Sumber Terbuka & Mengutamakan Developer."
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
