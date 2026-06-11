# Дневник на проекта — Навигатор за продажбени умения

> **Агент:** прочети раздел "ТЕКУЩО СЪСТОЯНИЕ" винаги. Архивът отдолу чети само ако ти трябва "защо" зад някое решение.
> **Обновяване:** при "обнови handoff-а" — (1) презапиши "ТЕКУЩО СЪСТОЯНИЕ" да е актуално и кратко; (2) добави нова `### Сесия YYYY-MM-DD` в АРХИВА. Дръж "Текущо състояние" под ~40 реда.

---

# ТЕКУЩО СЪСТОЯНИЕ

**Фаза:** 2 (Наливане на съдържание) — завършена u2713 · следва Фаза 3 (сценарии с flow-ове)

**Какво работи сега:**
- Навигация, routing, branding, mobile drawer
- **HomeScreen** по мокъп: тъмен хедър, плаваща светла лента, две портретни карти
- **Нови ContentBlock типове:** `fields`, `dialogue`, `collapsible`, `tabs`, `actions` (всички рендирани)
- **BlockInteractive.tsx** (`use client`) — Tabs (desktop) / accordion (mobile), Collapsible, бутони Тренирай/Видео
- **ContentRenderer.tsx** — `use client`, рекурсивен; рендира всички блок-типове
- **Обаждане** — 5 персонаж-карти; 4 пълни отговора на възражения + 4 техники с примери; Ключови послания
- **Среща** — Отваряне (4 примера), Нужди (adaptive tabs), Предложение (характеристика vs полза), 4 сценария с транскрипти, Посещение на адрес (3 примера в tabs)
- Злонамерен тип клиент → placeholder
- `tsc --noEmit` и ESLint → 0 грешки

**Git:**
- Клон `template` — save point за клониране
- Клон `master` — основен

**Архитектура (3 слоя):**
- Данни: `src/content/sales-navigator/tree.ts`
- Тема: `src/content/sales-navigator/theme.ts` + `src/app/globals.css`
- Двигател: `src/components/navigator/` (generic, data-driven)

**Следваща задача:**
- Фаза 3 — интерактивни flow-ове/сценарии с разклонения (state machine / mindmap)
- Реални видеа → замени `videoUrl: null` с реален линк
- Чатбот Тренирай → Фаза 4

**Технически капани:**
- `params` в Next.js 16 е Promise → `await params`
- `ContentRenderer` е `use client` — иначе функция не може да минава като prop към Client Component
- Bulgarian closing quote (U+201C) в TS стрингове се escape-ва като `\"`; opening U+201E е ОК
- PowerShell: ползвай `[System.IO.File]::ReadAllText` + `WriteAllText`; `Set-Content -NoNewline` разбива файла
- Sidebar: `NavigatorShell` → `--sidebar-width: clamp(13rem, 14vw, 17rem)`
- Magnific MCP: `images_generate_svg` за икони; Lucide `iconMap` за вътрешни страници

**Подробни справки:** `docs/01-materials-reference.md` · `docs/05-pptx-content.md` · `docs/06-otkriti-vaprosi.md`

---

# АРХИВ (хронология — чети при нужда)

### Сесия 2026-06-11 (Чат 3) — Фаза 2: нови блокове + пълно съдържание

**Искано:** Наливане на цялото съдържание от PPTX в навигатора — Обаждане и Среща. Нови блок-типове за персонаж-карти, диалози, разгъваеми секции, adaptive tabs, action бутони.

**Решения и защо:**
- **ContentRenderer → `use client`** — задължително, защото предава функция `renderBlocks` на `BlockInteractive` (Client Component); Server→Client функции хвърлят runtime грешка в Next.js App Router
- **Separate BlockInteractive.tsx** — само интерактивните блокове (tabs/collapsible/actions) в Client Component; останалото server-rendered
- **PowerShell `[System.IO.File]::ReadAllText/WriteAllText`** за надеждна замяна на секции в tree.ts — `Set-Content -NoNewline` разбива файла (конкатенира без разделители), `StrReplace` не открива Bulgarian U+201C кавички
- **`videoUrl: null`** → placeholder за бъдещ линк (вместо `undefined`) за да може да се провери `'videoUrl' in block`; когато има реален линк, стойността се замества

**Направено:**
- `types.ts` — 5 нови ContentBlock типа (FieldsBlock, DialogueBlock, ActionsBlock, CollapsibleBlock, TabsBlock); всички exported
- `BlockInteractive.tsx` — нов `use client`; TabsRenderer (Tabs desktop / accordion mobile), CollapsibleRenderer, ActionsRenderer
- `ContentRenderer.tsx` — `use client`, рекурсивен чрез `renderBlocks()`; рендира всички блок-типове
- shadcn `tabs` + `collapsible` инсталирани (base-ui варианти)
- `tree.ts` (Обаждане): Справяне с 4 възражения (пълни), 4 техники с примери, Ключови послания, 5 сценария с персонаж-карти + dialogue + actions
- `tree.ts` (Среща): Отваряне 4 примера (collapsible), Нужди adaptive tabs, Предложение с fields, 4 сценария + collapsible транскрипти + actions, Посещение на адрес 3 примера в tabs
- Злонамерен → `layout: placeholder`; `tsc --noEmit` + ESLint → 0 грешки

---

### Сесия 2026-06-11 — Визия по мокъп: икони, home, sidebar, типография

**Искано:** Икони като на мокъпа (Magnific MCP), ripple + hover; home page и sidebar максимално близо до 2-те мокъп снимки; шрифтове 12/14-16/18/24-28pt; без разтегнати карти, без дразнещ scroll/линии в менюто.

**Решения и защо:**
- **Custom SVG икони** (Magnific `images_generate_svg`) вместо Lucide composite — мокъпът изисква точни цветове (#D83533, #52626F) и композиция телефон/среща
- **Slide-like scaling** (`clamp` + `vw`) вместо фиксирани px/max-width — на 1920px съдържанието не трябва да „плува“ в средата с дребен текст; минимумите пазят pt спецификацията
- **Sidebar тъмен фон чрез CSS override** — shadcn `sidebar-inner` винаги връща светъл `--sidebar`; градиентът в className не е достатъчен
- **По-тесен timeline** (1px линии, скрит scrollbar) — потребителят отхвърли „оплесканото“ меню и видим scroll
- **ContentRenderer без кутии** за goal/heading — мокъпът на текстовите страници е plain текст + bullets

**Направено:**
- `public/icon-call.svg`, `public/icon-meeting.svg`; `HomeScreen.tsx` — ripple links, портретни карти, хедър с плаваща лента
- `AppSidebar.tsx` — преработен timeline, home 52px, floating panel `#dae5ec`
- `globals.css` — `[data-slot="sidebar-inner"]`, `.timeline-scroll`, ripple keyframes, vw типография
- `NavigatorShell.tsx` — `--sidebar-width: clamp(13rem, 14vw, 17rem)`
- `ContentRenderer.tsx` — plain цел, по-чисти заглавия
- Playwright (devDependency) + screenshots в `docs/` за сравнение с мокъпа

**Отворено:** заглавие „Отваряне“ vs „Отваряне на разговора“ и икона DoorOpen vs chat bubbles — данни в `tree.ts`, не дизайн.

---

### Сесия 2026-06-10 (Чат 2) — Визуални корекции по мокъп + Git save point

**Искано:** Корекции преди клониране — шрифтове, лога, Роби бутон, меню без икони, английски текстове.

**Направено:**
- Шрифтове по спецификация на дизайнера (12/14-16/18/24-28pt → CSS класове `t-body`, `t-subheading`, `t-heading`, `t-home-title`)
- HomeScreen преработен по f8.png мокъп: тъмен хедър (тясна лента), плаваща лента, карти с двуредово заглавие и pill бутони
- AppSidebar преработен по f9.png мокъп: тъмен backdrop, плаващ светъл панел, timeline меню с dots, wider (18rem)
- ContentRenderer: иконата вече се рендира като Lucide компонент (не като стринг "DoorOpen")
- Лога: копирани оригиналните файлове + добавен Immersica лого в footer
- Роби: `RobiButton.tsx` — fixed bottom-right на всички страници (layout.tsx)
- Меню: премахнати lucide икони от sidebar елементите
- Commit в клон `template`, push към origin → базова точка за клониране

**Защо `template` клон:** Позволява клониране на скелета без да се пипа `master`. EasyCredit промени ще вървят в нов клон/master след разклоняване.

---

### Сесия 2026-06 (Чат 1) — Основи

**Какво искаше потребителят:** Обучителен навигатор за продажбени умения за EasyCredit. Нелинейна, интуитивна навигация. В бъдеще — чатбот симулации, анализ на разговори, админ панел. Ключово: **клонируемост** (същ код, различно съдържание) → всичко data-driven.

**Изходни материали** (`C:\Users\Work Account\Desktop\CURSOR\Easy Credit Files`):
- Логическо дърво (`.docx`) — структура на всички екрани (основен референт, резюме в `docs/01`)
- Мокъп задание (`.pptx`, ~2MB) — визия + съдържание (тежък, чете се при нужда)
- Цветова схема (`.docx`) — HEX кодове
- Лога (червено основно + бяло за тъмен фон, PNG без фон)
- 4 мокъп снимки от дизайнера
- Копия с ASCII имена в `.materials_tmp/` (кирилските пътища чупят PowerShell; може да се изтрие)

**Ключови решения и причините зад тях** (пълни Q&A в `docs/02`, `docs/03`):

| Тема | Решение | Защо / бележка |
|---|---|---|
| Шрифт | Sofia Sans | Добра за обучение, кирилица |
| Тема | Само светла | Без dark mode |
| Header | Само на Home | Пести място |
| Меню desktop | Постоянно отворено, акордеон | Показва само активната категория |
| Меню mobile | Drawer + ☰ | Без долна лента |
| Breadcrumbs | Не | Заменени с активен елемент (червено) + Home + Назад |
| URL | На английски | Видим текст на български |
| Икони | Lucide временно | После custom/3D (възможно Magnific) — **може да се смени** |
| Роли | потребител/админ/IT | Placeholder бутон; за Фаза 5 |
| Търсачка | Отложена | Когато съдържанието порасне |
| LLM | OpenAI + Anthropic опция | За Фаза 4 |
| Хостинг | Vercel + Neon | Конфигурирани |
| Сценарии | Дървовидни flow-ове (А/Б/В) | Идея за mindmap визуализация; Фаза 3 |
| Типове клиенти | Карти с икона/снимка | ~15 типа, в PPTX |

**Направено:** цялата Фаза 1 (виж "Текущо състояние"). Файлове: `globals.css`, `layout.tsx`, `types.ts`, `tree.ts`, `theme.ts`, `content/index.ts`, `AppSidebar`, `NavigatorShell`, `HomeScreen`, `ContentRenderer`, `CardGrid`, `[...slug]/page.tsx`.

---

## План за фазите

| Фаза | Съдържание |
|---|---|
| **1 — Скелет** ✓ | Навигация, меню, routing, branding, един попълнен клон |
| **2 — Съдържание** | Всички екрани с реален текст |
| **3 — Сценарии** | Flow-ове с разклонения (state machine), визуализация |
| **4 — Чатбот** | Симулация (OpenAI/Anthropic) + анализ + обратна връзка |
| **5 — Администрация** | Авторизация (3 роли), дашборд, Neon DB схеми |
| **Клониране** | След Фаза 1 или 2 — нов навигатор = нова content/ папка |
