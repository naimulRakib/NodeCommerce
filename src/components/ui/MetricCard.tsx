"use client"
import { ReactNode } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import styles from "./MetricCard.module.css"

interface MetricCardProps {
  labelBn: string
  labelEn: string
  value: string | number
  subtextBn?: string
  subtextEn?: string
  trend?: number
  trendLabelBn?: string
  trendLabelEn?: string
  icon?: ReactNode
  accentColor?: string
  onClick?: () => void
}

export function MetricCard({
  labelBn,
  labelEn,
  value,
  subtextBn,
  subtextEn,
  trend,
  trendLabelBn,
  trendLabelEn,
  icon,
  accentColor = "var(--nc-primary)",
  onClick
}: MetricCardProps) {
  const { t } = useLanguage()

  const cardStyle = {
    "--card-accent": accentColor,
    cursor: onClick ? "pointer" : "default"
  } as React.CSSProperties

  return (
    <div
      className={`${styles.metricCard} ${onClick ? styles.clickable : ""}`}
      style={cardStyle}
      onClick={onClick}
      role={onClick ? "button" : "region"}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={styles.cardHeader}>
        <h3 className={styles.cardLabel}>
          {t(labelBn, labelEn)}
        </h3>
        {icon && <div className={styles.cardIcon}>{icon}</div>}
      </div>

      <div className={styles.cardValue}>
        {value}
      </div>

      {(subtextBn || trend !== undefined) && (
        <div className={styles.cardFooter}>
          {trend !== undefined && (
            <span className={`${styles.trend} ${trend > 0 ? styles.trendUp : trend < 0 ? styles.trendDown : styles.trendNeutral}`}>
              {trend > 0 ? "↑ " : trend < 0 ? "↓ " : ""}
              {Math.abs(trend)}%
            </span>
          )}
          {trendLabelBn && (
            <span className={styles.trendLabel}>
              {t(trendLabelBn, trendLabelEn || "")}
            </span>
          )}
          {subtextBn && !trendLabelBn && (
            <span className={styles.subtext}>
              {t(subtextBn, subtextEn || "")}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
