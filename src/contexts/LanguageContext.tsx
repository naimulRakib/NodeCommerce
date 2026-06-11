"use client"
import { createContext, useContext, useState, useEffect, ReactNode } from "react"

type Language = "bn" | "en"

interface LanguageContextType {
  language: Language
  toggleLanguage: () => void
  t: (bn: string, en: string) => string
}

const LanguageContext = createContext<LanguageContextType>({
  language: "bn",
  toggleLanguage: () => {},
  t: (bn) => bn
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("bn")

  useEffect(() => {
    // Edge case 23 & 25
    const stored = localStorage.getItem("nc_language") as Language
    if (stored) {
      setLanguage(stored)
    } else {
      const isEnglish = navigator.language.toLowerCase().startsWith('en')
      setLanguage(isEnglish ? "en" : "bn")
    }
  }, [])

  const toggleLanguage = () => {
    setLanguage(prev => {
      const next = prev === "bn" ? "en" : "bn"
      localStorage.setItem("nc_language", next)
      return next
    })
  }

  const t = (bn: string, en: string): string => {
    return language === "bn" ? bn : en
  }

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
