# 1C Web Client Healthcheck

Playwright-тест для проверки работоспособности 1C Web Client с отправкой результатов в Zabbix.

## Возможности

- Автоматический вход в 1C Web Client
- Проверка загрузки Quick Menu и сообщений
- Извлечение версии платформы и данных о лицензиях
- Отправка всех метрик в Zabbix
- Завершение работы контейнера после выполнения

## Локальный запуск

```bash
# Установка зависимостей
npm ci

# Запуск с переменными окружения
ZABBIX_HOST=10.0.0.100 \
ZABBIX_PORT=10051 \
ZABBIX_HOSTNAME=1c-server \
TEST_ENDPOINT=https://example.com/ \
TEST_USER=admin \
TEST_PASSWORD=secret \
node run-healthcheck.js
```

## Docker

### Сборка образа

```bash
docker build -t 1c-healthcheck .
```

### Запуск контейнера

```bash
docker run --rm \
  -e ZABBIX_HOST=10.0.0.100 \
  -e ZABBIX_PORT=10051 \
  -e ZABBIX_HOSTNAME=1c-server \
  -e TEST_ENDPOINT=https://example.com/ \
  -e TEST_USER=admin \
  -e TEST_PASSWORD=secret \
  1c-healthcheck
```

### docker-compose

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

## Переменные окружения

| Переменная | Обязательна | Описание | По умолчанию |
|------------|-------------|----------|--------------|
| `ZABBIX_HOST` | Да | IP/hostname Zabbix сервера | `localhost` |
| `ZABBIX_PORT` | Нет | Порт Zabbix сервера | `10051` |
| `ZABBIX_HOSTNAME` | Нет | Hostname в Zabbix | `1c-healthcheck` |
| `TEST_ENDPOINT` | Да | URL для тестирования | `https://1c.sitrak.ru/Sitrak_Cache/en_US/` |
| `TEST_USER` | Нет | Логин | `test` |
| `TEST_PASSWORD` | Нет | Пароль | `Bi3fa8ta` |
| `TEST_TIMEOUT` | Нет | Таймаут в мс | `60000` |

## Zabbix Items

| Item Key | Тип | Описание |
|----------|-----|----------|
| `1c.healthcheck.status` | integer | 1 = success, 0 = failure |
| `1c.healthcheck.login_page_ms` | float | Время загрузки страницы логина (мс) |
| `1c.healthcheck.login_ms` | float | Время логина (мс) |
| `1c.healthcheck.quick_menu_ms` | float | Время загрузки меню (мс) |
| `1c.healthcheck.messages_ms` | float | Время проверки сообщений (мс) |
| `1c.healthcheck.about_open_ms` | float | Время открытия About (мс) |
| `1c.healthcheck.total_ms` | float | Общее время (мс) |
| `1c.healthcheck.version` | text | Версия платформы 1C |
| `1c.healthcheck.messages_count` | integer | Количество сообщений |
| `1c.healthcheck.licenses_count` | integer | Количество лицензий |
| `1c.healthcheck.license_used[N]` | integer | Использовано лицензий (индекс) |
| `1c.healthcheck.license_total[N]` | integer | Всего лицензий (индекс) |
| `1c.healthcheck.error` | text | Сообщение об ошибке |

## GitHub Actions

Образ автоматически собирается и публикуется при пуше в `main`/`master` или создании тега.

Секреты настраивать не нужно — авторизация через `GITHUB_TOKEN` работает автоматически.

### Локальная проверка сборки

```bash
docker build -t 1c-healthcheck:dev .
```

## Структура проекта

```
.
├── run-healthcheck.js    # Основной скрипт запуска
├── zabbix_sender.js      # Zabbix sender без внешних зависимостей
├── Dockerfile
├── .dockerignore
├── package.json
└── tests/
    └── test-1.spec.ts    # Оригинальный Playwright тест
```
