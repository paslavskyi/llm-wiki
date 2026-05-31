# LLM-Wiki: система знань про продукт — Design Spec

- **Дата:** 2026-05-30
- **Статус:** Approved (design)
- **Автор:** Andrii Paslavskyi + Claude
- **Репозиторій:** `paslavskyi/llm-wiki`

---

## 1. Мета і контекст

Побудувати **LLM-native систему знань** про програмний продукт. Репозиторій
стає єдиним джерелом правди, на базі якого згодом будуються Architect spec,
Product requirements (spec-docs & implementation plans), Roadmap/KPI та
маркетингові стратегії (GTM, advertising).

Робота відбувається як **діалог** користувача з LLM. Система систематизує
знання у файли так, щоб їх можна було надійно зберігати, знаходити on-demand і
нарощувати між сесіями.

### 1.1 Головні принципи (драйвери дизайну)

1. **Knowledge-only репозиторій.** Тут живуть лише знання/специфікації/планування.
   Код продукту — в окремому репозиторії.
2. **Session-free flow.** Репозиторій сам несе всі інструкції та стан. Будь-яка
   нова сесія: «прочитав репо → знаю, де ми, що далі, за якими правилами
   працювати». Не залежить від пам'яті конкретного чату. Це **LLM-wiki**
   (знання) + **LLM assistance** (скіли/інструкції).
3. **Index-first retrieval.** Навігація через шар індексів: «кореневий індекс →
   доменний індекс → конкретна нотатка». Не читаємо все — знаходимо потрібне.
   Progressive disclosure.
4. **LLM-native.** Інтерфейс до знань — LLM, не людина. Оптимізуємо під
   grep-абельність, стабільні ID, frontmatter-метадані, явні зв'язки. Читабельність
   для людини — не вимога; точність, відсутність дублювання, машинна
   структурність — вимога.
5. **Стабільність через машину, не дисципліну.** Консистентність індексів і
   нотаток гарантується кодом (валідація + генерація), а не лише дотриманням
   процедур.

### 1.2 Обраний технічний підхід

**Markdown + YAML-frontmatter (атомарні нотатки) + легкі Node.js-скрипти** для
валідації схеми та генерації індексів. NodeJS наявний, що задовольняє вимогу
стабільності. Структурність живе у frontmatter; гнучкість вільного тексту — у
тілі нотатки. Один формат файлу для «м'яких» (vision, marketing) і «строгих»
(requirements) знань.

---

## 2. Архітектура: три шари

| Шар | Де | Призначення | Хто пише |
|---|---|---|---|
| **1. Знання (LLM-wiki)** | `knowledge/` | Атомарні нотатки — джерело правди | людина / діалог |
| **1b. Індекси** | `index/` | Похідні роутери для index-first навігації | генератор |
| **2. Асистент** | `.claude/skills/`, `tools/` | Скіли + Node-тулінг: *як* працювати зі знаннями | — |
| **3. Стан** | `STATE.md`, `journal/` | Де ми зараз + історія дельт між сесіями | скіли |

**Інваріанти:**
- `knowledge/` — єдине джерело правди, пишеться людиною/в діалозі.
- `index/`, `docs/` — **похідні**, завжди регенеруються, ніколи не правляться руками.
- `CLAUDE.md` + `kb.config.yml` + `STATE.md` — читаються **першими** у новій сесії.
- Скіли й тули живуть **усередині репо** → клонував і все працює, без залежності
  від конкретного чату чи `~/.claude`.

---

## 3. Структура репозиторію

```
/requirements/
├── CLAUDE.md                  # авто-вхід: правила, інваріанти, словник, протокол
├── kb.config.yml              # mode (debug/autonomous), language, owner
├── STATE.md                   # знімок: фаза, зроблено, далі, відкриті питання
├── package.json
│
├── knowledge/                 # ШАР 1 — джерело правди (атомарні нотатки)
│   ├── vision/                #   проблема, місія, value prop, принципи
│   ├── market/                #   конкуренти, ринок, тренди
│   ├── users/                 #   персони, сегменти, JTBD, болі
│   ├── product/
│   │   ├── features/          #   фічі
│   │   ├── requirements/      #   FR + NFR (атомарні)
│   │   ├── stories/           #   user stories
│   │   └── domain/            #   доменні сутності, глосарій
│   ├── roadmap/               #   віхи, фази, KPI/метрики
│   ├── gtm/                   #   go-to-market, позиціонування, канали, ціна
│   └── decisions/             #   ADR-журнал рішень
│
├── index/                     # ГЕНЕРУЄТЬСЯ — НЕ редагувати руками
│   ├── MAP.md                 #   кореневий роутер (домени, лічильники, навігація)
│   ├── <domain>.index.md      #   індекс на домен (id|title|status|priority|summary)
│   ├── traceability.md        #   матриця FR ↔ feature ↔ story ↔ KPI
│   ├── backlinks.json         #   зворотні зв'язки (для impact-аналізу)
│   └── health.md              #   сирітки, відкриті Q-, нерозв'язані RISK-/ASMP-, дублі
│
├── journal/                   # історія дельт по сесіях (kb-recap)
│   └── YYYY-MM-DD-HHMM.md
│
├── docs/                      # ГЕНЕРУЄТЬСЯ — PRD, spec, roadmap, GTM (фаза 2)
│
├── tools/                     # Node-скрипти
│   ├── validate.mjs           #   валідація frontmatter за схемою типу
│   ├── reindex.mjs            #   регенерація index/* + backlinks
│   ├── graph.mjs              #   звіт здоров'я → health.md (неблокуючий)
│   ├── impact.mjs             #   blast radius нотатки (N кроків по графу)
│   ├── session-delta.mjs      #   факти дельти з git diff для kb-recap
│   └── schema/                #   JSON-схеми по типах нотаток
│
└── .claude/
    ├── skills/                # ШАР 2 — 7 скілів (див. §6)
    ├── hooks/
    └── settings.json          # PostToolUse→validate · Stop→reindex
```

---

## 4. Анатомія атомарної нотатки

Кожна нотатка = **один концепт** = один файл. Ім'я: `{ID}-{slug}.md`.

```markdown
---
id: FR-001                      # стабільний, незмінний, доменно-префіксований
type: requirement               # з фіксованого словника типів
title: Користувач створює бюджет на місяць
status: draft                   # draft | proposed | accepted | deprecated
summary: >                      # 1 рядок — потрапляє в індекс (index-first)
  Юзер може створити місячний бюджет із категоріями та лімітами.
tags: [budgeting, core]
links: [JTBD-002, FEAT-003, NFR-005]   # явні зв'язки по id (граф знань)
# --- поля, специфічні для типу ---
priority: must                  # must | should | could | wont
category: functional            # functional | non-functional
created: 2026-05-30
updated: 2026-05-30
superseded_by:                  # заповнюється лише при deprecated (tombstone)
---

Тіло: вільний текст, критерії прийняття, контекст.
Інлайн-зв'язки дозволені через [[JTBD-002]].
```

### 4.1 Словник типів і префіксів ID

| Домен | type | Префікс ID |
|---|---|---|
| vision | `vision`, `principle`, `value-prop` | `VIS-` |
| market | `competitor`, `market-insight` | `CMP-`, `MKT-` |
| users | `persona`, `segment`, `jtbd`, `pain` | `PER-`, `SEG-`, `JTBD-`, `PAIN-` |
| product | `feature`, `requirement`, `nfr`, `story`, `entity`, `term` | `FEAT-`, `FR-`, `NFR-`, `STORY-`, `ENT-`, `TERM-` |
| roadmap | `milestone`, `kpi` | `MIL-`, `KPI-` |
| gtm | `positioning`, `channel`, `pricing`, `message` | `POS-`, `CHAN-`, `PRICE-`, `MSG-` |
| cross-cutting | `risk`, `assumption`, `question` | `RISK-`, `ASMP-`, `Q-` |

### 4.2 Пріоритезація

Поле `priority: must | should | could | wont`. Значення самодостатні; **назва
фреймворку ніде не вживається**. Для планування (roadmap) пізніше додається
окреме поле `horizon: now | next | later`, щоб не змішувати пріоритет вимоги з
часом реалізації.

### 4.3 Чому так

- **Стабільний ID** = вузол графа. `links` не ламаються при перейменуванні
  файлу/заголовка. `validate.mjs` гарантує унікальність ID і що всі `links`
  резолвляться (немає висячих посилань).
- **`summary`** — суть для індексу без читання нотатки (index-first).
- **`type` + специфічні поля** — машинна структурність: requirement має
  `priority`, kpi — `target/unit`, competitor — `url`. Дає KPI й трасування.

---

## 5. Тулінг і автоматизація (шар стабільності)

### 5.1 Скрипти

- **`validate.mjs`** — страж інваріантів: frontmatter відповідає JSON-схемі свого
  `type`; усі `id` унікальні; усі `links`/`[[ID]]` резолвляться; ім'я файлу = `id`.
  Exit ≠ 0 при помилці.
- **`reindex.mjs`** — генератор похідних: перезаписує `MAP.md`,
  `<domain>.index.md`, `traceability.md`, `backlinks.json`. Кожен файл має
  банер `<!-- GENERATED — не редагувати руками -->`.
- **`graph.mjs`** — неблокуючий звіт здоров'я → `health.md`: сирітки (без
  зв'язків), відкриті `Q-`, нерозв'язані `RISK-`/`ASMP-`, ймовірні дублі (схожі
  `title`/`summary` одного типу), deprecated-але-ще-лінковані («борг міграції»).
  Завжди exit 0.
- **`impact.mjs <ID>`** — blast radius: усі нотатки, що посилаються на X і на які
  посилається X, на N кроків. Викликається `kb-evolve` перед багатонотатковою зміною.
- **`session-delta.mjs`** — рахує факти дельти з `git diff` від останнього
  журнального запису (додано/змінено/deprecated нотатки, нові `Q-/RISK-/ASMP-`).

### 5.2 Автоматизація через hooks

| Момент | Що | Блокує? |
|---|---|---|
| Claude **PostToolUse** (Write/Edit у `knowledge/**`) | `validate.mjs` | так — миттєвий feedback, показує помилку |
| Claude **Stop** (кінець ходу, якщо `knowledge/` змінювалось) | `reindex.mjs` | ні — індекси завжди свіжі |
| git **pre-commit** | `validate` + (`reindex` && `git add index/`) + `graph`→`health.md` (`git add`) | `validate` так; решта ні |

Логіка: **валідація — миттєвий feedback на кожен запис**; **реіндексація — раз у
кінці ходу**; **pre-commit — фінальний страж перед потраплянням у git-історію**
(гарантує, що зламаний/протухлий стан ніколи не закомітиться, навіть якщо хтось
працює повз скіли).

---

## 6. Скіли («LLM assistance») — 7 шт.

Живуть у `.claude/skills/`, їдуть із репо, працюють у будь-якій сесії.

1. **`kb-orient`** *(session-bootstrap, найперший крок)* — читає `STATE.md` +
   `index/MAP.md` + `index/health.md` + **останній** запис `journal/` → картина
   «де ми (фаза), що зроблено, що далі, відкриті питання, здоров'я графа». Не
   читає самі нотатки — тільки індекси. Реалізація session-free.
2. **`kb-recall`** *(read-path)* — протокол `MAP → доменний індекс → нотатки`.
   Завжди через `summary`, вантажить тільки потрібні id + їхні зв'язки. Не
   дозволяє читати «все підряд».
3. **`kb-capture`** *(write-path, одна нотатка)* — **`resolve` спершу** (через
   `kb-recall`): шукає наявний концепт → **update**, суміжний → **create + link**,
   немає → **create**. Заповнює frontmatter за схемою, кладе в правильну папку,
   проставляє `links`, оновлює `STATE.md` за потреби. Якщо update виходить за межі
   однієї нотатки (зачеплені backlinks по сенсу) → **передає керування** `kb-evolve`.
4. **`kb-evolve`** *(write-path, багатонотаткові зміни)* — merge / split / rename /
   deprecate, ripple-propagation по графу (через `impact.mjs`), дедуплікація.
   **Tombstone-принцип**: ніколи не видаляє ID із backlinks — натомість
   `status: deprecated` + `superseded_by: NEW-ID`. Завжди показує blast radius
   перед дією; семантичний ripple — рішення за користувачем, механічний — за правилами.
5. **`elicit-requirements`** *(engine — головний діалог)* — структуроване
   витягування знань ланцюгом **vision → users/JTBD → features → FR/NFR → stories
   → constraints**. Питання по одному, пропонує варіанти, дає pros/cons, кидає
   виклик припущенням, ловить прогалини. Кожен інсайт → `kb-capture`.
   Невизначеності фіксуються як `Q-/ASMP-/RISK-`, не «забуваються».
6. **`kb-synthesize`** *(generator, фаза 2)* — збирає атомарні нотатки в артефакти
   `docs/`: PRD, architecture spec, roadmap, GTM-brief.
7. **`kb-recap`** *(кінець сесії)* — дельта-самері знань → `journal/YYYY-MM-DD-HHMM.md`:
   додано / змінено / забуто(deprecated) / нові питання / рішення / куди далі.
   Машинна основа — `session-delta.mjs`; наратив — LLM.

**`CLAUDE.md`** (не скіл, авто-вхід щосесії): що це за репо й 3 шари; протокол
сесії (прочитай `kb.config.yml` → `kb-orient` → працюй через скіли); інваріанти-
заборони (не редагуй `index/`/`docs/` руками; не видаляй ID із backlinks; фіксуй
лише через `kb-capture`/`kb-evolve`; не читай «все підряд»); словник типів/ID;
карта папок; як перемикати режим.

---

## 7. Режими роботи (UX)

`kb.config.yml` у корені (читається `CLAUDE.md` найпершим):

```yaml
mode: debug          # debug | autonomous
language: uk
owner: Andrii
```

Кожен скіл має дві гілки виводу:

| | **debug** (власник) | **autonomous** (необізнаний юзер) |
|---|---|---|
| Читання | «Прочитав MAP + 3 нотатки: FR-001, JTBD-002…» | *(тихо)* |
| Запис | «Створив FR-007, оновив FEAT-003, +2 links» | «Занотував.» / «Додав.» |
| Пошук | «У графі: FR-001, FR-004 (accepted)…» | «Знайшов, ось що вже знаю: …» (суть, без ID) |
| Ripple | повний blast radius + рішення по кожній | «Оновив пов'язане.» |
| Помилки валідації | повний текст помилки | тихо лагодить або питає по-людськи |

У `autonomous` уся механіка wiki (ID, індекси, hooks) повністю схована.

---

## 8. Стан і журнал (шар 3)

- **`STATE.md`** = *знімок* «де ми зараз»: поточна фаза, чекліст прогресу по
  доменах, рекомендований наступний крок, зведення відкритих `Q-/ASMP-/RISK-`.
- **`journal/`** = *історія дельт* по сесіях (пише `kb-recap`).

`kb-orient` на старті читає **останній** запис журналу + STATE → неперервність
між сесіями.

---

## 9. Життєвий цикл сесії

```
kb.config.yml → kb-orient → elicit-requirements ⇄ {kb-recall, kb-capture/kb-evolve}
              → [Stop-hook: reindex] → kb-recap → journal/
              · git commit → [pre-commit: validate + reindex + graph]
```

---

## 10. Фази реалізації

- **Фаза 1 (інфраструктура):** `CLAUDE.md`, `kb.config.yml`, `STATE.md`, дерево
  папок, JSON-схеми типів, `validate.mjs`, `reindex.mjs`, hooks (PostToolUse,
  Stop), скіли `kb-orient`/`kb-capture`/`kb-recall`.
- **Фаза 2 (повний цикл знань):** `kb-evolve`, `impact.mjs`, `graph.mjs`,
  pre-commit, `kb-recap`, `session-delta.mjs`, `journal/`, режими debug/autonomous,
  скіл `elicit-requirements`.
- **Фаза 3 (генерація артефактів):** `kb-synthesize`, шаблони `docs/` (PRD,
  architecture spec, roadmap, GTM).

---

## 11. Відкриті питання (на майбутнє)

- `Q-DESIGN-001`: точний перелік обов'язкових полів JSON-схеми для кожного типу
  (уточнюється під час реалізації Фази 1).
- `Q-DESIGN-002`: чи потрібна i18n самих нотаток (зберігати знання двомовно), чи
  лише мова відповідей через `kb.config.yml`.
- `Q-DESIGN-003`: глибина `impact.mjs` за замовчуванням (скільки кроків графа).
```
