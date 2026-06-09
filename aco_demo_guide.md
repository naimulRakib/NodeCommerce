# Supply Chain & ACO Demo Guide (Advanced Features)

This document outlines the end-to-end workflow of the Ant Colony Optimization (ACO) supply chain system. It highlights how the AI routing engine, combined with human-in-the-loop negotiations and UiPath RPA, creates a self-healing, mathematically sound logistics network.

## The Core Concept
The system acts as a decentralized logistics orchestrator. **Demand flows up**, **Supply flows in**, and the **ACO Algorithm automatically routes the trucks** to maximize efficiency while strictly respecting physical constraints and pricing negotiations.

---

## 1. Demand Entry & Forecasting
The system doesn't just react to current needs; it anticipates future requirements.
- **Local Resellers** input their immediate needs.
- **Demand Forecasting**: District managers and the system can log *forecasted* demands based on seasonal trends (e.g., upcoming festivals). The ACO factor these in to pre-position stock in District Hubs before local stockouts occur.
- **Aggregation**: Local Demand -> Upazilla Demand -> District Demand.

---

## 2. Supply & Seller Negotiation
Before trucks move, prices must be agreed upon.
- **Seller Price Negotiation**: Sellers list their available stock and baseline prices. If a District needs massive quantities (e.g., 10,000 units), the District Reseller and Seller enter a negotiation phase via the UI. 
- Only when the price is agreed upon does that stock become "Available" for the ACO algorithm to route across district lines.

---

## 3. The 4-Phase ACO Routing Engine
The Global ACO engine executes strictly in 4 phases. It strictly enforces **Truck Capacity Limits (e.g., 500 units per truck)**. If a demand is 1,200 units, the ACO automatically spins up 3 physical trucks (two full 500-unit trucks and one 200-unit truck) rather than treating it as abstract data.

### Phase 1: Local Upazilla (Greedy Fill)
- **Logic**: A seller's products fill demands in their *own* Upazilla first.
- **Action**: ACO generates a truck (respecting the 500-unit limit) and marks it as **Dispatched**.
- **Real-Time Notifications**:
  - `[SELLER_ALERT]` *"Dispatch Required: Load Truck #102 with 500 units for Upazilla Hub."*
  - `[RECEIVER_ALERT]` *"Incoming Delivery: Truck #102 en-route from local seller."*

### Phase 2: Intra-District Hub
- **Logic**: Leftover stock is bundled and sent to other starving Upazillas within the *same* District.
- **Action**: A multi-stop truck route is mapped and dispatched automatically.

### Phase 3: Inter-District Negotiation & UiPath Integration
- **Logic**: Surplus stock in District A is proposed to be sent to starving District B.
- **Action**: A `Pending` shipment and a `Negotiation Opportunity` are created. The truck does *not* move yet.
- **UiPath "Human-in-the-Loop" Workflow**:
  1. The NodeCommerce system fires a Webhook to **UiPath Orchestrator**.
  2. UiPath creates a task in **UiPath Action Center** for the District Managers.
  3. The Managers review the transport costs and margins on their mobile devices and click **Approve** or **Reject**.
  4. UiPath makes an API call back to NodeCommerce to finalize the decision.

> [!WARNING]
> **What happens if Phase 3 is Rejected?**
> If the receiving district rejects the truck (due to high transport cost), the shipment is marked as `Rejected`. The ACO instantly "frees up" that stock back into the surplus pool. The next time the Global ACO runs, it will dynamically calculate an alternative route to a *different* starving district. No stock is ever permanently frozen.

### Phase 4: Destination Distribution
- **Logic**: Once the inter-district truck arrives at District B's hub, the goods are pushed down to local Upazillas.
- **Action**: This triggers automatically the moment the Phase 3 shipment is approved.

---

## 4. Advanced System Governance

### Mathematical Conservation Check
Every single time the ACO finishes a global run, it executes a strict **Conservation Check**.
- The system mathematically verifies: `Total Input Stock === Total Dispatched Stock + Total Pending Shipments + Remaining Surplus`.
- If there is even a 1-unit discrepancy due to a floating-point error or routing bug, the entire ACO transaction is rolled back, preventing phantom inventory from corrupting the supply chain.

### UiPath "Broken Truck" Self-Healing Loop
Logistics fail in the real world. This architecture is designed to self-heal using RPA.
1. **The Event**: A truck breaks down on the highway. An SMS is sent: *"TRUCK DOWN #102"*.
2. **UiPath Bot**: A background UiPath bot intercepts this SMS/Email, reads the Truck ID, and calls our API to mark Shipment #102 as `FAILED`.
3. **The Recalculation**: The bot then triggers the `/api/aco/global-trigger` endpoint. The ACO mathematically sees the stock is stranded and the destination is still starving, and instantly plots a *backup truck route* from the nearest available warehouse to cover the loss.

> [!TIP]
> This combined architecture means **NodeCommerce handles the complex AI math**, while **UiPath handles the real-world physical triggers and human governance**, creating a flawless enterprise logistics demo.
