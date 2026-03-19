'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'
export type Language = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'hi' | 'pt'

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵' },
  { code: 'zh', label: '中文',        flag: '🇨🇳' },
  { code: 'hi', label: 'हिन्दी',      flag: '🇮🇳' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
]

// Minimal UI string translations
export const T: Record<Language, Record<string, string>> = {
  en: { dashboard: 'Dashboard', submit: 'Submit Proposal', vote: 'Vote', analytics: 'Impact Analytics', aiReview: 'AI Review', disconnect: 'Disconnect Wallet', settings: 'Settings', theme: 'Theme', language: 'Language', dark: 'Dark', light: 'Light', connected: 'Connected', tagline: 'Take One step Towards a Greener Future' },
  es: { dashboard: 'Panel', submit: 'Enviar Propuesta', vote: 'Votar', analytics: 'Análisis de Impacto', aiReview: 'Revisión IA', disconnect: 'Desconectar Billetera', settings: 'Ajustes', theme: 'Tema', language: 'Idioma', dark: 'Oscuro', light: 'Claro', connected: 'Conectado', tagline: 'Un paso hacia un futuro más verde' },
  fr: { dashboard: 'Tableau de bord', submit: 'Soumettre', vote: 'Voter', analytics: 'Analytique', aiReview: 'Revue IA', disconnect: 'Déconnecter', settings: 'Paramètres', theme: 'Thème', language: 'Langue', dark: 'Sombre', light: 'Clair', connected: 'Connecté', tagline: 'Un pas vers un avenir plus vert' },
  de: { dashboard: 'Dashboard', submit: 'Vorschlag einreichen', vote: 'Abstimmen', analytics: 'Analytik', aiReview: 'KI-Überprüfung', disconnect: 'Wallet trennen', settings: 'Einstellungen', theme: 'Thema', language: 'Sprache', dark: 'Dunkel', light: 'Hell', connected: 'Verbunden', tagline: 'Ein Schritt in eine grünere Zukunft' },
  ja: { dashboard: 'ダッシュボード', submit: '提案を提出', vote: '投票', analytics: '影響分析', aiReview: 'AIレビュー', disconnect: 'ウォレット切断', settings: '設定', theme: 'テーマ', language: '言語', dark: 'ダーク', light: 'ライト', connected: '接続済み', tagline: 'より緑豊かな未来へ一歩' },
  zh: { dashboard: '仪表板', submit: '提交提案', vote: '投票', analytics: '影响分析', aiReview: 'AI审查', disconnect: '断开钱包', settings: '设置', theme: '主题', language: '语言', dark: '深色', light: '浅色', connected: '已连接', tagline: '迈向更绿色未来的一步' },
  hi: { dashboard: 'डैशबोर्ड', submit: 'प्रस्ताव सबमिट करें', vote: 'वोट करें', analytics: 'प्रभाव विश्लेषण', aiReview: 'AI समीक्षा', disconnect: 'वॉलेट डिस्कनेक्ट', settings: 'सेटिंग्स', theme: 'थीम', language: 'भाषा', dark: 'डार्क', light: 'लाइट', connected: 'कनेक्टेड', tagline: 'एक हरित भविष्य की ओर एक कदम' },
  pt: { dashboard: 'Painel', submit: 'Enviar Proposta', vote: 'Votar', analytics: 'Análise de Impacto', aiReview: 'Revisão IA', disconnect: 'Desconectar Carteira', settings: 'Configurações', theme: 'Tema', language: 'Idioma', dark: 'Escuro', light: 'Claro', connected: 'Conectado', tagline: 'Um passo para um futuro mais verde' },
}

interface SettingsCtx {
  theme: Theme
  language: Language
  t: Record<string, string>
  setTheme: (t: Theme) => void
  setLanguage: (l: Language) => void
}

const Ctx = createContext<SettingsCtx>({
  theme: 'dark', language: 'en', t: T.en,
  setTheme: () => {}, setLanguage: () => {},
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const savedTheme = (localStorage.getItem('eco_theme') as Theme) || 'dark'
    const savedLang  = (localStorage.getItem('eco_lang')  as Language) || 'en'
    setThemeState(savedTheme)
    setLanguageState(savedLang)
    document.documentElement.classList.toggle('light', savedTheme === 'light')
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('eco_theme', t)
    document.documentElement.classList.toggle('light', t === 'light')
  }

  const setLanguage = (l: Language) => {
    setLanguageState(l)
    localStorage.setItem('eco_lang', l)
    document.documentElement.lang = l
  }

  return (
    <Ctx.Provider value={{ theme, language, t: T[language], setTheme, setLanguage }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSettings = () => useContext(Ctx)
