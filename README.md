# Review Shopify App — Hướng dẫn setup từ đầu

Tài liệu này hướng dẫn setup toàn bộ hệ thống: từ tạo app trên Shopify Partners, cấu hình OAuth, deploy backend, tới việc chèn giao diện review vào theme của một shop.

## Mục lục

1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
2. [Tạo tài khoản & app trên Shopify Partners](#2-tạo-tài-khoản--app-trên-shopify-partners)
3. [Cài đặt công cụ trên máy dev](#3-cài-đặt-công-cụ-trên-máy-dev)
4. [Kết nối project với app Shopify](#4-kết-nối-project-với-app-shopify)
5. [Cấu hình `shopify.app.toml`](#5-cấu-hình-shopifyapptoml)
6. [Setup backend (NestJS)](#6-setup-backend-nestjs)
7. [Tạo Metaobject & Metafield definition trên Shopify Admin](#7-tạo-metaobject--metafield-definition-trên-shopify-admin)
8. [Deploy backend lên server](#8-deploy-backend-lên-server)
9. [Deploy config app + Theme Extension](#9-deploy-config-app--theme-extension)
10. [Connect app vào một shop](#10-connect-app-vào-một-shop)
11. [Chèn section review vào theme](#11-chèn-section-review-vào-theme)
12. [Kiểm tra luồng end-to-end](#12-kiểm-tra-luồng-end-to-end)
13. [Sự cố thường gặp](#13-sự-cố-thường-gặp)

---

## 1. Kiến trúc tổng quan

Hệ thống gồm 3 phần tách biệt:

| Phần | Vai trò | Chạy ở đâu |
|---|---|---|
| **Backend (NestJS)** | API quản trị review, OAuth, sync dữ liệu lên Shopify, nhận review từ storefront | Server riêng (VPS/hosting của bạn) |
| **Admin React** | Giao diện quản lý review nội bộ (đăng nhập email/password) | Deploy tĩnh (Vercel/Netlify/VPS) |
| **Theme App Extension** | Hiển thị review + form submit ngay trên storefront của shop | Host bởi hạ tầng Shopify, chỉ cần deploy qua CLI |

**1 app Shopify duy nhất** (tạo trên Partner Dashboard) được nhiều shop khác nhau cài đặt qua OAuth chuẩn — không phải mỗi shop một app riêng.

Luồng dữ liệu:
```
Admin React / Storefront form
        ↓
   Backend NestJS (Postgres lưu review)
        ↓ (BullMQ job, bất đồng bộ)
   Shopify Admin API (Metaobject "review" + Product Metafield "reviews")
        ↓
   Theme App Extension (Liquid đọc trực tiếp Metafield, không gọi lại backend)
        ↓
   Storefront hiển thị cho khách
```

---

## 2. Tạo tài khoản & app trên Shopify Partners

### 2.1. Tạo tài khoản Partner

1. Vào [partners.shopify.com](https://partners.shopify.com) → **Sign up**.
2. Tạo tổ chức (Organization) — đây sẽ là nơi quản lý app và các dev store.

### 2.2. Tạo dev store để test

1. Trong Partner Dashboard → **Stores** → **Add store** → **Development store**.
2. Điền tên store, chọn mục đích "Test an app or theme".
3. Ghi nhớ domain dạng `xxxx.myshopify.com` — dùng để test toàn bộ luồng sau này.

### 2.3. Tạo app

1. Partner Dashboard → **Apps** → **Create app**.
2. Chọn **Create app manually** (không cần chọn Public/Custom lúc này, có thể đổi Distribution sau).
3. Đặt tên app.
4. Vào phần **Dev Dashboard** của app vừa tạo → **App settings** → phần **Credentials** → ghi lại:
   - **Client ID**
   - **Client secret** (bấm icon mắt để hiện)

Hai giá trị này dùng chung cho **mọi shop** cài app — không phải giá trị riêng theo từng shop.

---

## 3. Cài đặt công cụ trên máy dev

### 3.1. Node.js

Yêu cầu Node.js 18+. Kiểm tra:
```bash
node -v
```

### 3.2. Shopify CLI

```bash
npm install -g @shopify/cli
```

Kiểm tra:
```bash
shopify version
```

### 3.3. Đăng nhập CLI

```bash
shopify auth login
```

Trình duyệt sẽ mở ra để đăng nhập bằng tài khoản Partner đã tạo ở Bước 2.

---

## 4. Kết nối project với app Shopify

Trong thư mục gốc chứa code backend, chạy:

```bash
shopify app config link
```

CLI sẽ hỏi:
1. **Organization** — chọn tổ chức Partner của bạn.
2. **App** — chọn app đã tạo ở Bước 2.3.

Lệnh này tự sinh file `shopify.app.toml` ở thư mục gốc, chứa `client_id` và cấu hình app. File này **không đụng gì tới code backend hiện có**.

---

## 5. Cấu hình `shopify.app.toml`

Mở file vừa tạo, chỉnh sửa theo mẫu sau (thay domain bằng domain backend thật của bạn):

```toml
client_id = "YOUR_CLIENT_ID"
application_url = "https://your-backend-domain.com"
embedded = false
name = "your-app-name"

[webhooks]
api_version = "2026-07"

[[webhooks.subscriptions]]
topics = ["app/uninstalled"]
uri = "/webhooks/app-uninstalled"

[access_scopes]
scopes = "read_metaobjects,write_metaobjects,read_files,write_files,read_online_store_pages,write_online_store_pages,read_product_feeds,write_product_feeds,read_product_listings,write_product_listings,read_products,write_products,read_themes,write_themes"
optional_scopes = [ ]
use_legacy_install_flow = false

[auth]
redirect_urls = [ "https://your-backend-domain.com/auth/callback" ]

[app_proxy]
url = "https://your-backend-domain.com/apps/reviews"
subpath = "reviews"
prefix = "apps"
```

**Lưu ý quan trọng:**
- `embedded = false` — app này không chạy trong iframe Admin, vì Admin thật (React) có hệ thống đăng nhập riêng, không dùng App Bridge.
- `application_url`/`redirect_urls` phải là domain **HTTPS thật**, không dùng được `localhost`.
- `[app_proxy]` quyết định URL công khai trên storefront sẽ là `https://{shop}/apps/reviews/...`.

Sau khi sửa xong, đẩy config lên Partner Dashboard:
```bash
shopify app deploy
```

---

## 6. Setup backend (NestJS)

### 6.1. Biến môi trường (`.env`)

```dotenv
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=your_database

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Shopify — dùng CHUNG cho mọi shop, lấy từ Bước 2.3
SHOPIFY_API_KEY=your_client_id
SHOPIFY_API_SECRET=your_client_secret
SHOPIFY_SCOPES=read_metaobjects,write_metaobjects,read_files,write_files,read_online_store_pages,write_online_store_pages,read_product_feeds,write_product_feeds,read_product_listings,write_product_listings,read_products,write_products,read_themes,write_themes
SHOPIFY_APP_URL=https://your-backend-domain.com
SHOPIFY_API_VERSION=2026-07
SHOPIFY_REVIEW_METAOBJECT_TYPE=review

# JWT (Admin login nội bộ)
JWT_ACCESS_SECRET=random_string_dai
JWT_ACCESS_EXPIRES_IN=15m

# Frontend Admin React (redirect sau khi cài app xong)
FRONTEND_URL=https://your-admin-frontend.com

# Upload ảnh (Cloudinary hoặc dịch vụ tương đương)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=review_upload
```

### 6.2. Migration database

Chạy migration để tạo các bảng: `shops`, `reviews`, `review_images`, `users`, `refresh_tokens`...

```bash
npm run db:migrate
```

Bảng `shops` cần các cột: `id`, `name`, `id_shopify` (domain shop), `access_token`, `scope`, `is_active`.

### 6.3. Chạy backend local để test

```bash
npm run start:dev
```

---

## 7. Tạo Metaobject & Metafield definition trên Shopify Admin

Đây là bước **bắt buộc làm thủ công 1 lần cho mỗi shop mới** (chưa tự động hoá — cần lưu ý khi có shop mới cài app).

### 7.1. Metaobject definition "Review"

Vào **Shopify Admin → Content → Metaobjects → Add definition**:

- **Name**: `Review`
- **Type**: `review` (phải khớp chính xác biến `SHOPIFY_REVIEW_METAOBJECT_TYPE` trong `.env`)
- Thêm các field sau (Key phải khớp chính xác):

| Key | Type |
|---|---|
| `rating` | Integer |
| `status` | Single line text |
| `verified` | True or false |
| `author_name` | Single line text |
| `author_email` | Single line text |
| `title` | Single line text |
| `body` | Multi-line text |
| `source` | Single line text |
| `product` | Reference → Product |
| `images` | List of references → File |
| `created_at` | Date and time |

### 7.2. Product Metafield definition "reviews"

Vào **Settings → Custom data → Products → Add definition**:

- **Name**: `Reviews`
- **Namespace and key**: `custom.reviews` (bấm vào link nhỏ dưới ô Name để sửa tay **trước khi Save** — không sửa được sau khi tạo)
- **Type**: Reference → Metaobject → đổi **"One" thành "List"** → chọn metaobject type **Review** (definition vừa tạo ở 7.1)

⚠️ Nếu chọn nhầm namespace hoặc metaobject type sai, phải **xoá definition và tạo lại từ đầu** — không sửa được sau khi Save.

---

## 8. Deploy backend lên server

Deploy code backend lên VPS/hosting thật (không phải Shopify host phần này).

```bash
# Trên server
git pull
npm install
npm run build
pm2 restart your-app-name --update-env
```

Đảm bảo:
- Domain backend trỏ đúng, có HTTPS hợp lệ (Let's Encrypt hoặc tương đương).
- `.env` trên server đã điền đủ như Bước 6.1 (dùng đúng domain production, không phải `localhost`).
- Redis và Postgres đang chạy và backend kết nối được.

---

## 9. Deploy config app + Theme Extension

### 9.1. Tạo Theme App Extension (nếu chưa có)

```bash
shopify app generate extension
```
Chọn **Theme app extension**, đặt tên (ví dụ `reviews-widget`).

Cấu trúc sinh ra:
```
extensions/reviews-widget/
├── blocks/
├── assets/
├── snippets/
├── locales/
└── shopify.extension.toml
```

### 9.2. Deploy

```bash
shopify app deploy
```

Lệnh này đẩy cả cấu hình app (`shopify.app.toml`) lẫn nội dung extension (Liquid/CSS/JS) lên Partner Dashboard. Xác nhận `y` khi được hỏi release version mới.

---

## 10. Connect app vào một shop

Vì dùng OAuth chuẩn, mỗi shop (kể cả shop mới) chỉ cần 1 bước:

Truy cập:
```
https://your-backend-domain.com/auth/install?shop={shop-domain}.myshopify.com
```

Luồng xảy ra:
1. Redirect sang trang Shopify xin cấp quyền.
2. Merchant bấm **Install app**.
3. Shopify gọi lại `/auth/callback`, backend verify chữ ký, đổi code lấy `access_token`, lưu vào bảng `shops`.
4. Redirect merchant về `FRONTEND_URL` (Admin React).

Sau bước này, shop đã sẵn sàng để tạo/sync review.

**Gỡ cài đặt:** khi merchant gỡ app trên Shopify Admin, webhook `app/uninstalled` tự động set `is_active = false` trong DB (không xoá dữ liệu).

---

## 11. Chèn section review vào theme

1. Vào **Shopify Admin của shop → Online Store → Themes → Customize**.
2. Mở 1 trang sản phẩm bất kỳ trong preview.
3. Bấm **Add block** trong khu vực template sản phẩm.
4. Tìm và thêm 2 block:
   - **Rating Badge** — đặt ngay dưới tên sản phẩm.
   - **Product Reviews** — đặt ở vị trí muốn hiển thị toàn bộ danh sách review + form viết review (thường cuối trang, dưới mô tả sản phẩm).
5. Bấm **Save**.

Merchant chỉ cần làm bước này **1 lần** — không cần lặp lại trừ khi đổi theme khác (lúc đó cần thêm lại block cho theme mới).

---

## 12. Kiểm tra luồng end-to-end

- [ ] Tạo review qua Admin React → kiểm tra `sync_status` chuyển `synced`, metaobject xuất hiện trên Shopify Admin (Content → Metaobjects → Review).
- [ ] Vào trang sản phẩm tương ứng trên storefront → thấy review hiển thị.
- [ ] Submit review qua form storefront → review hiện ngay (optimistic UI), F5 lại vẫn còn (sau khi job sync chạy xong, vài giây).
- [ ] Xoá/inactive shop trên Admin React → review cũ vẫn giữ nguyên liên kết.
- [ ] Gỡ app trên Shopify Admin → `is_active` trong bảng `shops` chuyển `false`.

---

## 13. Sự cố thường gặp

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| `No metaobject definition exists for type "review"` | Chưa tạo Metaobject definition (Bước 7.1), hoặc `SHOPIFY_REVIEW_METAOBJECT_TYPE` không khớp `type` đã tạo |
| `Value must belong to the specified metaobject definition` | Metafield definition ở Bước 7.2 đang trỏ sai metaobject type |
| `Value requires that you have a metafield definition with the key: reviews` | Chưa tạo Product Metafield definition (Bước 7.2) |
| Metaobject tạo ra ở trạng thái Draft, không hiện storefront | Thiếu `capabilities: { publishable: { status: 'ACTIVE' } }` trong mutation, hoặc review có `status` khác `published` |
| CORS error khi gọi API từ Admin React | `FRONTEND_URL` trong `.env` backend không khớp chính xác origin đang gọi tới |
| `Redirect is not allowed for a preflight request` | Frontend đang gọi `http://` thay vì `https://` tới backend, server tự redirect gây preflight fail |
| Review sync bị lỗi `password authentication failed` | Sai `DB_USER`/`DB_PASSWORD` trong `.env` server |
| App hiện lỗi 401 ngay sau khi cài xong | Đang để `embedded = true` trong khi backend không hỗ trợ App Bridge — đổi thành `false` |
| Field `created_at` trống trên Metaobject dù đã sync | Field chưa được tạo trên Admin (Bước 7.1), hoặc review được tạo trước khi thêm field này — cần resync lại |

---

## Ghi chú vận hành

- Mỗi khi thêm field mới vào Metaobject/Metafield definition, cần **resync lại các review cũ** (Edit → Save, hoặc dùng nút Resync) để field mới được điền.
- Khi sửa `shopify.app.toml` (scope, app proxy, webhook...), luôn cần chạy lại `shopify app deploy`.
- Khi sửa code trong `extensions/`, chỉ cần `shopify app deploy` — không cần đụng gì tới backend/VPS.
- Khi sửa code trong `src/` (NestJS), chỉ cần deploy lại backend — không cần chạy `shopify app deploy`.
