"use client"
import { useLanguage } from "@/contexts/LanguageContext"
import styles from "./StatusBadge.module.css"

const STATUS_CONFIG = {
  pending: { bn: "অপেক্ষমান", en: "Pending", variant: "pending" },
  pending_approval: { bn: "অনুমোদন প্রয়োজন", en: "Pending Approval", variant: "pending" },
  pending_negotiation: { bn: "আলোচনা চলছে", en: "In Negotiation", variant: "pending" },
  pending_dispatch: { bn: "প্রেরণের অপেক্ষায়", en: "Pending Dispatch", variant: "pending" },
  approved: { bn: "অনুমোদিত", en: "Approved", variant: "success" },
  accepted: { bn: "গৃহীত", en: "Accepted", variant: "success" },
  dispatched: { bn: "প্রেরিত", en: "Dispatched", variant: "info" },
  truck_assigned: { bn: "ট্রাক নির্ধারিত", en: "Truck Assigned", variant: "info" },
  in_transit: { bn: "পথে আছে", en: "In Transit", variant: "info" },
  delivered: { bn: "বিতরণ হয়েছে", en: "Delivered", variant: "success" },
  completed: { bn: "সম্পন্ন", en: "Completed", variant: "success" },
  failed: { bn: "ব্যর্থ", en: "Failed", variant: "danger" },
  rejected: { bn: "প্রত্যাখ্যাত", en: "Rejected", variant: "danger" },
  source_rejected: { bn: "উৎস প্রত্যাখ্যাত", en: "Source Rejected", variant: "danger" },
  target_rejected: { bn: "গন্তব্য প্রত্যাখ্যাত", en: "Target Rejected", variant: "danger" },
  auto_approved: { bn: "স্বয়ংক্রিয় অনুমোদন", en: "Auto-Approved", variant: "success" },
  auto_rejected: { bn: "স্বয়ংক্রিয় প্রত্যাখ্যাত", en: "Auto-Rejected", variant: "danger" },
  executing: { bn: "চলমান", en: "Executing", variant: "info" },
  critical: { bn: "জরুরি", en: "Critical", variant: "critical" },
  warning: { bn: "সতর্কতা", en: "Warning", variant: "warning" },
  booking_failed: { bn: "বুকিং ব্যর্থ", en: "Booking Failed", variant: "danger" },
  over_budget: { bn: "বাজেট অতিক্রম", en: "Over Budget", variant: "warning" },
  truck_breakdown: { bn: "ট্রাক বিকল", en: "Truck Breakdown", variant: "danger" }
} as const

type StatusKey = keyof typeof STATUS_CONFIG | string

interface StatusBadgeProps {
  status: StatusKey
  size?: "sm" | "md" | "lg"
  pulse?: boolean
}

export function StatusBadge({ status, size = "md", pulse = false }: StatusBadgeProps) {
  const { t } = useLanguage()

  // Fallback if status string is not found in config
  const normalizedStatus = status.toLowerCase() as keyof typeof STATUS_CONFIG
  const config = STATUS_CONFIG[normalizedStatus] || {
    bn: status,
    en: status,
    variant: "info"
  }

  const variantClass = styles[config.variant] || styles.info
  const sizeClass = styles[`size-${size}`] || styles["size-md"]
  const pulseClass = (pulse || config.variant === "critical") ? styles.pulseAnimation : ""

  return (
    <span
      className={`${styles.badge} ${variantClass} ${sizeClass} ${pulseClass}`}
      aria-label={config.en}
    >
      {t(config.bn, config.en)}
    </span>
  )
}
