# KayScope v1.3

Server-backed REST API testing tool (Postman-style) built with Next.js 14, PostgreSQL, and Drizzle ORM.

> Tài liệu kiến trúc/blueprint đầy đủ nằm ở [CLAUDE.md](./CLAUDE.md). File này chỉ hướng dẫn **cài đặt và chạy dự án**.

## 1. Yêu cầu hệ thống

- Node.js 20+
- pnpm 10.32.1 (`packageManager` trong `package.json`)
- PostgreSQL 14+ (local, Docker, Neon, hoặc Supabase)
- Redis (dùng cho rate limiting — có thể bỏ qua khi chạy dev, xem mục 5)

## 2. Cài đặt

```bash
pnpm install
```

`@playwright/test` trong `package.json` chỉ là thư viện npm (test runner + API). Nó **không** kèm theo browser binaries (Chromium/Firefox/WebKit). Nếu dự định chạy `pnpm test:e2e` hoặc dùng tính năng Flow execution, cần cài thêm browser thật:

```bash
npx playwright install --with-deps
```

`--with-deps` tự cài luôn các thư viện hệ thống Linux mà browser cần (fonts, libgtk, libnss...) — trên VPS Ubuntu/Debian sạch thường thiếu sẵn các gói này, thiếu thì Chromium sẽ crash khi chạy headless. Có thể giới hạn chỉ cài chromium: `npx playwright install chromium --with-deps`.

## 3. Cấu hình biến môi trường

Copy file mẫu và điền giá trị thật:

```bash
cp .env.local.example .env.local
```

| Biến | Mô tả | Cách tạo |
|---|---|---|
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL | `postgresql://user:password@localhost:5432/kayscope` |
| `AUTH_SECRET` | Secret cho NextAuth v5 (JWT) | `openssl rand -hex 32` |
| `NEXTAUTH_URL` | Base URL của app | `http://localhost:3000` khi chạy local |
| `VAR_ENCRYPTION_KEY` | Khóa AES-256-GCM mã hóa secret variables/cookies | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `REDIS_URL` | Redis cho rate limiting | `redis://localhost:6379` |

Admin được tạo tự động một lần khi server khởi động (`src/instrumentation.ts` → `seedAdminUser()`), chỉ khi tài khoản với email đó chưa tồn tại.

**Lưu ý:** Đăng ký tự do (`/register`) đã bị vô hiệu hóa — tài khoản chỉ được tạo qua CMS admin hoặc qua seed ở trên.

## 4. Khởi tạo database

```bash
pnpm db:generate   # sinh migration từ Drizzle schema (nếu đổi schema)
pnpm db:migrate    # áp dụng migration vào DATABASE_URL
```

Xem/chỉnh dữ liệu trực quan:

```bash
pnpm db:studio
```

## 5. Chạy dev server

```bash
pnpm dev
```

Mở [http://localhost:3000](http://localhost:3000).

Nếu chưa cài Redis, tính năng rate limiting sẽ log lỗi kết nối nhưng không chặn app — vẫn chạy được cho dev cơ bản. Để bật đầy đủ, chạy Redis local (vd. `docker run -p 6379:6379 redis`).

## 6. Build & chạy production

```bash
pnpm build
pnpm start
```

Đảm bảo tất cả biến môi trường ở mục 3 đã được set trong môi trường production (không dùng `.env.local`, dùng cấu hình biến môi trường thật của platform deploy — Vercel/Docker/VM...).

Lưu ý: chức năng chạy Flow (Playwright E2E qua `/api/flows/[id]/run`) bị **disable trong production** (spawn Playwright CLI trên server không phù hợp với môi trường serverless/production thông thường).

## 7. Testing

```bash
pnpm test              # unit/integration tests (Vitest)
pnpm test:watch
pnpm test:coverage

pnpm test:e2e           # Playwright E2E UI tests (tests/e2e/ui)
pnpm test:e2e:ui        # Playwright UI mode
pnpm test:e2e:report    # xem report lần chạy gần nhất
```

E2E tests cần server đang chạy (`playwright.config.ts` tự động dùng server sẵn có khi chạy local) và một database test riêng.

## 8. Lint

```bash
pnpm lint
```

## 9. Tài liệu liên quan

- [CLAUDE.md](./CLAUDE.md) — blueprint kiến trúc, phase roadmap, quy tắc bảo mật biến/secret, quy ước code
- [docs/gap-analysis-vs-postman.md](./docs/gap-analysis-vs-postman.md) — so sánh tính năng với Postman
- [docs/admin-cms-plan.md](./docs/admin-cms-plan.md) — kế hoạch CMS admin
