# NodeCommerce — ER Diagram (Chen's Notation)

> Based on [`prisma/schema.prisma`](file:///Users/naimulislam/Desktop/Lightborn/NodeCommerce/nodecom/prisma/schema.prisma)  
> Notation: **Peter Chen's ER Model** — rectangles = entities, diamonds = relationships, ovals = attributes, underline = PK

---

![NodeCommerce ER Diagram – Chen's Notation](/Users/naimulislam/.gemini/antigravity-ide/brain/02d21a75-bee1-4506-ade4-9568bebb12b1/er_chen_notation_1784567592436.png)

---

## Notation Legend

| Symbol | Meaning |
|--------|---------|
| 🔷 **Rectangle (double border)** | Entity |
| 🔶 **Diamond** | Relationship between entities |
| ⬭ **Oval** | Attribute of an entity |
| <u>id (PK)</u> | Underlined attribute = Primary Key |
| `1:N` on line | One-to-Many cardinality |
| `M:N` on line | Many-to-Many cardinality |
| `N:1` on line | Many-to-One cardinality |

---

## Entities & Relationships Covered

### 👤 Actors (Top Tier)
| Entity | Key Attributes |
|--------|---------------|
| `BuyerProfile` | id, email, city, district |
| `Profile (Seller)` | id, sellerCode, storeName, city, upazilla |
| `GlobalProduct` | id, name, category, brand |

### 📦 Commerce Layer
| Relationship | Entities | Cardinality |
|---|---|---|
| PLACES | BuyerProfile → Order | 1:N |
| LISTS | Profile → SellerProduct | 1:N |
| BELONGS_TO | SellerProduct → GlobalProduct | N:1 |
| FULFILLED_BY | Order ↔ SellerProduct (via OrderItem) | M:N |
| ADDS_TO_CART | BuyerProfile ↔ SellerProduct (via CartItem) | M:N |
| FORECASTS | SellerProduct → StockForecast | 1:N |

### 🏭 Supply Chain Tiers
| Relationship | Entities | Cardinality |
|---|---|---|
| HOLDS_STOCK | LocalReseller → ResellerStockItem | 1:N |
| HOLDS_STOCK | UpazillaReseller → UpazillaStockItem | 1:N |
| TRANSFERS_TO | UpazillaReseller ↔ LocalReseller (StockTransfer) | M:N |
| TRANSFERS_TO | DistrictReseller ↔ UpazillaReseller (DistrictTransfer) | M:N |
| NATIONAL_TRANSFER | DistrictReseller ↔ DistrictReseller (NationalTransfer) | M:N |

### 📊 Demand
| Relationship | Entities | Cardinality |
|---|---|---|
| SUBMITS_DEMAND | LocalReseller → LocalDemand | 1:N |
| SUBMITS_DEMAND | UpazillaReseller → UpazillaDemand | 1:N |
| AGGREGATES_DEMAND | DistrictReseller → DistrictDemand | 1:N |

### 🐜 ACO Engine
| Relationship | Entities | Cardinality |
|---|---|---|
| ROUTES_VIA | ACORoutingJob → ShipmentPlan | 1:N |
| CARRIES | ACOGlobalJob → ACOShipment | 1:N |
| ASSIGNED_TO | ACOGlobalJob → Truck | 1:N |
| NEGOTIATES | ACOGlobalJob → SellerACONegotiation | 1:N |
