# Техническое задание

## Разработка автоматизированного тестера работоспособности 1C:Предприятие Web-клиент (Healthcheck)

---

## 1. Общие сведения

### 1.1. Назначение системы

Автоматизированный тестер (healthcheck) для периодической проверки работоспособности 1C:Предприятие Web-клиента с автоматической отправкой результатов мониторинга в Zabbix.

### 1.2. Цель разработки

Создание надёжного инструмента для автоматического мониторинга доступности, производительности и корректности работы 1C Web Client, включая:
- Проверку авторизации
- Валидацию загрузки главного меню (Quick Menu)
- Мониторинг системных сообщений
- Извлечение версии платформы и лицензионных данных
- Интеграцию с Zabbix для построения дашбордов и триггеров

### 1.3. Стек технологий

| Компонент | Технология |
|-----------|-----------|
| Runtime | Node.js (LTS, CommonJS) |
| Browser Automation | Playwright v1.61+ |
| Browser | Firefox (headless) |
| Monitoring | Zabbix Sender (TCP protocol, node-zabbix-sender) |
| Containerization | Docker |
| Тестирование | Playwright Test (TypeScript) |

---

## 2. Функциональные требования

### 2.1. Авторизация в 1C Web Client

**Требование HC-AUTH**

Тестер должен:
1. Перейти на указанный URL 1C Web Client (`page.goto(endpoint)`)
2. Кликнуть на поле «User»
3. Заполнить поле «User» логином
4. Кликнуть на поле «Password»
5. Заполнить поле «Password» паролем
6. Нажать кнопку «Log in»
7. Измерить время выполнения операции

**Селекторы:**
- Поле User: `getByRole('textbox', { name: 'User' })`
- Поле Password: `getByRole('textbox', { name: 'Password' })`
- Кнопка входа: `getByRole('button', { name: 'Log in' })`

**Параметры:**
- `TEST_ENDPOINT` — URL веб-клиента (обязательно)
- `TEST_USER` — логин (по умолчанию: `test`)
- `TEST_PASSWORD` — пароль (по умолчанию: `Bi3fa8ta`)
- `TEST_TIMEOUT` — глобальный таймаут в мс (по умолчанию: `60000`)

### 2.2. Проверка Quick Menu (Главного меню)

**Требование HC-MENU**

После успешной авторизации тестер должен:
1. Дождаться появления элемента `#themesCell` (главное меню)
2. Проверить видимость элемента через `expect(locator).toBeVisible({ timeout: 10000 })`
3. Измерить время загрузки

**Детали реализации:**
- Селектор: `page.locator('#themesCell')`
- Timeout: 10 секунд
- В Playwright-тесте (`tests/test-1.spec.ts`) используется `toMatchAriaSnapshot` для валидации содержимого
- В основном скрипте (`run-healthcheck.js`) проверяется только видимость

### 2.3. Мониторинг системных сообщений

**Требование HC-MESSAGE**

Тестер должен:
1. Проверить наличие элемента `#messageCell` с текстом «Messages:» через `toContainText`
2. Дождаться появления реальных сообщений через `page.waitForFunction()`
3. Извлечь данные из элементов с id, соответствующими регексу `/^msg\d+$/`
4. Сохранить массив сообщений для отправки в Zabbix
5. Измерить время проверки

**Детали реализации:**
- Проверка сообщения: `expect(page.locator('#messageCell')).toContainText('Messages:', { timeout: 10000 })`
- Ожидание реальных сообщений:
  ```js
  page.waitForFunction(() => {
    const els = document.querySelectorAll('[id^="msg"]');
    return Array.from(els).some(el => /^msg\d+$/.test(el.id));
  }, { timeout: 10000 })
  ```
- Извлечение сообщений:
  ```js
  const allMsgElements = page.locator('[id^="msg"]');
  // Фильтрация по /^msg\d+$/ (без msgCopy, msgClear, msgClose)
  // Извлечение через getAttribute('data-text') или textContent()
  ```
- Реальные сообщения имеют id, соответствующий регексу `/^msg\d+$/`
- Toolbar-кнопки имеют id с буквами после `msg` (например `msgCopy`, `msgClear`, `msgClose`)
- Сообщения появляются динамически через 2-3 секунды после логина
- Использовать `page.waitForFunction()` вместо фиксированных задержек

### 2.4. Извлечение версии платформы и лицензий

**Требование HC-ABOUT**

Тестер должен:
1. Открыть диалог «О системе» (About):
   - Кликнуть на `div` с текстом «Messages:» (2-й по счёту)
   - Кликнуть на `Service and settings` (по title)
   - Кликнуть на `#MenuAboutButton`
2. Дождаться видимости `#aboutContainer` (timeout: 10s)
3. Подождать 2 секунды для полной загрузки контента
4. Извлечь текстовое содержимое

**Парсинг версии платформы:**
- Регулярное выражение: `/1C:Enterprise 8\.3 \((\d+\.\d+\.\d+\.\d+)\)/`
- Извлекается версия вида `8.x.x.x`
- При отсутствии — значение `'unknown'`

**Парсинг лицензий:**
- Найти секцию после слова «Current:»
- Обработать каждую строку, начинающуюся с 9+ цифр и содержащую `/`
- Извлечь для каждой лицензии:
  | Поле | Описание |
  |------|----------|
  | `id` | GUID лицензии (первые 9+ цифр) |
  | `used` | Количество использованных лицензий |
  | `total` | Общее количество лицензий |
  | `issue` | Дата выдачи (формат: `DD/MM/YYYY HH:MM:SS AM/PM`) |
  | `expiry` | Дата окончания (второй timestamp) |
  | `company` | Название компании в кавычках |
  | `source` | Источник выдачи (источник/source) |

### 2.5. Отправка результатов в Zabbix

**Требование HC-ZABBIX**

Тестер должен отправить все результаты в Zabbix сервер через TCP протокол Zabbix Sender.

**Параметры подключения:**
| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `ZABBIX_HOST` | IP/hostname Zabbix сервера | `localhost` |
| `ZABBIX_PORT` | Порт Zabbix сервера | `10051` |
| `ZABBIX_HOSTNAME` | Hostname в Zabbix | `1c-healthcheck` |

**Формат данных:**

Отправка единственного RAW-элемента `1c.healthcheck.report` со значением — полный JSON-отчёт:

```json
{
  "success": true,
  "status": 1,
  "error": null,
  "platformVersion": "8.3.1234.5678",
  "timings": {
    "login_page_ms": 1.234,
    "login_ms": 2.345,
    "quick_menu_ms": 3.456,
    "messages_ms": 4.567,
    "about_open_ms": 5.678,
    "total_ms": 10.000
  },
  "messages": "сообщение1\nсообщение2",
  "licenses": [
    {
      "id": "123456789",
      "used": 5,
      "total": 10,
      "issue": "01/01/2024 10:00:00 AM",
      "expiry": "01/01/2025 10:00:00 AM",
      "company": "Компания",
      "source": "server"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Zabbix Template структура:**

| Item Key | Тип | Описание | JSONPath |
|----------|-----|----------|----------|
| `1c.healthcheck.report` | TRAP (JSON) | Полный JSON-отчёт | — |
| `1c.healthcheck.status` | DEPENDENT | 1=success, 0=failure | `$.status` |
| `1c.healthcheck.login_page_ms` | DEPENDENT | Время загрузки страницы (с) | `$.timings.login_page_ms` |
| `1c.healthcheck.login_ms` | DEPENDENT | Время логина (с) | `$.timings.login_ms` |
| `1c.healthcheck.quick_menu_ms` | DEPENDENT | Время загрузки меню (с) | `$.timings.quick_menu_ms` |
| `1c.healthcheck.messages_ms` | DEPENDENT | Время проверки сообщений (с) | `$.timings.messages_ms` |
| `1c.healthcheck.about_open_ms` | DEPENDENT | Время открытия About (с) | `$.timings.about_open_ms` |
| `1c.healthcheck.total_ms` | DEPENDENT | Общее время (с) | `$.timings.total_ms` |
| `1c.healthcheck.version` | DEPENDENT | Версия платформы | `$.platformVersion` |
| `1c.healthcheck.messages_text` | DEPENDENT | Текст сообщений | `$.messages` |
| `1c.healthcheck.error` | DEPENDENT | Сообщение об ошибке | `$.error` |
| `1c.healthcheck.licenses_json` | DEPENDENT | JSON лицензий | `$.licenses` |

**Валидация отправки:**
- Распарсить JSON-ответ от Zabbix сервера
- Проверить `response === 'success'` и `info.includes('processed: 1')`
- Зафиксировать результат в `results.zabbixSent`
- При ошибке — записать `results.zabbixError`

### 2.6. Управление браузером

**Требование HC-BROWSER**

- Использовать **Firefox** (headless) — единственный поддерживаемый браузер
- User-Agent: `Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0`
- Установить `firefoxUserPrefs`: `browser.startup.homepage: 'about:blank'`
- Установить `page.setDefaultTimeout(config.test.timeout)`
- Корректно закрывать браузер в блоке `finally`

---

## 3. Нефункциональные требования

### 3.1. Производительность

- Все замеры времени должны выполняться в миллисекундах
- Время конвертируется в секунды (decimal) при отправке в Zabbix
- Использовать `Date.now()` для измерения

### 3.2. Надёжность

- Все таймауты — конфигурируемые через `TEST_TIMEOUT`
- Ошибки не должны приводить к аварийному завершению до отправки результатов в Zabbix
- Блок `finally` обязан выполнить отправку в Zabbix и закрытие браузера
- Exit code: `0` — успех, `1` — ошибка теста, `2` — фатальная ошибка

### 3.3. Конфигурируемость

- Все параметры — через переменные окружения
- Нет хардкода учётных данных, URL, Zabbix-сервера

### 3.4. Контейнеризация

- Dockerfile на базе `mcr.microsoft.com/playwright:v1.61.1-jammy`
- Установка шрифтов: `fonts-dejavu`, `fonts-liberation`
- Установка Firefox через `npx playwright install --with-deps firefox`
- Application files: `run-healthcheck.js`, `zabbix_sender.js`
- CMD: `node run-healthcheck.js`

### 3.5. Архитектура

```
run-healthcheck.js          # Главный скрипт
  ├── runHealthcheck()               # Основной поток тестирования
  │   ├── [1/5] Login page load
  │   ├── [2/5] Authentication
  │   ├── [3/5] Quick Menu validation
  │   ├── [4/5] Messages validation
  │   ├── [5/5] About dialog open
  │   └── [6] Version & license parsing
  ├── buildZabbixItems()             # Формирование отчёта
  └── ZabbixSender (class)          # Отправка в Zabbix
```

---

## 4. Поток выполнения (Test Flow)

```
┌─────────────────────────────────────────────────────────┐
│  START                                                   │
│  t0 = Date.now()                                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  [1/5] Navigating to login page                         │
│  page.goto(endpoint)                                    │
│  → login_page_ms = elapsed                              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  [2/5] Logging in                                       │
│  Click User → fill → Click Password → fill → Click Log in│
│  → login_ms = elapsed                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  [3/5] Verifying Quick Menu                             │
│  expect(#themesCell).toBeVisible(timeout: 10s)          │
│  → quick_menu_ms = elapsed                              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  [4/5] Checking Messages                                │
│  expect(#messageCell).toContainText('Messages:')        │
│  waitForFunction: [id^="msg"] matching /^msg\d+$/       │
│  Extract via getAttribute('data-text') or textContent   │
│  → messages_ms = elapsed                                │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  [5/5] Opening About Dialog                             │
│  Click Messages: → Service & settings → About           │
│  expect(#aboutContainer).toBeVisible(timeout: 10s)      │
│  waitForTimeout(2000)                                   │
│  → about_open_ms = elapsed                              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Parse Platform Version & Licenses                      │
│  regex: 1C:Enterprise 8.3 (version)                     │
│  parse licenses from "Current:" section                 │
│  → platformVersion, licenses                            │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Build Zabbix Report                                    │
│  timings: ms → seconds (decimal)                        │
│  Full JSON payload                                      │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Send to Zabbix via TCP                                 │
│  validate response                                      │
│  → zabbixSent, zabbixError                              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Print Summary (JSON)                                   │
│  Exit 0 (success) / Exit 1 (failure)                    │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Структура проекта

```
.
├── run-healthcheck.js           # Главный скрипт (Node.js, CommonJS)
├── zabbix_sender.js             # Zabbix Sender wrapper (CommonJS)
├── Dockerfile                   # Docker-образ на базе Playwright
├── package.json                 # Зависимости: @playwright/test, node-zabbix-sender
├── playwright.config.ts         # Конфиг Playwright (Firefox project)
├── README.md                    # Документация по запуску
├── zabbix/
│   └── zabbix_template.yaml     # Zabbix Template v8.0 (12 items)
└── tests/
    └── test-1.spec.ts           # Playwright тест (TypeScript)
```

---

## 6. Zabbix Template

**Template name:** `Template 1C Web Client Healthcheck`
**Group:** `1C Healthchecks`
**Version:** Zabbix 8.0

### 6.1. Item Grouping

| Группа | Items |
|--------|-------|
| **Status & Errors** | `status`, `error` |
| **Timings** | `login_page_ms`, `login_ms`, `quick_menu_ms`, `messages_ms`, `about_open_ms`, `total_ms` |
| **Platform Info** | `version`, `messages_text`, `licenses_json` |
| **Master Item** | `report` (TRAP, JSON) |

### 6.2. History Retention

- Timings: **30 days**
- Version, Messages: **90 days**
- Licenses JSON: **30 days**
- Error: **30 days**
- Status: **30 days**
- Master report: **7 days**

---

## 7. Требования к обработке ошибок

### 7.1. Тестовые ошибки

При ошибке теста:
- `results.success = false`
- `results.error = err.message`
- `results.timings.total_ms` фиксируется
- Результаты ВСЁ РАВНО отправляются в Zabbix
- Exit code: `1`

### 7.2. Ошибки отправки в Zabbix

- `results.zabbixSent = false`
- `results.zabbixError = zbxErr.message`
- Exit code определяется `results.success` (не ошибкой отправки)

### 7.3. Фатальные ошибки

- Блок `catch` вокруг `runHealthcheck()`
- Exit code: `2`

---

## 8. Логирование

### 8.1. Консольный вывод

```
=== 1C Web Client Healthcheck ===
Target:      <endpoint>
Zabbix:      <host>:<port> (host: <hostname>)

[1/5] Navigating to login page...
[2/5] Logging in...
[3/5] Verifying Quick Menu...
[4/5] Checking Messages...
[5/5] Opening About dialog...

✓ Platform version: 8.3.x.x.x
✓ Messages count: N
✓ Licenses count: N

=== Sending results to Zabbix ===
Zabbix response: {...}

=== Healthcheck Summary ===
{...}
```

---

## 9. Требования к коду

### 9.1. Стиль

- CommonJS (require/module.exports)
- JSDoc комментарии для функций
- Константы конфигурации в объекте `config`
- Именованные функции вместо анонимных

### 9.2. Безопасность

- Никакого хардкода паролей/URL
- Значения по умолчанию — тестовые
- Креденциалы только через переменные окружения

### 9.3. Поддерживаемость

- Модульная структура: `ZabbixSender` вынесен в отдельный файл
- Конфигурация через единый объект `config`
- Функция `buildZabbixItems()` инкапсулирует формирование отчёта

---

## 10. Критерии приёмки

- [ ] Тестер успешно проходит полный цикл: логин → меню → сообщения → About
- [ ] Результаты корректно отправляются в Zabbix и отображаются в дашборде
- [ ] Значения timing в Zabbix — в секундах (decimal)
- [ ] Версия платформы извлекается корректно
- [ ] Лицензии парсятся корректно (все поля заполнены)
- [ ] Сообщения извлекаются (только `msg\d+`, без toolbar-кнопок)
- [ ] Docker-образ собирается и запускается без ошибок
- [ ] При ошибке теста результаты отправляются в Zabbix
- [ ] Exit code корректен (0/1/2)
- [ ] Zabbix Template импортируется и корректно извлекает поля через JSONPath

---

## 11. Зависимости

### 11.1. npm-пакеты

```json
{
  "dependencies": {
    "@playwright/test": "^1.61.1",
    "node-zabbix-sender": "^1.1.0"
  },
  "devDependencies": {
    "@types/node": "^26.1.1"
  }
}
```

### 11.2. Системные зависимости (Docker)

- `fonts-dejavu` — шрифты для корректного рендеринга
- `fonts-liberation` — шрифты Liberation (аналоги Arial/Times)
- Firefox browser (устанавливается через Playwright)

---

## 12. Сценарии использования

### 12.1. Локальный запуск

```bash
npm ci
ZABBIX_HOST=10.0.0.100 \
ZABBIX_PORT=10051 \
ZABBIX_HOSTNAME=1c-server \
TEST_ENDPOINT=https://example.com/ \
TEST_USER=admin \
TEST_PASSWORD=secret \
node run-healthcheck.js
```

### 12.2. Docker-запуск

```bash
docker build -t 1c-healthcheck .
docker run --rm \
  -e ZABBIX_HOST=10.0.0.100 \
  -e ZABBIX_PORT=10051 \
  -e ZABBIX_HOSTNAME=1c-server \
  -e TEST_ENDPOINT=https://example.com/ \
  -e TEST_USER=admin \
  -e TEST_PASSWORD=secret \
  1c-healthcheck
```

### 12.3. docker-compose

```yaml
version: '3.8'
services:
  healthcheck:
    build: .
    environment:
      - ZABBIX_HOST=10.0.0.100
      - ZABBIX_PORT=10051
      - ZABBIX_HOSTNAME=1c-server
      - TEST_ENDPOINT=https://example.com/
      - TEST_USER=admin
      - TEST_PASSWORD=secret
    restart: "no"
```

### 12.4. Периодический запуск (cron)

```cron
# Каждые 5 минут
*/5 * * * * cd /opt/healthcheck && docker run --rm --env-file .env 1c-healthcheck
```

---

## 13. Планы развития (опционально)

1. **Многоязычность** — поддержка разных языковых локалей (ru_RU, en_US, de_DE)
2. **Multi-browser** — поддержка Chromium и Webkit
3. **Screenshots on failure** — автоскриншот при ошибке
4. **Traces** — сохранение Playwright traces для отладки
5. **Webhook-уведомления** — отправка уведомлений в Telegram/Slack при сбое
6. **REST API** — HTTP endpoint для запуска healthcheck по запросу
7. **CI/CD** — GitHub Actions для автоматической сборки и тестирования

---

*ТЗ сгенерировано на основе анализа кода проекта 1c-web-client-healthcheck*
*Дата: 2026-07-20*
