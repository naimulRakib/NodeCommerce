# NodeCommerce Project History & Changelog

This document serves as a comprehensive log of all architectural decisions, feature implementations, and major bug fixes performed on the NodeCommerce project from day one.

---

## 📅 June 3, 2026: Foundation & Initialization
- **Clean Slate**: Performed a complete wipe of the original directory to build the architecture from scratch according to best practices.
- **Framework Initialization**: Bootstrapped the application using Next.js 15 (App Router), TypeScript, and Tailwind CSS.
- **Database & Auth**: Integrated `@supabase/supabase-js` and `@supabase/ssr` to handle secure authentication and PostgreSQL database management via Prisma ORM.

## 📅 June 4, 2026: UI Structure & E-Commerce Wireframes
- **Design System Reset**: Cleared standard Next.js boilerplate styling from `globals.css` to allow for a custom, premium design system.
- **Core Layout Implementation**: Developed a "Daraz/Amazon-style" structural wireframe for the main page (`src/app/page.tsx`), including:
  - Top Promo Bar & Main Header (Search, Cart, Logo)
  - Hero Area (Sidebar Categories + Banner Slider)
  - Interactive Categories Grid
  - Flash Sale & "Just For You" dynamic product grids.

## 📅 June 4-5, 2026: Core Logic, Checkout & System Optimization

### 🛒 Checkout & Buyer Profiles
- **Profile Enforcement**: Implemented strict routing checks in the `CartDrawer` and `OrderSummary` components. Users are now explicitly blocked from checking out and forced to complete their delivery profile (City, Upazilla, District) before placing an order.
- **Data Integrity**: Ensured that exact user inputs (including the `district` and any custom `buyerNote`) are successfully written to the database during transaction creation.

### 📊 Behaviour Tracking System
- **Tracking Refactor**: Identified silent failures in the `trackBehaviour` utility caused by Next.js server-side `fetch` limitations. 
- **Direct Database Writes**: Rewrote `src/lib/behaviour.ts` to execute direct Prisma queries, ensuring user interactions (clicks, searches, purchases) are tracked flawlessly without network overhead.

### 📦 Order Lifecycle & Seller Dashboard
- **State Machine Fixes**: Resolved severe bugs causing the backend to throw `Invalid transition` errors when sellers clicked "Confirm Order" then "Mark Processing". 
- **Cache Busting**: Discovered that Next.js was aggressively caching the `GET /api/seller/orders` route, causing the UI to desynchronize from the database. Fixed this by strictly enforcing `dynamic = "force-dynamic"` on all seller API routes.
- **UI Synchronization**: Updated the frontend to immediately sync its local state with the exact database response upon successful transition, preventing race conditions.
- **Full Address Rendering**: Expanded the Buyer and Seller dashboards to render the *complete* geographical delivery address (including district) and the buyer's checkout notes.

### 🚀 Critical Performance & Memory Leak Fixes
- **The PC Heating Issue**: Diagnosed extreme CPU spiking, RAM degradation, and "lazy loading" caused by a severe memory leak in the Real-Time Notification system.
- **Root Cause**: The application was using Server-Sent Events (SSE). During Next.js Hot-Module Replacement (saving files), the server was failing to kill old background polling loops. Dozens of ghost loops were running simultaneously, hammering the database every 8 seconds.
- **The Resolution**: Completely deleted the SSE streaming infrastructure (`/api/buyer/notifications/stream`). Rewrote the `NotificationBell.tsx` to utilize robust **Client-Side Polling** via standard React hooks (`setInterval` + `fetch`). This immediately stabilized CPU/RAM usage and eliminated database connection exhaustion.
