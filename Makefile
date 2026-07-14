# ============================================================
# FAS — Makefile de comandos de desarrollo
# Uso: make <comando>
# ============================================================

.PHONY: up down restart logs ps db-shell redis-shell reset-db help

# Colores
BOLD  := \033[1m
GREEN := \033[32m
RESET := \033[0m

## Levantar todos los servicios en background
up:
	@echo "$(BOLD)→ Levantando servicios FAS...$(RESET)"
	docker compose up -d
	@echo "$(GREEN)✓ Servicios activos:$(RESET)"
	@echo "  PostgreSQL  → localhost:5432"
	@echo "  Redis       → localhost:6379"
	@echo "  pgAdmin     → http://localhost:5050"
	@echo "  Redis UI    → http://localhost:8081"

## Detener todos los servicios
down:
	@echo "$(BOLD)→ Deteniendo servicios FAS...$(RESET)"
	docker compose down

## Reiniciar servicios
restart:
	docker compose restart

## Ver logs en tiempo real (Ctrl+C para salir)
logs:
	docker compose logs -f

## Ver logs solo de postgres
logs-db:
	docker compose logs -f postgres

## Ver estado de contenedores
ps:
	docker compose ps

## Abrir shell psql en la base de datos
db-shell:
	docker compose exec postgres psql -U fas_user -d fas_db

## Abrir redis-cli
redis-shell:
	docker compose exec redis redis-cli -a fas_redis_pass

## Destruir volúmenes y recrear base de datos limpia (⚠ borra todos los datos)
reset-db:
	@echo "$(BOLD)⚠ Esto borrará TODOS los datos. Confirma con Ctrl+C para cancelar...$(RESET)"
	@sleep 3
	docker compose down -v
	docker compose up -d postgres redis
	@echo "$(GREEN)✓ Base de datos reiniciada$(RESET)"

## Ejecutar migraciones Prisma (desde fas-api)
migrate:
	cd fas-api && npx prisma migrate dev

## Abrir Prisma Studio
studio:
	cd fas-api && npx prisma studio

## Ver este menú de ayuda
help:
	@echo ""
	@echo "$(BOLD)FAS — Comandos disponibles$(RESET)"
	@echo ""
	@grep -E '^## .*' Makefile | sed 's/## /  /'
	@echo ""
