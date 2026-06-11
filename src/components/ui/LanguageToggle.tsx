"use client"
import { useLanguage } from "@/contexts/LanguageContext"
import styles from "./LanguageToggle.module.css"

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage()

  return (
    <button
      onClick={toggleLanguage}
      className={styles.toggle}
      aria-label="Switch language"
    >
      <span className={language === "bn" ? styles.active : styles.inactive}>
        বাং
      </span>
      <span className={styles.divider}>|</span>
      <span className={language === "en" ? styles.active : styles.inactive}>
        EN
      </span>
    </button>
  )
}
