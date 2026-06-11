"use client"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/contexts/LanguageContext"
import styles from "./PageLayout.module.css"
import { ReactNode } from "react"

const ROUTE_CONFIG: Record<string, {
  titleBn: string
  titleEn: string
  breadcrumbsBn: string[]
  breadcrumbsEn: string[]
  fullBleedHero: boolean
}> = {
  "/": {
    titleBn: "ড্যাশবোর্ড",
    titleEn: "Dashboard",
    breadcrumbsBn: ["হোম"],
    breadcrumbsEn: ["Home"],
    fullBleedHero: false
  },
  "/buyer/search": {
    titleBn: "পণ্য খুঁজুন",
    titleEn: "Shop",
    breadcrumbsBn: ["হোম", "দোকান"],
    breadcrumbsEn: ["Home", "Shop"],
    fullBleedHero: true
  },
  "/buyer/dashboard": {
    titleBn: "ক্রেতা ড্যাশবোর্ড",
    titleEn: "Buyer Dashboard",
    breadcrumbsBn: ["হোম", "ক্রেতা"],
    breadcrumbsEn: ["Home", "Buyer"],
    fullBleedHero: false
  },
  "/seller/dashboard": {
    titleBn: "বিক্রেতা ড্যাশবোর্ড",
    titleEn: "Seller Dashboard",
    breadcrumbsBn: ["হোম", "বিক্রেতা"],
    breadcrumbsEn: ["Home", "Seller"],
    fullBleedHero: false
  },
  "/district-reseller/dashboard": {
    titleBn: "জেলা রিসেলার ড্যাশবোর্ড",
    titleEn: "District Reseller Dashboard",
    breadcrumbsBn: ["হোম", "জেলা রিসেলার"],
    breadcrumbsEn: ["Home", "District Reseller"],
    fullBleedHero: false
  },
  "/upazilla-reseller/dashboard": {
    titleBn: "উপজেলা রিসেলার ড্যাশবোর্ড",
    titleEn: "Upazilla Reseller Dashboard",
    breadcrumbsBn: ["হোম", "উপজেলা রিসেলার"],
    breadcrumbsEn: ["Home", "Upazilla Reseller"],
    fullBleedHero: false
  },
  "/superdashboard": {
    titleBn: "সুপার অ্যাডমিন ড্যাশবোর্ড",
    titleEn: "Super Admin Dashboard",
    breadcrumbsBn: ["হোম", "অ্যাডমিন"],
    breadcrumbsEn: ["Home", "Admin"],
    fullBleedHero: false
  },
  "/mock-uipath-action-center": {
    titleBn: "অ্যাকশন সেন্টার",
    titleEn: "Action Center",
    breadcrumbsBn: ["হোম", "অ্যাকশন সেন্টার"],
    breadcrumbsEn: ["Home", "Action Center"],
    fullBleedHero: false
  },
  "/system-health": {
    titleBn: "সিস্টেম স্বাস্থ্য",
    titleEn: "System Health",
    breadcrumbsBn: ["হোম", "সিস্টেম"],
    breadcrumbsEn: ["Home", "System"],
    fullBleedHero: false
  }
}

export function PageLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { language } = useLanguage()

  // Simple fallback config if route is not explicitly defined
  const deriveConfigFromPath = (path: string) => {
    const segments = path.split("/").filter(Boolean)
    const last = segments[segments.length - 1] || "Dashboard"
    return {
      titleBn: last,
      titleEn: last,
      breadcrumbsBn: ["হোম", ...segments],
      breadcrumbsEn: ["Home", ...segments],
      fullBleedHero: false
    }
  }

  const config = ROUTE_CONFIG[pathname] ?? deriveConfigFromPath(pathname)

  const isFullBleed = config.fullBleedHero
  const breadcrumbs = language === "bn"
    ? config.breadcrumbsBn
    : config.breadcrumbsEn
  const title = language === "bn"
    ? config.titleBn
    : config.titleEn

  const isAuthPage = pathname.includes("/login") ||
    pathname.includes("/register") ||
    pathname.includes("/forgot-password")

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <div className={styles.pageWrapper}>
      <main className={styles.pageContent}>
        {!isFullBleed && (
          <div className={styles.pageHeader}>
            <nav
              className={styles.breadcrumb}
              aria-label="Breadcrumb"
            >
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className={styles.breadcrumbItem}>
                  {i > 0 && (
                    <span
                      className={styles.breadcrumbSeparator}
                      aria-hidden="true"
                    >
                      /
                    </span>
                  )}
                  <span
                    className={
                      i === breadcrumbs.length - 1
                        ? styles.breadcrumbCurrent
                        : styles.breadcrumbLink
                    }
                  >
                    {crumb}
                  </span>
                </span>
              ))}
            </nav>
            <h1 className={styles.pageTitle}>{title}</h1>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
