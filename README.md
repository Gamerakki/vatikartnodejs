<p align="center">
  <img src="https://img.shields.io/badge/VatiKart-Backend%20API-0D9488?style=for-the-badge&logo=node.js&logoColor=white" alt="VatiKart Backend" />
</p>

# 🚀 VatiKart — Backend API

The core RESTful API server powering the entire VatiKart platform. Originally migrated from Go, now built with **Express.js**, **TypeScript**, and **Prisma ORM** on **PostgreSQL**.

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Database Models](#-database-models)
- [API Endpoints](#-api-endpoints)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
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
| **Cloudflare R2 / AWS S3** | Image & File Storage |
| **Sharp** | Image Processing |
| **Multer** | File Upload Handling |
| **Redis (ioredis)** | Caching Layer |
| **Pino** | Structured Logging |
| **ExcelJS** | Excel Bulk Import |
| **Brevo (Sendinblue)** | Transactional Emails |
| **CORS** | Cross-Origin Requests |

---

## 🏗 Architecture

```
src/
├── app.ts                        # Express app setup, middleware, route mounting
├── server.ts                     # HTTP server, graceful shutdown, self-ping
├── seedAdmin.ts                  # Seeds default admin user
├── config/
│   ├── database.ts               # Prisma client singleton
│   ├── redis.ts                  # Redis client with graceful fallback
│   ├── jwt.ts                    # JWT generation & validation (HS256)
│   └── logger.ts                 # Pino structured logger
├── middlewares/
│   ├── auth.ts                   # validateAuth, validateNoAuth, validateOptionalAuth
│   └── userActivity.ts           # Tracks user last active time
├── modules/
│   ├── admin/                    # Platform analytics & subscription management
│   ├── user/                     # Registration, login, JWT token generation
│   ├── company/                  # Store profile, logo, social media, contacts
│   ├── catalogue/                # Catalogue CRUD, privacy, access control
│   ├── product/                  # Product CRUD, images, variants, bulk import
│   ├── order/                    # Order lifecycle (book, status, discount, shipping)
│   └── social_media_master/      # Social media platform lookup
└── utils/
    ├── s3.ts                     # Cloudflare R2 upload/delete/presigned URLs
    ├── mailer.ts                 # Brevo transactional email
    └── common.ts                 # Timezone, random tokens, sanitization
```

Each module follows a clean **layered architecture**:
```
module/
├── module.router.ts              # Route definitions
├── module.controller.ts          # Request handling & response
├── module.service.ts             # Business logic
├── module.repository.ts          # Database queries (Prisma)
├── module.validation.ts          # Zod schemas
└── module.interface.ts           # TypeScript interfaces
```

---

## 🗄 Database Models (15 Total)

| Model | Table | Description |
|---|---|---|
| **User** | `users` | Store owners (auth, profile, isAdmin flag) |
| **Company** | `company` | Business entity with logo, address, contacts |
| **CompanySocialMediaMapper** | `company_social_media_mapper` | Social media links per company |
| **SocialMediaMaster** | `social_media_master` | Platform lookup (Instagram, Facebook, etc.) |
| **Catalogue** | `catalogues` | Product catalogues with privacy (PUBLIC/PRIVATE) |
| **Product** | `products` | Items with price modes, SKU, min order qty |
| **ProductImage** | `product_images` | Multiple images per product |
| **ProductBulkDiscountSlab** | `product_bulk_discount_slabs` | Tiered quantity-based pricing |
| **ProductVariantOption** | `product_variant_options` | Size/Color variant options |
| **ProductVariantInventory** | `product_variant_inventories` | Stock per variant |
| **Order** | `orders` | Customer orders with status lifecycle |
| **OrderItem** | `order_items` | Line items within an order |
| **Subscription** | `subscriptions` | Plan tier & validity per company |
| **CatalogueVisitorMapper** | `catalogue_visitor_mapper` | Tracks catalogue visitors |
| **CustomerAccessRequest** | `customer_access_requests` | Access requests for private catalogues |

---

## 🌐 API Endpoints

### 👤 User (`/user`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/user/register` | No Auth | Register new user & company |
| `POST` | `/user/login` | No Auth | Login & receive JWT |
| `GET` | `/user/check-duplicate-username` | Optional | Check username availability |
| `GET` | `/user/check-email-address` | Optional | Check email availability |
| `GET` | `/user/validate-token` | Required | Validate JWT token |

### 🏢 Company (`/company`) — All Require Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/company/save` | Create/update company (multipart, logo upload) |
| `GET` | `/company/fetch-data` | Fetch company profile |
| `POST` | `/company/save-social-media` | Save social media links |
| `PATCH` | `/company/save-support-contact-details` | Update support contact |
| `GET` | `/company/fetch-support-contact-details` | Get support contact |
| `PATCH` | `/company/save-sales-contact-details` | Update sales contact |
| `GET` | `/company/fetch-sales-contact-details` | Get sales contact |

### 📒 Catalogue (`/catalogue`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/catalogue/public/:id/products` | Public | Fetch public catalogue products |
| `POST` | `/catalogue/public/:id/request-access` | Public | Request access to private catalogue |
| `POST` | `/catalogue/save` | Required | Create/update catalogue |
| `GET` | `/catalogue/fetch-list` | Required | Fetch all catalogues |
| `GET` | `/catalogue/fetch-data/:id` | Required | Fetch single catalogue |
| `DELETE` | `/catalogue/delete` | Required | Soft-delete catalogue |
| `PATCH` | `/catalogue/privacy/:id` | Required | Set PUBLIC/PRIVATE |
| `GET` | `/catalogue/access-requests` | Required | View pending access requests |
| `PATCH` | `/catalogue/access-request/:id` | Required | Approve/Reject access |
| `GET` | `/catalogue/fetch-deleted-list` | Required | View deleted catalogues |
| `PATCH` | `/catalogue/restore` | Required | Restore deleted catalogue |

### 📦 Product (`/product`) — All Require Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/product/create` | Create a product |
| `GET` | `/product/fetch-list/:catalogue_id` | Fetch products in a catalogue |
| `PATCH` | `/product/save-basic-info` | Update product details |
| `GET` | `/product/fetch-basic-info/:product_id` | Get product details |
| `POST` | `/product/gen-product-img-upload-url` | Generate presigned upload URL |
| `PATCH` | `/product/save-variant-options` | Save size/color variants |
| `PATCH` | `/product/save-inventory` | Update variant inventory |
| `GET` | `/product/fetch-inventory/:product_id` | Get product inventory |
| `GET` | `/product/inventory/list` | Inventory listing |
| `GET` | `/product/inventory/stats` | Inventory statistics |
| `PATCH` | `/product/inventory/restock` | Restock inventory |
| `POST` | `/product/bulk-import/:catalogue_id` | Bulk import via Excel |

### 🛒 Order (`/order`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/order/public/book` | Public | Book a new order |
| `GET` | `/order/fetch-list` | Required | Fetch all orders |
| `GET` | `/order/fetch-data/:order_id` | Required | Fetch order details |
| `PATCH` | `/order/update-status` | Required | Update order status |
| `PATCH` | `/order/update-discount` | Required | Apply discount |
| `PATCH` | `/order/update-shipping` | Required | Set shipping charge |

### 📊 Admin (`/admin`) — All Require Auth
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/dashboard-stats` | Platform KPI metrics |
| `GET` | `/admin/companies` | Full company registry |
| `GET` | `/admin/analytics` | Merchant performance data |
| `GET` | `/admin/store-insights/:companyId` | Deep store-level analytics |
| `POST` | `/admin/renew-subscription` | Renew/upgrade subscription |

### 🔗 Social Media Master (`/master`) — All Require Auth
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/master/fetch-social-medias` | Fetch all platforms |
| `GET` | `/master/fetch-company-social-medias` | Fetch company's social links |

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- PostgreSQL database
- Cloudflare R2 or AWS S3 bucket (for file storage)
- Redis (optional, for caching)

### Installation

```bash
# Clone the repository
git clone https://github.com/Gamerakki/vatikartnodejs.git
cd vatikartnodejs

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL, JWT secret, R2/S3 keys

# Generate Prisma client
npx prisma generate

# Run Prisma migrations
npx prisma migrate dev

# Seed admin user (optional)
npx ts-node src/seedAdmin.ts

# Start development server
npm run dev
```

The server starts at `http://localhost:8080`.

---

## 🔑 Environment Variables

| Category | Variable | Description |
|---|---|---|
| **Server** | `PORT` | Server port (default: 8080) |
| **Server** | `NODE_ENV` | Environment (development/production) |
| **Database** | `DATABASE_URL` | PostgreSQL connection string |
| **Auth** | `JWT_SECRET` | Secret key for JWT signing |
| **Auth** | `TOKEN_HOUR_LIFESPAN` | JWT expiry in hours (default: 1) |
| **Redis** | `REDIS_ADDR` | Redis connection URL |
| **Storage** | `BUCKET` | R2/S3 bucket name |
| **Storage** | `ACCESS_KEY_ID` | R2/S3 access key |
| **Storage** | `SECRET_ACCESS_KEY` | R2/S3 secret key |
| **Storage** | `S3_ENDPOINT` | R2/S3 endpoint URL |
| **Storage** | `PUBLIC_BUCKET_URL` | CDN URL for public assets |
| **Email** | `BREVO_API_KEY` | Brevo transactional email API key |
| **CORS** | `ALLOWED_ORIGINS` | Comma-separated allowed origins |

---

## 🚢 Deployment

### Render (Production)
The project includes a `render.yaml` for one-click deployment on Render:
- **Build**: `npm install --include=dev && npx prisma generate && npm run build`
- **Start**: `npm start`
- **Self-ping**: The server pings itself every 14 minutes at `/robots.txt` to prevent Render free tier from sleeping

### Custom Domain
- API: `https://api.vatikart.in`
- CDN: `https://cdn.vatikart.in` (Cloudflare R2)

---

## 📜 Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Start dev server with ts-node-dev (hot reload) |
| `build` | `npm run build` | Compile TypeScript to `dist/` |
| `start` | `npm start` | Run compiled JS (production) |
| `prisma:generate` | `npx prisma generate` | Generate Prisma client |
| `prisma:studio` | `npx prisma studio` | Open Prisma Studio GUI |

---

<p align="center">
  Built with ❤️ for <strong>VatiKart</strong>
</p>
