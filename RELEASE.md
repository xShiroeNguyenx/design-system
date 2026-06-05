# Phát hành dsmcp — checklist publish phiên bản đầu (v0.1.0)

> Quy ước: các lệnh `git` / `npm publish` là thao tác đẩy ra ngoài — **bạn tự chạy**.
> Tài liệu này liệt kê đầy đủ, theo thứ tự, để copy-paste.

---

## 0. Chuẩn bị một lần

- [ ] Có **tài khoản npm** (bật 2FA). Tạo tại https://www.npmjs.com/signup
- [ ] **Kiểm tra tên còn trống**:
  ```bash
  npm view dsmcp version
  ```
  - `npm error 404` → tên trống, dùng được.
  - Nếu đã có người chiếm → đổi sang scoped trong `package.json`: `"name": "@your-scope/dsmcp"` (lúc publish thêm `--access public`).
- [ ] **Điền các placeholder `FILL_ME`** trong [package.json](package.json): `author`, `repository.url`, `bugs.url`, `homepage`.
- [ ] (Tùy chọn) Sửa `Copyright (c) 2026 dsmcp authors` trong [LICENSE](LICENSE) thành tên/đơn vị thật.
- [ ] (Tùy chọn) Tạo `CHANGELOG.md` ghi mục `## 0.1.0`.

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

> Nếu dùng tên scoped `@your-scope/dsmcp`, `--access public` là bắt buộc (mặc định scoped = private).

---

## 5. Hậu kiểm (sau khi publish)

```bash
npm view dsmcp                 # thấy "version: 0.1.0" trên registry
# Cài sạch ở một thư mục trống để thử như người dùng thật:
npx -y dsmcp@0.1.0 doctor      # CLI chạy
npx -y dsmcp-mcp               # MCP server khởi động qua stdio (Ctrl+C để thoát)
```

Đăng ký MCP cho Claude Code/Cursor (`.mcp.json`):

```json
{ "mcpServers": { "dsmcp": { "command": "npx", "args": ["-y", "dsmcp-mcp"] } } }
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

## 7. Phát hành các bản sau (semver)

```bash
# Vì repo có thể chưa có git, dùng --no-git-tag-version để chỉ bump số:
npm version patch --no-git-tag-version   # 0.1.0 -> 0.1.1 (sửa lỗi)
npm version minor --no-git-tag-version   # 0.1.x -> 0.2.0 (thêm tính năng, tương thích)
npm version major --no-git-tag-version   # -> 1.0.0 (breaking, hoặc khi API engine đã ổn định)
npm test && npm publish --access public
```

- Giai đoạn `0.x`: `minor` = tính năng mới, `patch` = sửa lỗi.
- Lên `1.0.0` khi cam kết API engine không phá vỡ ngược.

---

## Checklist nhanh

- [ ] Điền `FILL_ME` trong `package.json`
- [ ] (tùy) tên holder trong `LICENSE`
- [ ] `npm view dsmcp version` — tên trống (hoặc đổi scoped)
- [ ] `npm test` xanh + `node dist/cli.js doctor` OK
- [ ] `npm pack --dry-run` đúng nội dung
- [ ] `npm login` + `npm whoami`
- [ ] `npm publish --access public`
- [ ] `npx -y dsmcp@0.1.0 doctor` chạy được
