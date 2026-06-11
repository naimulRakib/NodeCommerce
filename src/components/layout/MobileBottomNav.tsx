"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/contexts/LanguageContext"
import { LanguageToggle } from "@/components/ui/LanguageToggle"
import styles from "./MobileBottomNav.module.css"

export function MobileBottomNav() {
  const pathname = usePathname()
  const { t } = useLanguage()

  // Hide on auth pages
  const isAuthPage = pathname.includes("/login") ||
    pathname.includes("/register") ||
    pathname.includes("/forgot-password")
  if (isAuthPage) return null

  // Determine role based on path
  let role = "none"
  if (pathname.includes("/buyer")) role = "buyer"
  else if (pathname.includes("/seller")) role = "seller"
  else if (pathname.includes("/district-reseller")) role = "district-reseller"
  else if (pathname.includes("/upazilla-reseller")) role = "upazilla-reseller"
  else if (pathname.includes("/super-admin") || pathname.includes("/superdashboard")) role = "super-admin"

  const getLinks = () => {
    switch (role) {
      case "buyer":
        return [
          { icon: "🏠", labelBn: "হোম", labelEn: "Home", path: "/buyer/dashboard" },
          { icon: "🛍️", labelBn: "দোকান", labelEn: "Shop", path: "/buyer/search" },
          { icon: "📋", labelBn: "অর্ডার", labelEn: "Orders", path: "/buyer/orders" },
          { icon: "👤", labelBn: "প্রোফাইল", labelEn: "Profile", path: "/buyer/profile" },
        ]
      case "seller":
        return [
          { icon: "🏠", labelBn: "হোম", labelEn: "Home", path: "/seller/dashboard" },
          { icon: "📦", labelBn: "পণ্য", labelEn: "Products", path: "/seller/products" },
          { icon: "🚚", labelBn: "চালান", labelEn: "Shipments", path: "/seller/shipments" },
          { icon: "💬", labelBn: "আলোচনা", labelEn: "Negotiation", path: "/seller/negotiations" },
        ]
      case "district-reseller":
        return [
          { icon: "🏠", labelBn: "হোম", labelEn: "Home", path: "/district-reseller/dashboard" },
          { icon: "🔄", labelBn: "ট্রান্সফার", labelEn: "Transfers", path: "/district-reseller/shipments" },
          { icon: "✅", labelBn: "অনুমোদন", labelEn: "Approvals", path: "/district-reseller/approvals" },
          { icon: "📊", labelBn: "বিশ্লেষণ", labelEn: "Analytics", path: "/district-reseller/analytics" },
        ]
      case "upazilla-reseller":
        return [
          { icon: "🏠", labelBn: "হোম", labelEn: "Home", path: "/upazilla-reseller/dashboard" },
          { icon: "📦", labelBn: "মজুদ", labelEn: "Stock", path: "/upazilla-reseller/inventory" },
          { icon: "🚚", labelBn: "ট্রাক", labelEn: "Trucks", path: "/upazilla-reseller/trucks" },
          { icon: "👥", labelBn: "রিসেলার", labelEn: "Resellers", path: "/upazilla-reseller/local-resellers" },
        ]
      case "super-admin":
        return [
          { icon: "🏠", labelBn: "হোম", labelEn: "Home", path: "/superdashboard" },
          { icon: "🗺️", labelBn: "ম্যাপ", labelEn: "Map", path: "/super-admin/map" },
          { icon: "⚡", labelBn: "সিস্টেম", labelEn: "System", path: "/system-health" },
          { icon: "⚙️", labelBn: "সেটিংস", labelEn: "Settings", path: "/super-admin/settings" },
        ]
      default:
        return []
    }
  }

  const links = getLinks()
  if (links.length === 0) return null

  return (
    <div className={styles.mobileBottomNav}>
      <div className={styles.mobileNavItems}>
        {links.map(link => (
          <Link
            key={link.path}
            href={link.path}
            className={`${styles.mobileNavItem} ${pathname === link.path ? styles.mobileNavItemActive : ""}`}
          >
            <span className={styles.mobileNavIcon}>{link.icon}</span>
            <span className={styles.mobileNavLabel}>
              {t(link.labelBn, link.labelEn)}
            </span>
          </Link>
        ))}
        {/* Language toggle specifically on mobile bottom nav per Edge Case 24 */}
        <div className={styles.mobileNavItemToggle}>
          <LanguageToggle />
        </div>
      </div>
    </div>
  )
}
