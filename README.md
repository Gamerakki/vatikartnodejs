<p align="center">
  <img src="https://img.shields.io/badge/VatiKart-Backend%20API-0D9488?style=for-the-badge&logo=node.js&logoColor=white" alt="VatiKart Backend" />
</p>

# 🚀 VatiKart — Backend API

The core RESTful API server powering the entire VatiKart platform. Built with **Express.js**, **TypeScript**, and **Prisma ORM** on **PostgreSQL**.

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Database Models](#-database-models)
- [API Modules](#-api-modules)
- [API Endpoints](#-api-endpoints)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Scripts](#-scripts)

---

## 🛠 Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js + Express** | HTTP Server & Routing |
| **TypeScript** | Type Safety |
| **Prisma ORM** | Database Access & Migrations |
| **PostgreSQL** | Relational Database |
| **Zod** | Request Validation |
| **JWT (jsonwebtoken)** | Authentication |
| **bcryptjs** | Password Hashing |
| **Multer + Cloudinary** | Image Uploads |
| **CORS** | Cross-Origin Requests |

---

## 🏗 Architecture

```
src/
├── app.ts                    # Express app setup, middleware, route mounting
├── server.ts                 # HTTP server entry point
├── config/
│   └── database.ts           # Prisma client singleton
├── middlewares/
│   └── auth.ts               # JWT authentication guard
├── modules/
│   ├── admin/                # Super Admin analytics & subscription management
│   ├── auth/                 # Login, Register, JWT token generation
│   ├── catalogue/            # Catalogue CRUD, privacy settings, access control
│   ├── company/              # Company/Store profile management
│   ├── order/                # Order lifecycle (create, status, discount, shipping)
│   └── product/              # Product CRUD, images, variants, bulk discounts
└── utils/
    └── cloudinary.ts         # Cloudinary upload helper
```

Each module follows a clean layered architecture:
```
module/
├── module.router.ts          # Route definitions
├── module.controller.ts      # Request handling & response
├── module.service.ts         # Business logic
├── module.repository.ts      # Database queries (Prisma)
├── module.validation.ts      # Zod schemas
└── module.interface.ts       # TypeScript interfaces
```

---

## 🗄 Database Models

| Model | Description |
|---|---|
| **User** | Registered store owners (auth, profile) |
| **Company** | Business/Store entity linked to a user |
| **Catalogue** | Product catalogues with privacy levels (PUBLIC/PRIVATE) |
| **Product** | Items within catalogues (price, SKU, description) |
| **ProductImage** | Multiple images per product |
| **ProductBulkDiscountSlab** | Tiered quantity-based pricing |
| **ProductVariantOption** | Size/color variants |
| **ProductVariantInventory** | Stock per variant |
| **Order** | Customer orders with status lifecycle |
| **OrderItem** | Line items within an order |
| **Subscription** | Plan tier & validity per company |
| **CatalogueVisitorMapper** | Tracks visitors to catalogues |
| **CustomerAccessRequest** | Access requests for private catalogues |

---

## 📦 API Modules

### 🔐 Auth (`/auth`)
- User registration with unique username validation
- Secure login with bcrypt password verification
- JWT token generation for session management

### 🏢 Company (`/company`)
- Company profile management
- Linked to authenticated user

### 📒 Catalogue (`/catalogue`)
- Full CRUD for catalogues
- Privacy level support: **PUBLIC** and **PRIVATE**
- Customer access request & approval system
- Slug-based public catalogue lookup

### 📦 Product (`/product`)
- Full CRUD for products within catalogues
- Multi-image uploads via Cloudinary
- Bulk discount slabs (tiered pricing)
- Size/Color variant options with inventory tracking
- Reorder level & max stock configuration

### 🛒 Order (`/order`)
- Order booking with line items
- Status lifecycle: `UNCONFIRMED → CONFIRMED → ACCEPTED → COMPLETED / REJECTED`
- Discount and shipping charge adjustments
- Customer-side item deletion

### 📊 Admin (`/admin`)
- Platform-wide dashboard statistics
- Company registry with subscription details
- Merchant performance analytics (GMV, orders, AOV)
- **Store-level deep insights** (top products, top catalogues)
- Subscription renewal & plan upgrades

---

## 🌐 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register new user & company |
| `POST` | `/auth/login` | Login & receive JWT |
| `GET` | `/auth/check-username/:username` | Check username availability |

### Catalogue
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/catalogue/fetch` | Fetch all catalogues for logged-in user |
| `POST` | `/catalogue/add` | Create a new catalogue |
| `PUT` | `/catalogue/update` | Update catalogue details |
| `DELETE` | `/catalogue/delete/:id` | Soft-delete a catalogue |
| `PUT` | `/catalogue/update-privacy` | Set PUBLIC/PRIVATE |
| `GET` | `/catalogue/public/:slug` | Public catalogue lookup |
| `POST` | `/catalogue/request-access` | Request access to private catalogue |
| `GET` | `/catalogue/access-requests` | View pending access requests |
| `PUT` | `/catalogue/handle-access-request` | Approve/Reject access |

### Product
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/product/fetch/:catalogueId` | Fetch products in a catalogue |
| `POST` | `/product/add` | Add a product |
| `PUT` | `/product/update` | Update product details |
| `DELETE` | `/product/delete/:id` | Soft-delete a product |
| `POST` | `/product/upload-images` | Upload product images |
| `DELETE` | `/product/delete-image/:id` | Delete a product image |

### Order
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/order/fetch` | Fetch all orders |
| `GET` | `/order/fetch/:order_id` | Fetch order details |
| `PUT` | `/order/update-status` | Update order status |
| `PUT` | `/order/update-discount` | Apply discount |
| `PUT` | `/order/update-shipping` | Set shipping charge |
| `POST` | `/order/book` | Book a new order |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/dashboard-stats` | Platform KPI metrics |
| `GET` | `/admin/companies` | Full company registry |
| `GET` | `/admin/analytics` | Merchant performance data |
| `GET` | `/admin/store-insights/:companyId` | Deep store-level analytics |
| `POST` | `/admin/renew-subscription` | Renew/upgrade subscription |

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- PostgreSQL database
- Cloudinary account (for image uploads)

### Installation

```bash
# Clone the repository
git clone https://github.com/Gamerakki/vatikartnodejs.git
cd vatikartnodejs

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL, JWT secret, Cloudinary keys

# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `PORT` | Server port (default: 3000) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

---

## 📜 Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Start dev server with ts-node |
| `build` | `npm run build` | Compile TypeScript |
| `start` | `npm start` | Run compiled JS (production) |

---

<p align="center">
  Built with ❤️ for <strong>VatiKart</strong>
</p>
