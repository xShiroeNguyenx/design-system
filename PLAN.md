# Theme Governance MCP — Kế hoạch chi tiết (PLAN.md)

---

## 0. Trạng thái triển khai (cập nhật 2026-06-05)

> §1–§13 bên dưới là **thiết kế gốc**. Khối này tóm tắt **đã làm được gì** so với kế hoạch.

**✅ HOÀN THÀNH — toàn bộ Phase 0–5, 4 stack, 11 MCP tool. Mọi test xanh; 4 golden example pass validator 100/100.**

- **Engine + 3 mặt tiền** (§2): core TypeScript thuần (không import MCP SDK) + MCP stdio + CLI + mẫu hook/CI.
- **Token model 3 lớp, N-mode** qua `extends` (§4); resolver bắt thiếu-mode / tham chiếu vòng / dangling-ref.
- **11 tool** (§6): `get_contract`, `list_tokens`, `resolve_token`, `get_component_spec`, `scaffold_theme`, `generate_demo`, `validate_code`, `validate_project`, `suggest_fix`, `import_theme`, `register_theme`.
- **Validator** (§5): `no-raw-color`, `single-mode-strategy`, `mode-completeness`, `contrast-aa`, + ⭐ flagship `interactive-completeness`; điểm tuân thủ; CLI exit 0/1; adoption artifacts (CLAUDE.md/.cursorrules/pre-commit/CI/Stop-hook).
- **4 stack** (§11): `css-vars` (chứng minh đầu) → `vanilla` → `tailwind` → `flutter`; rule stack-aware qua `appliesTo`.
- **Bộ 18 mode đã SHIP & BẬT mặc định** (§11.1 + §11.2): 10 chức năng + 8 thẩm mỹ, **mỗi mode đạt WCAG AA contrast + completeness**. Theme hoá đầy đủ per-mode: nền / chữ / viền / nút **secondary** / nút **danger** / **primary** (không còn xám-đỏ generic).
- **⭐ MỚI, ngoài kế hoạch gốc — Trục Typeface độc lập** (font-pack): xem **§4.1**.
- **Importers** (§9): CSS (`:root`/`[data-theme]`→DTCG) + Tailwind config→DTCG; **báo gap** thay vì throw.
- **Demo** (§8.1): thiết kế lại chuyên nghiệp; render mọi token + component qua **mọi mode × mọi typeface**; golden-fixture sạch (0 màu hardcode).

**Hoãn lại có chủ đích**: importer **Figma** (§13); luật **interactive-states cho Flutter** (§5 chỉ chốt luật color-literal cho Flutter); **font-pack cho Flutter** (cần `ThemeData.fontFamily` riêng); **HTTP transport**; **đóng gói/publish**. Cân nhắc thêm: theme hoá nốt hover/active của secondary/danger per-mode (hiện kế thừa base).

---

## 1. Bối cảnh & Vấn đề (Context)

Khi nhờ AI code một dự án mới, AI thường **không bám một mode (dark/light) nhất quán**:
- Không theo một chế độ cụ thể, hoặc trộn lẫn nhiều chiến lược mode.
- Có theo thì vẫn **lệch ở vài chỗ** — điển hình là **một số button không đổi theo mode** (thiếu biến thể dark, hardcode màu, quên trạng thái hover/active/disabled).
- Không có **nguồn chân lý chung** để AI tra cứu trước khi code, và không có cơ chế **kiểm tra/ép** sau khi code.

**Mục tiêu:** xây một **Theme Governance MCP** — *không phải "server chứa màu"* mà là **bộ quản trị (contract + enforcement)** ép AI dùng **token / component / rule cố định** thay vì tự đoán style. Kết quả: dự án mới sinh ra đúng mode, đồng bộ, không lệch.

**Phạm vi đã chốt:** full design system (màu + typography + spacing + radius + shadow + motion), hỗ trợ 4 stack (React+Tailwind, CSS Variables/CSS-in-JS, HTML/CSS thuần, Flutter), theme kết hợp (mặc định + override config + import), làm 3 năng lực (nguồn chân lý → scaffold → validator) theo phase.

**Hai yêu cầu mở rộng:**
- **N mode (không chỉ 2):** hệ thống mode-agnostic, hỗ trợ số mode tùy ý — `light`, `dark`, `high-contrast`, `sepia`, hoặc brand modes (`brand-a`, `brand-b`)… Số 2 (light/dark) chỉ là mặc định, không phải giới hạn.
- **Demo / Showcase:** sinh tự động một **trang demo** render toàn bộ token (swatch) + mọi component đã quản trị qua **TẤT CẢ các mode**, có bộ chuyển mode. Vừa để con người kiểm bằng mắt, vừa làm living-doc, vừa làm **golden fixture** cho test.

---

## 2. Nguyên tắc cốt lõi: Governance = Engine + Enforcement

> **"AI gọi được tool" ≠ "AI tuân thủ".** MCP tool chỉ *sẵn có* cho model; model tự quyết có gọi và có làm theo hay không. Không thể "ép AI" chỉ bằng MCP tool.

Vì vậy kiến trúc đặt **lõi nghiệp vụ (engine) độc lập với transport**, và bọc nó bằng nhiều mặt tiền:

```
            ┌─────────────────────────────────────────────┐
            │   CORE ENGINE (library, transport-agnostic)  │
            │  tokens • rules • adapters • contract • fix   │
            └─────────────────────────────────────────────┘
               ▲                ▲                  ▲
        ┌──────┴─────┐   ┌──────┴──────┐   ┌───────┴────────┐
        │ MCP server │   │     CLI     │   │  Hooks / CI    │
        │ (stdio)    │   │ (terminal)  │   │ pre-commit,    │
        │ AI gọi lúc │   │ con người / │   │ Stop-hook,     │
        │ generate   │   │ script gọi  │   │ GitHub Action  │
        └────────────┘   └─────────────┘   └────────────────┘
          GỢI Ý               KIỂM           ÉP (deterministic)
```

- **MCP server** = mặt tiền *gợi ý*: AI gọi `get_contract` lúc sinh code, `validate_code` để tự sửa.
- **CLI + Hooks/CI** = mặt tiền *ép buộc*: validator chạy **bất kể AI có gọi hay không** (pre-commit chặn commit lệch, CI fail PR, Claude Code Stop-hook chặn kết thúc lượt khi còn vi phạm). **Đây mới là chỗ "governance" thật sự sống.**

Hệ quả thiết kế: engine phải thuần TypeScript, không phụ thuộc MCP SDK; MCP server, CLI, hook đều chỉ là lớp mỏng gọi vào engine.

---

## 3. Tech stack & nền tảng

- **Ngôn ngữ:** TypeScript (Node 20+) — khớp môi trường hiện có (anime-companion-vscode).
- **MCP:** `@modelcontextprotocol/sdk`, transport **stdio** (chạy với Claude Code / Cursor / Claude Desktop). HTTP là tùy chọn sau.
- **Token format:** **DTCG** (Design Tokens Community Group) JSON — tương thích Style Dictionary, Figma Tokens, dễ import/export.
- **Phân tích code (validator):** `postcss` (AST cho CSS/CSS-vars), quét class cho Tailwind, TS compiler API / regex có cấu trúc cho JS/TS inline; Dart analyzer cho Flutter (giai đoạn sau).
- **Test:** `vitest` + bộ fixture "good vs. drifted" cho từng stack.
- **CLI:** `cli.ts` (commander/yargs) — `validate`, `scaffold`, `import`, `report`.

---

## 4. Mô hình token (3 lớp, mode-aware, full design system)

Đây là "hiến pháp" mà mọi thứ tham chiếu. 3 lớp theo chuẩn ngành:

1. **Primitive (palette/scale thô)** — `blue.500 = #3B82F6`, `space.4 = 16px`, `radius.md = 8px`, `font.size.lg`, `shadow.2`, `duration.fast`, `easing.standard`. *Không* dùng trực tiếp trong component.
2. **Semantic (theo vai trò, mode-agnostic: `{ [mode]: value }`)** — tầng then chốt chống lệch mode:
   - Màu: `color.bg.{default,subtle,raised}`, `color.text.{primary,secondary,muted,inverse}`, `color.border.{default,subtle}`, `color.action.{primary,secondary,danger}.{bg,fg,border,hover,active,disabled,focus}`.
   - Typography: `text.{display,heading,body,caption}` (size/line-height/weight).
   - Spacing/radius/elevation/motion theo vai trò: `space.inset.md`, `radius.control`, `elevation.popover`, `motion.enter`.
   - **Bất biến:** mỗi semantic token PHẢI có giá trị cho **MỌI mode đã khai báo** (`modes: [...]` trong config), không chỉ light/dark.
3. **Component token** — `button.primary.bg`, `input.border`, `card.bg`… mỗi cái trỏ về semantic token, kèm **ma trận trạng thái** (default/hover/active/focus-visible/disabled) × (mọi mode).

**Mô hình N mode:** giá trị token = map `{ [modeName]: ... }`. `modes` khai báo trong config (mặc định `["light","dark"]`, mở rộng tùy ý: `high-contrast`, `sepia`, `brand-a`…). Một mode có thể **kế thừa** (`extends`) mode khác và chỉ override phần khác biệt → tránh lặp khi thêm mode mới.

Resolver: nhận `(tokenName, mode)` → giá trị cuối; phát hiện token **thiếu bất kỳ mode nào**, tham chiếu vòng, hoặc trỏ tới primitive không tồn tại.

> Lưu ý cài đặt: `isModeMap` chỉ coi một `$value` object là *mode-map* khi **mọi key đều là mode đã khai báo** → token không có key cho 1 mode sẽ fallback theo chuỗi `extends`; và mọi key mode thêm vào phải khớp tên trong manifest.

### 4.1 Trục Typeface độc lập (font-pack / type-theme) — bổ sung ngoài kế hoạch gốc

Bài học khi mở rộng: **kiểu chữ là một trục riêng, KHÔNG nên gộp vào trục màu (mode).** Vì vậy bên cạnh trục màu (`[data-theme="<mode>"]`), theme có thêm **trục typeface** độc lập (`[data-type="<pack>"]`) — hai trục phối hợp tự do (mode × pack).

- **Định nghĩa:** `themes/default/typefaces.json` khai báo N **font-pack**; mỗi pack chỉ đổi `--font-family-sans` / `--font-family-mono` (KHÔNG đổi size/line-height → layout không nhảy). Ship sẵn **6 pack**: `system, serif (Lora), mono (JetBrains Mono), rounded (Nunito), humanist (Inter), slab (Roboto Slab)`. `ThemeDefinition` thêm `typeThemes` + `defaultTypeTheme`.
- **Cơ chế (độc lập với mode):** font không phụ thuộc màu nên **không** đi qua mode-resolver. Emitter sinh block `[data-type="<pack>"]` và **append SAU** các block mode trong `tokens.css`; cùng độ ưu tiên `(0,1,0)` nên khi một phần tử mang cả `data-theme` + `data-type`, font thắng nhờ **source-order**. Body + component vốn dùng `var(--font-family-sans)` nên **tự theo**, không sửa component CSS.
- **Switcher thứ 2:** dropdown riêng, ghi `data-type` lên `<html>` + lưu localStorage (`dsmcp-type`), tách hẳn switcher mode.
- **Web font:** cho phép Google Fonts (`display=swap`) + fallback system stack (offline vẫn chạy, chỉ mất "vibe"). Governance vẫn sạch: stack/URL không chứa màu → không vi phạm `no-raw-color`; `single-mode-strategy` chỉ bắt `.dark` lẫn `[data-theme]` nên `[data-type]` an toàn.
- **A11y:** tách trục giúp người dùng high-contrast **giữ font dễ đọc** thay vì bị ép theo vibe — đừng tái gộp "font auto theo mode".
- **Phạm vi:** web (`css-vars`/`vanilla`/`tailwind` — preset map `fontFamily.sans/mono → var()`). **Flutter hoãn** (cần `ThemeData.fontFamily` per-pack).

---

## 5. Bộ luật Governance (Rule Engine)

Luật khai báo dạng dữ liệu: `{ id, severity, message, appliesTo: stack[], detect(), fix() }`. Nhóm luật:

| Nhóm | Luật | Độ khó phát hiện |
|---|---|---|
| **Raw value** | Cấm hex/rgb/hsl thô, class Tailwind palette thô (`bg-blue-500`), `Color(0xFF…)`, px literal cho spacing/radius khi đã có token | **Dễ** (regex/AST) |
| **Mode completeness** | Mọi semantic token & component state resolve được ở **mọi mode đã khai báo** (không chỉ light/dark) | Trung bình |
| **⭐ Interactive completeness (FLAGSHIP)** | Mọi phần tử tương tác (button, link, input, toggle…) phải định nghĩa **hover/active/focus-visible/disabled ở MỌI mode** | **KHÓ NHẤT** |
| **Single mode strategy** | Một chiến lược mode nhất quán; N mode dùng `[data-theme="<mode>"]` (class `.dark` chỉ đủ cho 2 mode), không trộn nhiều cơ chế | Trung bình |
| **Contrast / a11y** | Cặp text-trên-bg đạt WCAG AA ở **mọi mode** | Dễ (toán contrast) |

> **⭐ Luật flagship** chính là cái giải quyết trực tiếp nỗi đau "vài button không theo mode" — **và cũng là rủi ro kỹ thuật lớn nhất**: phải hiểu cấu trúc component để biết phần tử nào "tương tác", dễ báo nhầm (false positive). Đây là *tính năng đầu bảng*, không phải một luật tầm thường — sẽ làm sau khi các luật "dễ" đã vững, và bắt đầu trên đúng **1 stack** (CSS variables) để kiểm soát false positive.

Output validator: `{ ruleId, severity, file, line, snippet, suggestedFix }` + điểm tuân thủ (compliance score) cho cả dự án.

---

## 6. Bề mặt MCP (ưu tiên TOOLS, resources tối thiểu)

> Nhiều MCP client (gồm Claude Code) **không tự nạp** `theme://` resource — AI phải chủ động đọc và mức hỗ trợ khác nhau. Vì vậy **giao contract qua TOOL `get_contract`**, giữ resource ở mức tối thiểu.

**Tools (chính):**
1. `get_contract({ stack })` — **cửa vào chính**. Trả về token + rule + guide theo stack + **một khối chỉ dẫn dán-được** ("Bạn PHẢI dùng các token sau…, KHÔNG hardcode màu…, chạy validate trước khi kết thúc"). AI gọi đầu tiên.
2. `get_component_spec({ name, stack })` — trả về **bản thiết kế component đã được quản trị** (code mẫu + token binding + ma trận trạng thái) để AI *copy bản chuẩn* thay vì tự nghĩ.
3. `list_tokens({ category })` / `resolve_token({ name, mode })` — tra cứu (`mode` là bất kỳ mode đã khai báo).
4. `scaffold_theme({ stack, scope, modes, outDir })` — sinh nền tảng + **bộ chuyển N mode** + **bộ chuyển typeface** (trục độc lập §4.1, web stacks) (xem §8).
5. `validate_code({ stack, code | files })` — quét theo rule engine → findings có cấu trúc.
6. `validate_project({ dir })` — báo cáo tuân thủ toàn repo + điểm số.
7. `suggest_fix({ finding })` — trả snippet đã sửa.
8. `generate_demo({ stack, outDir })` — sinh **trang demo/showcase** render mọi token + component qua **tất cả mode × tất cả typeface**, kèm 2 bộ chuyển (mode + type) (xem §8.1, §4.1).
9. `register_theme({ definition })` / `import_theme({ source })` — định nghĩa/ import theme (xem §9).

> ✅ Cả **11 tool** đã live (Phase 0–5). Trục typeface không thêm tool riêng — nó đi kèm output của `scaffold_theme`/`generate_demo` (block `[data-type]` trong `tokens.css` + switcher thứ 2 trong `theme.js`).

**Resources (tối thiểu):** `theme://contract`, `theme://tokens` (cho client nào có hỗ trợ; không đầu tư nhiều).

**Prompts:** `themed-build` (workflow dựng app có theme), `audit-theme` (vòng audit + fix).

---

## 7. CLI & đường Enforcement (nơi governance thật sự sống)

`cli.ts` gọi cùng engine:
- `dsmcp validate [path]` — exit code ≠ 0 nếu có vi phạm `error`.
- `dsmcp report [dir]` — báo cáo + điểm tuân thủ (CI artifact).
- `dsmcp scaffold --stack <s>` / `dsmcp import --from <tailwind|css|figma>`.

Tích hợp ép buộc (do `scaffold_theme` sinh sẵn — xem §8):
- **pre-commit hook** (husky/lefthook): chặn commit khi lệch.
- **GitHub Action**: `dsmcp validate` fail PR.
- **Claude Code Stop-hook**: chạy validator cuối lượt; còn vi phạm thì chặn kết thúc và trả findings cho AI tự sửa → đây là cách "ép AI" khả thi nhất trong vòng đời session.

---

## 8. Scaffold + Adoption Artifacts (cách khiến AI thực sự dùng contract)

`scaffold_theme` **không chỉ sinh file theme**, mà sinh cả *hạ tầng áp dụng*:
- File token (DTCG) + theme provider/CSS vars cho **N mode** + **bộ chuyển mode** (dropdown/segmented khi >2; toggle khi đúng 2) + **dò `prefers-color-scheme`** cho mode mặc định + **lưu lựa chọn** (localStorage) + 1 chiến lược mode nhất quán (`[data-theme="<mode>"]`).
- Theo stack: Tailwind preset (đa mode qua `data-theme` variants) / theme object (CSS-in-JS) / `:root` + `[data-theme]` (vanilla) / `ThemeData` map theo mode (Flutter).
- **Artifacts áp dụng (then chốt):**
  - `CLAUDE.md` / `.cursorrules` snippet: *"Mỗi session: gọi `get_contract` trước; chỉ dùng token đã duyệt; chạy validator trước khi kết thúc."*
  - File cấu hình pre-commit + GitHub Action + Claude Code hook đã trỏ sẵn vào `dsmcp validate`.
  - `theme-governance.config.{json,ts}` (xem §9).

> Không có lớp artifact này thì việc AI dùng contract chỉ là *may rủi*. Đây là cầu nối biến "có tool" thành "được dùng".

### 8.1 Demo / Showcase (`generate_demo`)

Sinh một **trang demo** (route `/demo` hoặc file tĩnh) làm 3 việc cùng lúc:
- **Kiểm bằng mắt:** render full bảng token (swatch màu, scale spacing/radius/shadow, mẫu typography) + mọi component đã quản trị, **lặp qua tất cả mode** (có bộ chuyển mode để soi từng mode hoặc xem cạnh nhau).
- **Living documentation:** luôn phản ánh theme/token hiện tại — đổi token là demo đổi theo.
- **Golden fixture cho test:** demo đúng phải pass validator 100% & đạt contrast ở mọi mode; dùng cho snapshot/visual test. Đặt tại `examples/<stack>/demo/`.

---

## 9. Nguồn theme: mặc định + override + import

- **Mặc định:** server ship sẵn 1 theme full-design-system đẹp, hợp lệ (đạt contrast), **định nghĩa sẵn 10 mode** (xem §11.1) tại `themes/default/`.
- **Override:** mỗi dự án có `theme-governance.config.{json,ts}` khai báo: stack, **danh sách `modes` *đang bật*** (chọn tập con trong 10 mode có sẵn — mặc định bật `["light","dark"]`, hoặc bật thêm/tự thêm mode mới qua `extends`), mode mặc định, chiến lược mode, scope đang bật, ghi đè token, ghi đè/severity của rule.
- **Import:** `import_theme` hút token từ `tailwind.config`, file CSS hiện có, hoặc Figma Tokens → chuẩn hóa về DTCG → **validate completeness** (đủ 2 mode, contrast) và báo lỗ hổng.

---

## 10. Cấu trúc repo

```
design-system-mcp/
  src/
    engine/            # LÕI, không phụ thuộc MCP
      tokens/          # schema DTCG, resolver, default theme loader
      rules/           # định nghĩa rule + rule engine + contrast
      adapters/        # mỗi stack: { scaffold, validate, emit }
        css-vars/      #   ← stack chứng minh đầu tiên
        tailwind/
        vanilla/
        flutter/       #   ← engine khác hẳn (Dart), làm cuối
      components/      # bản thiết kế component đã quản trị
      contract/        # builder contract + khối chỉ dẫn cho AI
      importers/       # tailwind, css, figma → DTCG
    mcp/server.ts      # mặt tiền MCP (tools/resources/prompts) → gọi engine
    cli.ts             # mặt tiền CLI → gọi engine
    hooks/             # mẫu pre-commit / Stop-hook / GitHub Action
  themes/default/      # token DTCG mặc định
  examples/            # app vàng (golden) mỗi stack để test end-to-end
  test/                # fixtures good-vs-drifted theo stack
  package.json  tsconfig.json  README.md  PLAN.md
```

---

## 11. Lộ trình theo phase

> Nguyên tắc: **không để "4 stack" nhân đôi/tư độ rộng mỗi phase.** Người dùng chọn cả 4 là *phạm vi cuối*, không phải thứ tự v1. **Chứng minh trọn vòng (contract → scaffold → validate → fix) trên ĐÚNG 1 stack trước** = **CSS variables** (`[data-theme]`/`.dark`): gần nhất với webview anime-companion, dễ validate nhất (postcss AST: kiểm mọi semantic var resolve được dưới cả 2 selector mode). Các stack khác nhân bản theo pattern adapter. **Flutter làm cuối** vì là *engine phân tích hoàn toàn khác* (Dart static analysis, không có CSS).

- **Phase 0 — Nền tảng:** setup repo, skeleton engine + MCP stdio + `cli.ts`; schema DTCG; theme mặc định full-design-system; `get_contract`. → *AI gọi được contract.*
- **Phase 1 — Nguồn chân lý (stack CSS-vars):** tokens/rules/component-spec; guide + khối chỉ dẫn AI; `get_component_spec`, `list_tokens`, `resolve_token`.
- **Phase 2 — Scaffold + Demo (CSS-vars):** `scaffold_theme` **N mode** + bộ chuyển mode + system detect + **adoption artifacts** (CLAUDE.md/.cursorrules + hook + CI); `generate_demo` trang showcase qua mọi mode (làm chuẩn cho validate ở Phase 3). Test trước với đúng 2 mode (light/dark), rồi thêm mode thứ 3 (vd `high-contrast`) để chứng minh tính N-mode.
- **Phase 3 — Validator (CSS-vars):** rule engine luật "dễ" + mode-completeness + contrast + `suggest_fix` + report/score; **xong trọn vòng 1 stack**. Sau đó thêm **⭐ luật interactive-completeness** trên chính stack này.
- **Phase 4 — Mở rộng stack:** nhân adapter sang Tailwind → vanilla; rồi quản trị theme (`register_theme`/`import_theme`, importer Tailwind/CSS/Figma).
- **Phase 5 — Flutter:** adapter Dart riêng (analyzer), scaffold `ThemeData`/`ColorScheme`, validate `Color(0xFF…)`.

### 11.1 Bộ 10 mode mặc định ship kèm (Phase 2)

> ✅ **ĐÃ TRIỂN KHAI (2026-06-05)** — cả 10 mode chức năng đã ship & **bật mặc định**; mỗi mode đạt contrast WCAG AA + completeness. (Bản gốc dự kiến bật dần; thực tế đã bật đủ.)

Theme mặc định định nghĩa sẵn **10 mode thông dụng**. Mỗi mode dùng `extends` để kế thừa một mode gốc (`light` hoặc `dark`) và chỉ override token khác biệt → thêm/sửa mode rất rẻ, và validator dễ kiểm completeness.

| # | Mode | Mô tả | Kế thừa | Dùng ở đâu (tham chiếu thực tế) |
|---|---|---|---|---|
| 1 | `light` | Sáng cơ bản, nền trắng/xám rất nhạt | (gốc) | mặc định hầu hết app |
| 2 | `dark` | Tối cơ bản, nền xám đậm (không đen tuyền) | (gốc) | mặc định dark hầu hết app |
| 3 | `dim` | Tối **dịu** — nền xám xanh, tương phản nhẹ | extends `dark` | GitHub "Dark dimmed", X/Twitter "Dim" |
| 4 | `midnight` | **Đen tuyền `#000`** cho OLED/AMOLED, tiết kiệm pin | extends `dark` | YouTube/mobile "Black", AMOLED themes |
| 5 | `high-contrast-light` | Tương phản cao nền sáng — **a11y, WCAG AAA** | extends `light` | Windows/VSCode High Contrast |
| 6 | `high-contrast-dark` | Tương phản cao nền tối — **a11y** | extends `dark` | Windows/VSCode High Contrast Dark |
| 7 | `sepia` | Nền kem/vàng ấm, **dịu mắt đọc lâu** | extends `light` | Kindle, reader/Pocket mode |
| 8 | `solarized-light` | Bảng Solarized sáng — rất phổ biến giới dev | extends `light` | editor/terminal themes |
| 9 | `solarized-dark` | Bảng Solarized tối | extends `dark` | editor/terminal themes |
| 10 | `nord` | Palette **Nord** (xanh lạnh) — phổ biến dev/UI | extends `dark` | editor/terminal/UI themes |

> Đây là bộ **minh họa + có thật**, không phải giới hạn. Nhờ `extends`, thêm `dracula`, `gruvbox`, `monokai`, hay brand mode (`brand-a`…) chỉ là override vài token. Dev sequence vẫn giữ: kiểm vòng đầu với `light`+`dark`, rồi bật dần tới đủ 10 để chứng minh tính N-mode; mỗi mode mới ship đều phải qua validator (đủ token mọi vai trò + đạt contrast).

### 11.2 Gói mode thẩm mỹ / biểu cảm (tùy chọn — `aesthetic pack`)

> ✅ **ĐÃ TRIỂN KHAI** — cả 8 mode thẩm mỹ đã ship & **bật mặc định** cùng nhóm chức năng (theo yêu cầu) → tổng **18 mode**. (Bản gốc để "tắt mặc định"; tắt/bật vẫn chọn được qua `modes` trong config dự án.) Token *trang trí* (`role: decorative`) chưa cần dùng vì các pack hiện tại đều đạt contrast AA cho text↔bg như mọi mode khác.

Khác nhóm chức năng (lo *đọc được/a11y*), nhóm này lo *vibe/thương hiệu*. **Tắt mặc định**, dự án bật qua `modes` khi muốn. **Vẫn chịu đúng bộ luật governance** — bắt buộc đạt **contrast WCAG AA** cho cặp text↔bg và **completeness** mọi token; token *trang trí* (gradient, glow) được đánh dấu `role: decorative` để miễn check contrast văn bản nhưng không miễn completeness.

| Mode | Vibe | Bảng màu chủ đạo | Kế thừa |
|---|---|---|---|
| `love` | Lãng mạn / Valentine | hồng phấn + đỏ rose, accent tim | extends `light` |
| `future` | Cyberpunk / sci-fi | neon cyan + magenta trên nền gần đen, glow | extends `dark` |
| `synthwave` | Retro 80s / vaporwave | tím–hồng–cam hoàng hôn | extends `dark` |
| `sakura` | Anime / kawaii pastel | hồng anh đào dịu, pastel | extends `light` |
| `forest` | Thiên nhiên | xanh lá + nâu đất | extends `light` |
| `ocean` | Biển | xanh dương + teal | extends `dark` |
| `coffee` | Ấm / cozy (kiểu Catppuccin Mocha) | nâu mocha + kem | extends `dark` |
| `aurora` | Bắc cực quang | gradient xanh–tím | extends `dark` |

> Bài học thiết kế: governance làm cho mode "cho vui" vẫn **an toàn & nhất quán** — đây chính là điểm bán hàng (một button trong `love` mode vẫn phải đủ hover/active/focus/disabled và đủ tương phản như mọi mode khác).

---

## 12. Kiểm thử (Verification)

- **Unit:** resolver token (phát hiện thiếu mode, tham chiếu vòng); rule engine với fixture *good vs. drifted* mỗi stack; toán contrast; importer.
- **Integration MCP:** đăng ký server vào Claude Code/Cursor (`.mcp.json`), gọi `get_contract`, `scaffold_theme` dựng app mẫu, **cố tình chèn lệch** (button thiếu dark, hardcode hex), chạy `validate_project` → khẳng định bắt đúng + `suggest_fix` đúng.
- **CLI/Hook:** chạy `dsmcp validate` trên `examples/` lệch → exit code ≠ 0; pre-commit chặn được commit lệch.
- **Golden apps** `examples/<stack>/`: bản đúng phải pass 100%, bản lệch phải fail đúng số findings kỳ vọng.
- **N mode:** validator bắt token thiếu bất kỳ mode nào; demo render đủ **18 mode** và đạt contrast ở từng mode. (Vòng kiểm nhanh: `loadDefaultTheme()` + `runThemeRules()` → 0 finding cho cả 18 mode.)
- **Typeface (§4.1):** `verify-scaffold` khẳng định block `[data-type]` đứng **sau** mọi block `[data-theme]` trong `tokens.css` (font thắng source-order), switcher thứ 2 được mount, starter có `<link>` Google Fonts. *Lưu ý: font không có cặp contrast → kiểm "đổi đúng" là bằng mắt, không phải test tự động.*
- **Demo:** `generate_demo` ra trang render đủ token + component qua **mọi mode × mọi typeface**; 2 bộ chuyển đổi đúng & độc lập; trang demo "đúng" pass validator 100% (snapshot/visual baseline).

---

## 13. Rủi ro & quyết định mở

- **Rủi ro #1 — luật interactive-completeness (flagship)**: khó, dễ false positive. Giảm thiểu: làm sau cùng trên 1 stack, dựa AST + heuristic component, cho phép `// dsmcp-ignore` có lý do.
- **Rủi ro #2 — adoption**: nếu AI/dev không gọi tool, governance vô nghĩa → bù bằng CLI/hook/CI (Phase 2 trở đi) + adoption artifacts.
- **Quyết định mở (cập nhật 2026-06-05):** tên package = **`dsmcp`** (đã chốt). **Đã giải quyết:** đủ 18 mode + trục typeface (§4.1). **Vẫn hoãn:** importer Figma, HTTP transport, đóng gói/publish. **Phát sinh mới:** font-pack cho Flutter (hoãn); cân nhắc theme hoá nốt hover/active của secondary/danger per-mode (hiện kế thừa base — hợp lệ, chỉ là độ "đậm chất").

---

### Bước đầu tiên → Trạng thái hiện tại
~~Khởi tạo repo theo **Phase 0**…~~ **ĐÃ HOÀN THÀNH.** Toàn bộ §1–§13 đã triển khai (trừ các mục "Hoãn lại có chủ đích" liệt kê ở **§0**). Bước tiếp khả dĩ, theo thứ tự giá trị: (1) font-pack cho Flutter, (2) theme hoá hover/active secondary·danger per-mode, (3) HTTP transport, (4) importer Figma, (5) đóng gói/publish `dsmcp`.
