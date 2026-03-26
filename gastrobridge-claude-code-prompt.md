# GASTROBRIDGE — Prompt di Implementazione Claude Code
## Marketplace B2B Ho.Re.Ca. — MVP v1.0

---

## OVERVIEW

GastroBridge è un marketplace B2B che aggrega fornitori Ho.Re.Ca., permettendo ai ristoratori del Nord Italia di confrontare prezzi, scoprire fornitori e gestire ordini da un unico punto. Modello ispirato a Facile.it. Revenue: doppio abbonamento (ristoratore + fornitore).

## TECH STACK

- **Framework:** Next.js 15 (App Router, RSC, Server Actions), TypeScript strict
- **Styling:** Tailwind CSS 4, Framer Motion 12+, GSAP (landing page)
- **Backend/DB:** Supabase (Postgres, Auth, Edge Functions, Realtime, Storage)
- **Search:** Meilisearch (instant search prodotti, fuzzy, faceted filters)
- **Payments:** Stripe Billing + Checkout + Customer Portal
- **Email:** Resend + React Email
- **Analytics:** PostHog
- **Hosting:** Vercel (frontend) + Fly.io (Meilisearch)

---

## BRAND & DESIGN SYSTEM

### Nome: GastroBridge
"Gastro" (gastronomia) + "Bridge" (ponte). Il ponte tra ristoratori e fornitori. Nome bilingue, professionale, scalabile internazionalmente. Abbreviabile in "GB" per icon/favicon.

**Tagline:** "Tutti i tuoi fornitori. Un solo posto."
**Tagline alternativa:** "Confronta. Ordina. Risparmia."

### Palette
```css
:root {
  --forest: #1B6B4A;
  --forest-dark: #145238;
  --forest-light: #E8F5EE;
  --cream: #FAF8F5;
  --charcoal: #1A1A1A;
  --terracotta: #C4520A;
  --terracotta-light: #FFF3E0;
  --sage: #94A89A;
  --sage-muted: #D4DDD7;
}
```

### Tailwind Config
```typescript
colors: {
  forest: { DEFAULT: '#1B6B4A', dark: '#145238', light: '#E8F5EE' },
  cream: '#FAF8F5',
  charcoal: '#1A1A1A',
  terracotta: { DEFAULT: '#C4520A', light: '#FFF3E0' },
  sage: { DEFAULT: '#94A89A', muted: '#D4DDD7' },
},
fontFamily: {
  display: ['DM Serif Display', 'Georgia', 'serif'],
  body: ['Satoshi', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],
},
```

### Logo
Mark: icona a forma di ponte stilizzato con arco che richiama un piatto/cloche. Sotto il ponte, due frecce che si incontrano (domanda e offerta). Wordmark: "Gastro" in DM Serif Display 700 charcoal + "Bridge" in Satoshi 700 forest green. Favicon: "GB" in quadrato arrotondato forest con accent dot Terracotta.

### Typography Rules
- H1: DM Serif Display, 48px, charcoal, -0.03em
- H2: Satoshi 700, 28px, charcoal
- Body: Satoshi 400, 16px, charcoal, line-height 1.6
- Prezzi: JetBrains Mono 700, 24px+, forest (miglior prezzo) o charcoal
- Badge: Satoshi 600, 12px, uppercase, 0.05em spacing

### UI Rules
- Cards: bg-white rounded-2xl p-6 shadow-sm
- Buttons: rounded-xl py-3.5 px-6. Primary: bg-forest text-white. Secondary: border-2 border-forest text-forest
- Inputs: border-2 border-sage-muted rounded-xl focus:border-forest py-3.5 px-4
- Tables: header bg-gray-50, best price row bg-forest-light
- Shadows: card `0 2px 12px rgba(0,0,0,0.05)`, elevated `0 4px 24px rgba(0,0,0,0.08)`

---

## STRUTTURA DIRECTORY

```
gastrobridge/
├── app/
│   ├── (auth)/login/page.tsx, signup/page.tsx, layout.tsx
│   ├── (marketing)/page.tsx, fornitori/page.tsx, pricing/page.tsx, layout.tsx
│   ├── (app)/                          # Area ristoratore (autenticata)
│   │   ├── layout.tsx                  # Sidebar + TopBar
│   │   ├── dashboard/page.tsx
│   │   ├── cerca/page.tsx              # Ricerca + confronto prezzi
│   │   ├── cerca/[productId]/page.tsx
│   │   ├── fornitori/page.tsx, [id]/page.tsx
│   │   ├── ordini/page.tsx, [id]/page.tsx
│   │   ├── carrello/page.tsx           # Carrello multi-fornitore
│   │   ├── analytics/page.tsx          # Pro+
│   │   └── impostazioni/page.tsx, sedi/, team/, abbonamento/
│   ├── (supplier)/                     # Area fornitore (autenticata)
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── catalogo/page.tsx, nuovo/, [id]/, import/
│   │   ├── ordini/page.tsx, [id]/page.tsx
│   │   ├── clienti/page.tsx
│   │   ├── analytics/page.tsx          # Growth+
│   │   ├── recensioni/page.tsx
│   │   └── impostazioni/page.tsx, zone/, abbonamento/
│   └── api/webhooks/stripe/, webhooks/supabase/, search/sync/, cron/price-alerts/
├── components/
│   ├── ui/                    # Button, Input, Card, Modal, Badge, Select, Toast, Skeleton
│   ├── layout/                # Sidebar, TopBar, MobileNav, Footer
│   ├── marketing/             # Hero, HowItWorks, Categories, Testimonials, CTASection
│   ├── products/              # ProductSearch, ProductCard, PriceCompareTable, Filters, CategoryNav
│   ├── orders/                # Cart, CartSplitView, OrderCard, OrderTimeline, QuickReorder, SavedTemplates
│   ├── suppliers/             # SupplierCard, SupplierProfile, ProductForm, CSVImporter, DeliveryZoneMap
│   ├── dashboard/             # SpendChart, TopProducts, DeliveryCalendar, SavingsAlert, StatsGrid
│   └── reviews/               # ReviewForm, ReviewCard, RatingStars
├── lib/
│   ├── supabase/client.ts, server.ts, admin.ts, middleware.ts
│   ├── stripe/client.ts, plans.ts, webhooks.ts
│   ├── meilisearch/client.ts, sync.ts, indexes.ts
│   ├── email/client.ts, templates/
│   ├── utils/formatters.ts, validators.ts, constants.ts
│   └── hooks/useCart.ts, useSearch.ts, useRealtime.ts, useSubscription.ts
├── types/database.ts, products.ts, orders.ts, suppliers.ts, restaurants.ts
├── supabase/migrations/ (001-012), seed.sql, functions/
├── middleware.ts
└── tailwind.config.ts, next.config.ts
```

---

## DATABASE SCHEMA

### profiles
```sql
CREATE TYPE user_role AS ENUM ('restaurant', 'supplier', 'admin');
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  company_name TEXT NOT NULL,
  vat_number TEXT,
  phone TEXT, avatar_url TEXT,
  address TEXT, city TEXT, province TEXT, zip_code TEXT,
  latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### restaurants
```sql
CREATE TYPE cuisine_type AS ENUM ('italiana','pizzeria','pesce','carne','giapponese','fusion','bistrot','trattoria','gourmet','altro');
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL, cuisine cuisine_type, covers INTEGER,
  address TEXT, city TEXT, province TEXT, zip_code TEXT,
  latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
  phone TEXT, email TEXT, website TEXT,
  opening_hours JSONB, is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### suppliers
```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL, description TEXT,
  logo_url TEXT, cover_url TEXT, website TEXT, email TEXT, phone TEXT,
  address TEXT, city TEXT, province TEXT, zip_code TEXT,
  latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
  min_order_amount DECIMAL(10,2),
  delivery_days JSONB, delivery_hours JSONB,
  certifications TEXT[],
  rating_avg DECIMAL(2,1) DEFAULT 0, rating_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE, is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### categories + subcategories
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, icon TEXT, sort_order INTEGER DEFAULT 0
);
CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL, slug TEXT NOT NULL, sort_order INTEGER DEFAULT 0,
  UNIQUE(category_id, slug)
);
-- Seed: Food Fresco, Food Secco, Bevande, Surgelati, Packaging, Cleaning, Attrezzature
```

### products
```sql
CREATE TYPE unit_type AS ENUM ('kg','g','lt','ml','pz','cartone','bottiglia','latta','confezione');
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  subcategory_id UUID REFERENCES subcategories(id),
  name TEXT NOT NULL, description TEXT, brand TEXT, sku TEXT,
  unit unit_type NOT NULL, price DECIMAL(10,2) NOT NULL,
  min_quantity DECIMAL(10,2) DEFAULT 1, max_quantity DECIMAL(10,2),
  image_url TEXT, certifications TEXT[], origin TEXT,
  is_available BOOLEAN DEFAULT TRUE, is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Indexes: supplier_id, category_id, GIN on name (italian tsvector), price
```

### orders + order_items + order_splits
```sql
CREATE TYPE order_status AS ENUM ('draft','submitted','confirmed','preparing','shipping','delivered','cancelled');
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status order_status DEFAULT 'draft', notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL, subtotal DECIMAL(10,2) NOT NULL,
  notes TEXT
);
CREATE TABLE order_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  status order_status DEFAULT 'submitted',
  confirmed_at TIMESTAMPTZ, shipped_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ,
  supplier_notes TEXT,
  UNIQUE(order_id, supplier_id)
);
```

### reviews, subscriptions, price_history, delivery_zones, saved_orders
```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  supplier_id UUID REFERENCES suppliers(id),
  order_id UUID REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  quality_rating INTEGER, delivery_rating INTEGER, service_rating INTEGER,
  comment TEXT, supplier_reply TEXT, supplier_replied_at TIMESTAMPTZ
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan plan_type NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT, stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ, current_period_end TIMESTAMPTZ
);

CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL, recorded_at TIMESTAMPTZ DEFAULT NOW()
);
-- Trigger: on products UPDATE, if price changed, INSERT into price_history
-- Trigger: on products INSERT, INSERT initial price into price_history

CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  zone_name TEXT, provinces TEXT[], zip_codes TEXT[],
  geometry GEOMETRY(POLYGON, 4326),
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  free_delivery_above DECIMAL(10,2)
);

CREATE TABLE saved_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, items JSONB NOT NULL
);
```

### RLS Policies
- Products: SELECT for everyone, ALL for supplier owner
- Orders: SELECT/INSERT for restaurant owner
- Order splits: SELECT/UPDATE for supplier owner
- Reviews: SELECT for everyone, INSERT for restaurant owner
- Profiles: own profile only
- Subscriptions: own only

---

## FEATURE IMPLEMENTATION GUIDE

### 1. PriceCompareTable (IL componente core)
- Tabella ordinata per prezzo crescente
- Highlight bg-forest-light sulla riga miglior prezzo
- Badge: "Miglior prezzo", "Più venduto", "Nuovo", "Consegna domani", "BIO", "DOP"
- Colonne: Fornitore (nome+rating), Prezzo/unità (JetBrains Mono bold), Consegna, Rating, Zone, CTA
- Click riga → espande dettagli fornitore
- CTA "Aggiungi al carrello" con qty inline
- Mobile: card stack, non tabella
- Framer Motion stagger sulle righe

### 2. Carrello Multi-Fornitore
- Context globale con localStorage
- Prodotti da fornitori diversi nello stesso carrello
- Vista split pre-checkout: raggruppamento per fornitore
- Warning se sotto ordine minimo
- Checkout → 1 ordine + N order_splits
- Supabase Realtime: fornitore vede nuovo ordine live

### 3. Alert Risparmio (Pro+)
- Cron ogni 6 ore
- Analizza order_items ultimi 30gg per ristoratore Pro+
- Cerca prodotti equivalenti a prezzo inferiore nella stessa zona
- Notifica email + in-app con "Cambia fornitore" CTA

### 4. Auth Flow
- Signup differenziato: "Sono un Ristoratore" / "Sono un Fornitore"
- Email + password, Magic Link, Google OAuth
- Onboarding wizard post-signup (profilo, P.IVA, indirizzo, preferenze)
- Middleware: redirect basato su role (restaurant → /app, supplier → /supplier)

### 5. Stripe Integration
- Piani ristoratore: Free (€0), Pro (€49/mese), Business (€99/mese)
- Piani fornitore: Base (€79/mese), Growth (€149/mese), Enterprise (€299/mese)
- Webhook handler per subscription lifecycle
- Feature gating basato su piano in middleware + server components
- Customer Portal per gestione abbonamento

### 6. Meilisearch Setup
- Index "products" con: name, brand, description, category, subcategory, certifications, origin
- Filterable attributes: category_id, subcategory_id, supplier_id, unit, certifications, price range
- Sortable: price, rating, created_at
- Sync: trigger Supabase → API route → Meilisearch update

---

## BUILD PRIORITY

1. Setup progetto + auth + database migrations + seed
2. Landing page marketing
3. Catalogo + ricerca + PriceCompareTable
4. Carrello multi-fornitore + checkout
5. Dashboard fornitore (catalogo CRUD + CSV import + ordini)
6. Dashboard ristoratore (stats + ordini + alert + riordino)
7. Stripe integration + feature gating
8. Reviews + rating
9. Analytics spesa

## REGOLE CODICE

- TypeScript strict, no `any`
- Server Components default, `"use client"` solo dove serve
- Server Actions per mutations
- Framer Motion per transitions e micro-interactions
- Skeleton loading su tutte le pagine async
- Mobile-first: funziona da 375px+
- WCAG AA accessibility
- Error boundaries per route group
- Toast feedback per tutte le azioni utente

## ENV VARIABLES

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_RESTAURANT_PRO=
STRIPE_PRICE_RESTAURANT_BUSINESS=
STRIPE_PRICE_SUPPLIER_BASE=
STRIPE_PRICE_SUPPLIER_GROWTH=
STRIPE_PRICE_SUPPLIER_ENTERPRISE=
MEILISEARCH_HOST=
MEILISEARCH_API_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
NEXT_PUBLIC_APP_URL=https://gastrobridge.it
```
