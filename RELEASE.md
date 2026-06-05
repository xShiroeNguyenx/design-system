# Phát hành dsmcp — checklist publish phiên bản đầu (v0.1.0)

> Quy ước: các lệnh `git` / `npm publish` là thao tác đẩy ra ngoài — **bạn tự chạy**.
> Tài liệu này liệt kê đầy đủ, theo thứ tự, để copy-paste.

---

## 0. Chuẩn bị một lần

- [ ] Có **tài khoản npm** (bật 2FA). Tạo tại https://www.npmjs.com/signup
- [ ] **Tên package = `@shiroe_nguyen/dsmcp`** (scoped). Lý do: tên unscoped `dsmcp`
  bị npm chặn (reserved / quá giống package có sẵn → 404 khi publish). Tên scoped
  dưới namespace của bạn luôn dùng được. Scoped public **bắt buộc** `--access public`
  (đã có sẵn trong workflow + các lệnh dưới).
- [x] `author` / `repository` / `bugs` / `homepage` trong [package.json](package.json) đã điền.
- [ ] (Tùy chọn) Sửa `Copyright (c) 2026 dsmcp authors` trong [LICENSE](LICENSE) thành tên/đơn vị thật.
- [ ] (Tùy chọn) Tạo `CHANGELOG.md` ghi mục `## 0.1.0`.
- [ ] **Để publish tự động qua CI** (xem §7): tạo secret `NPM_TOKEN` (npm Automation token) trong GitHub repo Settings → Secrets → Actions.

---

## 1. Pre-flight — đảm bảo build/test xanh (chạy local)

```bash
node -v                  # phải >= 18.18 (xem "engines")
rm -rf dist node_modules
npm install              # hoặc: npm ci  (nếu có package-lock — dự án có sẵn)
npm run build            # tsc -> dist/
npm test                 # 4 harness: smoke (11 tool) + scaffold/typeface + validator + importer → PHẢI PASS
node dist/cli.js doctor  # self-check theme mặc định: 18 mode đều resolve + contrast
```

Tất cả phải xanh trước khi đi tiếp. (Khi `npm publish`, script `prepublishOnly` sẽ tự chạy lại `npm test` — nên build/test là cổng bắt buộc.)

---

## 2. Kiểm tra đúng nội dung sẽ được đóng gói

```bash
npm pack --dry-run
```

Xác nhận tarball **CÓ**: `dist/**` (engine + mcp + cli, kèm `.d.ts`), `themes/default/*.json` (gồm `typefaces.json`), `README.md`, `LICENSE`.
Xác nhận **KHÔNG có**: `src/`, `test/`, `examples/`, `node_modules/`, `PLAN.md`, `RELEASE.md` (chúng nằm ngoài `files` whitelist — đúng).

---

## 3. Đăng nhập npm

```bash
npm login
npm whoami        # xác nhận đúng tài khoản
```

---

## 4. Publish

```bash
npm publish --access public --dry-run   # DIỄN TẬP: in ra mọi thứ, KHÔNG đẩy thật
npm publish --access public             # ĐẨY THẬT (prepublishOnly tự chạy npm test trước)
```

> Package là scoped (`@shiroe_nguyen/dsmcp`) → `--access public` **bắt buộc** (mặc định scoped = private). Đã có sẵn ở mọi lệnh + trong workflow.

---

## 5. Hậu kiểm (sau khi publish)

> ⚠️ Trong **PowerShell** phải **nháy tên scoped** (`"@..."`) — nếu không PowerShell
> hiểu `@` là splatting và nuốt mất tên package (gây lỗi `'dsmcp' is not recognized`).

```powershell
npm view "@shiroe_nguyen/dsmcp"                        # thấy "version: 0.1.0" trên registry
# Thử như người dùng thật (nhớ nháy tên scoped):
npx -y -p "@shiroe_nguyen/dsmcp" dsmcp doctor         # CLI: in self-check 18 mode
npx -y -p "@shiroe_nguyen/dsmcp" dsmcp-mcp            # MCP server stdio (Ctrl+C để thoát)
```

Đăng ký MCP cho Claude Code/Cursor (`.mcp.json` — args truyền nguyên văn, KHÔNG cần nháy):

```json
// macOS / Linux
{ "mcpServers": { "dsmcp": { "command": "npx", "args": ["-y", "-p", "@shiroe_nguyen/dsmcp", "dsmcp-mcp"] } } }

// Windows (bọc cmd /c)
{ "mcpServers": { "dsmcp": { "command": "cmd", "args": ["/c", "npx", "-y", "-p", "@shiroe_nguyen/dsmcp", "dsmcp-mcp"] } } }
```

---

## 6. (Tùy chọn) Lưu mốc bằng git

Thư mục này **hiện chưa phải git repo**. Nếu muốn lưu lịch sử + tag:

```bash
git init
git add -A
git commit -m "release: dsmcp v0.1.0"
git tag v0.1.0
git remote add origin <YOUR_REPO_URL>
git push -u origin main --tags
```

---

## 7. Phát hành tự động qua GitHub Actions (khuyến nghị cho bản sau)

Workflow [`.github/workflows/publish.yml`](.github/workflows/publish.yml) tự
`npm publish` mỗi khi bạn **push một tag `v*`**. Nó kiểm tra tag khớp version
trong `package.json`, chạy `npm ci` + `npm test`, rồi publish (kèm provenance).

**Thiết lập một lần — tạo secret `NPM_TOKEN`:**
1. npmjs.com → avatar → **Access Tokens** → **Generate New Token** → loại
   **Automation** (bỏ qua 2FA trong CI). Copy token.
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository
   secret** → tên `NPM_TOKEN`, dán token.

**Mỗi lần phát hành sau đó — chỉ 3 lệnh:**
```bash
npm version patch    # 0.1.0 -> 0.1.1 ; bump package.json + tạo commit + tag v0.1.1
                     # (minor = tính năng mới, major = breaking / lên 1.0.0)
git push             # đẩy commit
git push --tags      # đẩy tag -> kích hoạt workflow -> tự lên npm
```
> `npm version` cần repo git sạch (commit hết trước). Nó tự bump lock, tạo commit
> `0.1.1` và tag `v0.1.1`. Push tag là xong — vào tab **Actions** xem tiến trình.

- Giai đoạn `0.x`: `minor` = tính năng mới, `patch` = sửa lỗi.
- Lên `1.0.0` khi cam kết API engine không phá vỡ ngược.
- Nếu provenance lỗi (token/registry không hỗ trợ): bỏ `--provenance` trong workflow.

---

## 8. Đưa trang demo lên GitHub Pages (tách biệt với publish npm)

Workflow [`.github/workflows/demo.yml`](.github/workflows/demo.yml) build trang
demo và deploy lên GitHub Pages **mỗi lần push vào `main`** (độc lập với việc
publish npm — publish chỉ đẩy package, không đụng demo).

**Bật một lần:**
1. GitHub repo → **Settings → Pages → Build and deployment → Source** → chọn
   **GitHub Actions**.
2. Commit + push workflow (cùng các file khác):
   ```bash
   git add .github/workflows/demo.yml
   git commit -m "ci: deploy demo to GitHub Pages on push to main"
   git push
   ```
3. Vào tab **Actions** xem job "Deploy demo to GitHub Pages" chạy.

**URL demo** (project site): `https://xshiroenguyenx.github.io/design-system/`
(host viết thường, path = tên repo). Mỗi lần push `main` → demo tự cập nhật.

> Demo dùng Google Fonts (CDN ngoài) nên Pages render đầy đủ "vibe" font; offline
> mới fallback về system stack.

## Checklist nhanh

- [x] Tên scoped `@shiroe_nguyen/dsmcp` + metadata đã điền
- [ ] (tùy) tên holder trong `LICENSE`
- [ ] `npm test` xanh + `node dist/cli.js doctor` OK
- [ ] `npm pack --dry-run` đúng nội dung (tên `@shiroe_nguyen/dsmcp`)
- [ ] `npm login` + `npm whoami`
- [ ] `npm publish --access public`
- [ ] `npx -y @shiroe_nguyen/dsmcp doctor` chạy được
