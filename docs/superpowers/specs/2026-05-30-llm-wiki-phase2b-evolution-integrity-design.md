# LLM-Wiki Phase 2b: Evolution & Integrity — Design Spec

- **Дата:** 2026-05-30
- **Статус:** Draft (design) — очікує review
- **Репозиторій:** `abc-budget/requirements`
- **Спирається на:** Phase 1 + Phase 2a (merged)
- **Попередні специфікації:** `2026-05-30-llm-wiki-knowledge-system-design.md`, `2026-05-30-llm-wiki-phase2a-dialogue-engine-design.md`

---

## 1. Мета і скоуп

Зробити граф знань **цілісним при наповненні** (видимість прогалин/боргу) і
**безпечним при еволюції** (зміни нотаток не ламають граф). Це **підсистема 2b**;
реалізується у порядку **B → A**.

- **Половина B — Видимість стану:** `graph.mjs` → `index/health.md` (м'які
  сигнали якості) + git pre-commit (фінальний страж).
- **Половина A — Еволюція й безпечний запис:** єдина модель запису нотатки
  (`lib/heal.mjs` + `tools/write-note.mjs`, atomic write), скіл `kb-evolve`
  (deprecate/merge/split/rename), скіл `kb-sanitize` (плановий збір боргу).

**Поза скоупом 2b:** журнал/самері сесій (2c), повний autonomous-режим, Phase 3
(генерація `docs/`).

**Наскрізний принцип, що розводить два рівні перевірок:**
- `validate.mjs` = **тверді інваріанти**, БЛОКУЮТЬ (биті схеми, висячі лінки,
  дублі ID, висячі `parent`/`topic`). Уже існує (Phase 1/2a).
- `graph.mjs`/`health.md` = **м'які сигнали якості**, НІКОЛИ не блокують
  (exit 0 завжди). Нове в 2b.

---

## 2. Половина B — Видимість стану

### 2.1 `tools/graph.mjs` → `index/health.md`

Неблокуючий звіт здоров'я (завжди exit 0). Генерує `index/health.md` (банер
GENERATED). Сигнали поділені на два рівні певності.

**Tier 1 — тверді сигнали (завжди показувати, низький шум):**
1. **Борг міграції** — нотатки `status: deprecated`, на які ще є вхідні `links`
   (хтось лінкує на застаріле замість живого `superseded_by`). Об'єктивно.
2. **Відкриті питання/ризики** — усі `Q-` / `RISK-` / `ASMP-` зі `status` ≠
   `accepted` (тобто `draft`/`proposed`). Це робоча агенда.
3. **Порожні вузли mind-map** — `topic`-нотатки без жодної прикріпленої
   конкретної нотатки (нема нотаток із `topic: <цей TOP->` і нема дочірніх
   topic-вузлів з наповненням). Прямий аналог coverage-gap; найцінніший сигнал
   прогалини для top-down методу.

**Tier 2 — м'які сигнали (окрема секція «можливо, потребує уваги»; евристика):**
4. **Сирітки** — конкретні нотатки (НЕ `topic`) без жодного `links` і без
   backlinks. Показуємо, але не б'ємо на сполох (рання стадія → багато законних
   сиріток).
5. **Ймовірні дублі** — нотатки одного `type` із near-exact схожим `title`.
   **Вимкнено за замовчуванням**, вмикається прапорцем `--duplicates`.
   **Алгоритм (рішення Q-2B-001, на основі ресерчу):** нормалізований
   **Jaro-Winkler** по `title` (tie-break — `summary`), у межах одного `type`,
   поріг схожості **≥ 0.92**. Нормалізація перед порівнянням: lowercase, trim,
   схлопнути пробіли, прибрати пунктуацію. **Без зовнішніх залежностей**
   (Jaro-Winkler — чистий JS, ~40 рядків, тестований). Вивід — пари з показником
   схожості, спадно.
   *Чому НЕ Jaccard/TF-IDF/embeddings:* ресерч показав, що токенний Jaccard має
   низький recall (~0.40) на коротких рядках; символьний Jaro-Winkler дає F1≈1.0
   на near-exact. Семантичні (перефразовані) дублі свідомо віддані `resolve`-кроку
   `kb-capture` + судженню LLM — не дублюємо це важким семантичним стеком у
   `graph.mjs`. Поріг високий навмисно: хибнопозитив дратує більше за пропуск
   (а пропуск страхує resolve/LLM). Поріг — константа, легко підкрутити.

**Свідомо НЕ включаємо:** висячі `parent`/`topic`/`links` — це помилки
`validate.mjs`, не «здоров'я». Межа health/validate чітка, без дублювання.

**Конфігурованість дублів (через `kb.config.yml`).** Політика дублів виноситься
в конфіг (per-base, session-free, бо оптимум порога залежить від домену). Виносимо
**лише політику**, не реалізацію (алгоритм Jaro-Winkler, нормалізація, поля —
лишаються в коді; YAGNI):
```yaml
# kb.config.yml — нова опційна секція (відсутня → діють вшиті дефолти)
health:
  duplicates:
    enabled: false      # default (Tier-2 шумний сигнал)
    threshold: 0.92     # default; домен-залежний (фінанси ~0.95, маркетинг ~0.80)
```
- `lib/config.mjs` (Phase 1) розширюється: читати `health.duplicates` з тими ж
  дефолтами. **Потрібен глибокий (вкладений) мердж дефолтів** — поточний
  `{...DEFAULTS, ...parsed}` плаский, тож додаємо акуратне злиття для секції
  `health` (відсутній/частковий `health` → дефолти підставляються).
- Конфіг **необов'язковий**: немає файлу / немає секції → вшиті дефолти
  (`enabled:false`, `threshold:0.92`). Наявні бази не ламаються.
- `graph.mjs` бере `enabled`/`threshold` з конфігу. CLI-прапорець `--duplicates`
  лишається як **разовий override**. **Пріоритет:** CLI-прапорець > конфіг >
  вшитий дефолт. (Аналогічно можна додати `--dup-threshold`, опційно.)

`health.md` структуровано так, щоб `kb-orient` міг його прочитати на старті
(Tier-1 лічильники = «що робити далі»).

### 2.2 git pre-commit hook

Фінальний страж перед потраплянням у історію. Встановлюється у
`.git/hooks/pre-commit` (із версіонованого джерела `tools/hooks/pre-commit`, щоб
було в репо; інсталяцію документуємо). Дії:
1. `node tools/validate.mjs` — **жорсткий гейт** (exit ≠ 0 → коміт блокується).
2. `node tools/reindex.mjs && git add index/MAP.md index/*.index.md index/backlinks.json index/mindmap.md`
   — індекси регенеруються і доклеюються (НЕ `mindmap.html` — він gitignored).
3. `node tools/graph.mjs && git add index/health.md` — **неблокуючий** (exit 0);
   звіт здоров'я оновлюється і доклеюється.

Розподіл (повна картина перевірок):

| Момент | Дія | Блокує? |
|---|---|---|
| Claude PostToolUse | `validate` | так |
| Claude Stop | `reindex` | ні |
| git pre-commit | `validate` (гейт) + `reindex`+add + `graph`+add | validate так; решта ні |

---

## 3. Половина A — Еволюція й безпечний запис

### 3.1 Модель запису: «реконструкція до здорового стану»

**Інваріант:** *кожен запис нотатки приводить її до здорового стану.* Запис —
не `find/replace`, а **реконструкція**: `(поточний стан, якщо є) + намір (від LLM)
+ rule_set → здорова нотатка`. Резолюція `deprecated→superseded` — таке саме
правило, як «оновити `updated`», не «прихована технічна зміна».

**Поділ відповідальності:**
- **LLM = сенс:** який концепт, тіло, зв'язки, `title`/`summary`/`type`. Судження.
- **Скрипт = здоров'я:** детермінований запис за rule_set. Консистентність кодом,
  не дисципліною (головний принцип проєкту).

Межа ізоляції — **нотатка, яку зараз пишемо**: її власне лікування є частиною
запису (це не порушує ізоляцію логічного від технічного). Bulk-зміни **інших**
нотаток заборонені в логічних змінах — лише через `kb-sanitize`.

### 3.2 `lib/heal.mjs` — `healNote(...)` (єдине джерело rule_set)

Чиста, тестована функція. Підпис (орієнтовно):
`healNote({ frontmatter, body }, { existing, allNotes, today }) → { frontmatter, body }`
де `allNotes` дає контекст для транзитивного резолвлення ланцюгів супедингу.
Спільна для `kb-capture`, `kb-evolve`, `kb-sanitize` — rule_set не дублюється.

**rule_set (A–E):**

**A. Ідентичність і файл**
1. `id` незмінний при реконструкції (береться зі стану, не переписується).
2. Ім'я файлу = `{id}-{slug}.md`; `slug` похідний від `title` (kebab); зміна
   `title` оновлює slug, але НЕ `id`.

**B. Frontmatter**
3. Обов'язкові поля присутні (`id,type,title,status,summary` + типові:
   `priority,category` для requirement/nfr; `parent` для topic). Брак → помилка
   (не тихе заповнення).
4. `created` ставиться один раз і зберігається; `updated` = сьогодні на кожен
   запис; формат `YYYY-MM-DD`.
5. `status` — валідний enum; на створення default `draft`.
6. Детермінований порядок ключів frontmatter (стабільні git-дифи).

**C. Здоров'я зв'язків (лікування)**
7. Кожен ID у `links` / інлайн `[[ID]]` / `parent` / `topic`, що вказує на
   `deprecated`-нотатку → переписується на **живий кінець** ланцюга
   `superseded_by` (транзитивно; guard проти циклу — як у `buildTree`). Циклічний/
   битий ланцюг → не зациклюватись, лишити як є + позначити (борг для
   `health.md`/`kb-sanitize`, не падіння запису).
8. `links` дедуплікуються (зберігаючи порядок першої появи).
9. Прибрати самопосилання (нотатка не лінкує на власний `id`).

**D. Збереження даних**
10. Будь-яке поле frontmatter чи вміст тіла, не кероване правилом, зберігається
    **дослівно**. Реконструкція виправляє, ніколи не обрізає незнайоме.

**E. Гейт (локальний)**
11. Після реконструкції результат проходить **локальну** перевірку (парс +
    схема типу + дотримання rule_set). Провал → запис не відбувається, помилка
    (а не битий файл). Глобальна крос-файлова перевірка (дублі ID, висячі лінки)
    лишається за PostToolUse-hook/`validate`.

### 3.3 `tools/write-note.mjs` — atomic write

Приймає намір + target-шлях, викликає `healNote`, пише атомарно:

```
write-note(targetPath, intent):
  1. healed = healNote(intent, { existing, allNotes, today })      # rule_set A–E
  2. tmp = <dir>/.{id}.{nonce}.tmp ; write(tmp, healed)            # tmp ПОРЯД з target
  3. локальна валідація tmp (rule E); провал → видалити tmp, кинути помилку
                                                # (target недоторканий)
  4. rename(tmp → target)        # атомарно перезаписує (create й update — один шлях)
                                 # на EPERM/EBUSY (Windows: AV/індексатор/відкритий
                                 # редактор) — короткий retry, тоді чесна помилка
  5. (PostToolUse-hook) глобальний validateNotes(repo)
```

**Рішення дизайну:**
- Один шлях `rename` для create й update — `rename` атомарний і перезаписує;
  проміжний бекап старого НЕ потрібен (git = машина часу).
- tmp **у тій самій директорії** (атомарність `rename` лише в межах тому;
  крос-том деградує до copy+delete). Ім'я `.{id}.{nonce}.tmp` (крапка-префікс →
  `walkMarkdown` його не підхопить).
- Windows: `fs.rename` через `MoveFileEx` replace-семантику; на блокування —
  retry. Це реальний ризик (Windows + hooks + відкриті файли).
- Прийнятний компроміс: якщо краш між кроком 4 і 5 — у target локально-здоровий,
  але глобально ще не перевірений файл; сам файл цілий, глобальне зловить
  наступний `validate`/`health`. Втрати даних немає.

`kb-capture` (Phase 1) рефакториться, щоб писати через `write-note.mjs` замість
сирого Write (єдиний шлях запису). Hook лишається валідаційним (не хіл-хук — щоб
лікування було явним, не сюрпризним).

### 3.4 `tools/impact.mjs` — blast radius

`impact <ID>` друкує «радіус ураження»: усі нотатки, що посилаються на X
(backlinks), і на які посилається X. Використовує `index/backlinks.json` (вже
генерується). Чиста функція `computeImpact(id, notes, depth)` + CLI. Споживається
`kb-evolve` перед змінами.

**Глибина (рішення Q-2B-002):** default **depth = 1** (прямий радіус —
actionable список для ripple при tombstone-міграції; лікування й так транзитивне
в `heal`, тож `impact` не мусить сам ходити вглиб). Прапорець `--depth N` —
опційний дослідницький режим для огляду околиці при merge/split великих кластерів
(на хабі N>1 шумить, тому не за замовчуванням).

### 3.5 Скіл `kb-evolve`

`.claude/skills/kb-evolve/SKILL.md`. Багатонотаткові зміни. Операції:

- **rename-in-place (той самий префікс):** косметика (slug/`title`/уточнення в
  межах тієї ж категорії). Оновлює ім'я файлу + `title` через `write-note`,
  **`id` недоторканний**, backlinks не чіпає.
- **tombstone-міграція (інший префікс, `AB-123` → `CD-xxx`):** суть/категорія
  змінилась. Створює нову нотатку (новий ID) через `write-note`; стару →
  `status: deprecated` + `superseded_by: CD-xxx`. **Backlinks НЕ переписує** —
  лишає боргом (видимим у `health.md` Tier-1), що лікується пасивно (при
  наступному записі кожної нотатки) або планово (`kb-sanitize`).
- **deprecate:** `status: deprecated` (+ `superseded_by`, якщо є наступник).
- **merge:** дві+ нотатки → одна; решта → deprecated + `superseded_by: <ціль>`.
- **split:** одна → кілька; оригінал → deprecated + `superseded_by` (на головну
  спадкоємицю) або лишається як парасолька-topic (за судженням).

Перед будь-якою зміною з ripple — викликає `impact.mjs`, **показує blast radius**
користувачу (в `debug`). Сам ripple НЕ виконує масово (lazy-міграція; див. 3.1).

### 3.6 Скіл `kb-sanitize`

`.claude/skills/kb-sanitize/SKILL.md`. **Окремий ручний** процес (за запитом;
у майбутньому — за графіком). Збирає накопичений борг міграції в **один bulk
git-commit**, ізольований від логічних змін:
1. Читає `health.md` / граф → знаходить усі вхідні `links`/`parent`/`topic` на
   `deprecated`-нотатки.
2. Для кожної нотатки-джерела переписує їх на живий кінець ланцюга
   (через `write-note` → застосовується весь rule_set, включно з дедуплікацією).
3. Один commit `chore(sanitize): migrate N deprecated references`.
Транзитивність і guard від циклів — з rule_set §3.2.7.

---

## 4. Зміни в існуючих файлах

- **`CLAUDE.md`:** додати в інваріанти модель запису (реконструкція; писати через
  `write-note`/`kb-capture`/`kb-evolve`, не сирим Write); згадати `kb-evolve`/
  `kb-sanitize`; згадати `index/health.md` як генерований; згадати pre-commit.
- **`STATE.md`:** фаза → Phase 2b доступна.
- **`kb-capture` skill:** писати через `write-note.mjs`; передати ripple за межі
  однієї нотатки в `kb-evolve` (як уже описано в Phase 1).
- **`reindex.mjs`:** без змін логіки (health окремо в `graph.mjs`), але pre-commit
  додає `health.md`.

---

## 5. Файлова структура (нове/змінене)

```
lib/heal.mjs                       # NEW — healNote(): rule_set A–E (pure)
lib/config.mjs                     # MODIFY — read health.duplicates (nested defaults merge)
kb.config.yml                      # MODIFY — optional health.duplicates section
tools/write-note.mjs               # NEW — atomic write (temp→validate→rename+retry)
tools/graph.mjs                    # NEW — health report → index/health.md (exit 0)
tools/impact.mjs                   # NEW — blast radius (computeImpact + CLI)
tools/hooks/pre-commit             # NEW — versioned pre-commit source
tools/install-hooks.mjs            # NEW — `npm run install-hooks` (copy → .git/hooks)
.claude/skills/kb-evolve/SKILL.md      # NEW
.claude/skills/kb-sanitize/SKILL.md    # NEW
.claude/skills/kb-capture/SKILL.md     # MODIFY — write via write-note.mjs
CLAUDE.md, STATE.md                # MODIFY
test/heal.test.mjs                 # NEW — rule_set unit tests
test/write-note.test.mjs           # NEW — atomic write (create/update/failure/retry)
test/graph.test.mjs                # NEW — health signals (tier1/tier2)
test/impact.test.mjs               # NEW — blast radius
index/health.md                    # GENERATED (committed, like MAP.md)
```

---

## 6. Тестова стратегія

- **`heal.mjs` (юніт, найважливіше):** кожне правило A–E окремо — id незмінний;
  slug із title; updated=today, created зберігається; порядок ключів детермінований;
  транзитивне резолвлення supersede; guard від циклу в ланцюгу; дедуплікація links;
  прибирання самопосилання; **збереження незнайомих полів/тіла дослівно** (критично);
  локальний гейт відхиляє битий результат.
- **`write-note.mjs` (юніт+інтеграція):** create (target нема); update (target є,
  стара версія зникає); провал валідації → target недоторканий, tmp прибрано;
  tmp поряд із target; retry на симульованому EPERM (мок rename, що кидає раз);
  tmp-файли не лишаються при успіху.
- **`graph.mjs` (юніт):** кожен Tier-1 сигнал (борг міграції; відкриті
  Q/RISK/ASMP; порожні topic-вузли); Tier-2 сирітки; дублі лише коли увімкнено;
  Jaro-Winkler ≥ поріг ловить near-exact title, нижче порога — ні; завжди exit 0;
  health.md має банер.
- **`config.mjs` (юніт):** `health.duplicates` читається; відсутня секція/файл →
  вшиті дефолти (`enabled:false`, `threshold:0.92`); частковий `health` →
  бракуючі поля з дефолтів (вкладений мердж); наявні `mode`/`language`/`owner` не
  ламаються.
- **Пріоритет override (юніт/інтеграція):** CLI `--duplicates` вмикає попри
  `enabled:false` у конфігу.
- **`impact.mjs` (юніт):** backlinks + forward на 1 і N кроків; стійкість до циклів.
- **pre-commit:** інтеграційний — на чистому стані не блокує; на битій нотатці
  блокує (validate); доклеює оновлені index + health.
- **Скіли** (`kb-evolve`, `kb-sanitize`): валідність frontmatter SKILL.md; ручний
  прохід — не юніт.
- **Регресія:** уся наявна Phase 1/2a люкс-сюїта лишається зеленою (50 тестів).

---

## 7. Рішення (раніше відкриті питання)

- `Q-2B-001` ✅ **Вирішено:** Jaro-Winkler по нормалізованому `title` (tie-break
  `summary`), у межах одного `type`, поріг ≥ 0.92, без зовнішніх залежностей,
  лише під `--duplicates`. Обґрунтування й деталі — §2.1 сигнал 5.
- `Q-2B-002` ✅ **Вирішено:** `impact` default depth = 1; `--depth N` для глибшого
  дослідницького огляду. Деталі — §3.4.
- `Q-2B-003` ✅ **Вирішено:** додаємо npm-скрипти `graph` (`node tools/graph.mjs`),
  `impact` (`node tools/impact.mjs`), та `install-hooks` (див. Q-2B-004) у
  `package.json`. (`heal`/`write-note` — внутрішні модулі, окремий CLI-скрипт не
  потрібен.)
- `Q-2B-004` ✅ **Вирішено:** `npm run install-hooks` — скрипт, що копіює
  `tools/hooks/pre-commit` у `.git/hooks/pre-commit` і робить виконуваним. Джерело
  версіонується в репо; інсталяція задокументована в `CLAUDE.md`.
