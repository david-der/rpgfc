# RPG FC — thin wrapper over pnpm scripts (TDD v2 §11.4).
.PHONY: dev build test test-pg doctrine lint typecheck format db-reset docker clean install

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

test-pg:
	DATABASE_URL=postgres://rpgfc:rpgfc@localhost:5432/rpgfc pnpm --filter @rpgfc/server test

doctrine:
	pnpm doctrine

lint:
	pnpm lint
	pnpm typecheck

typecheck:
	pnpm typecheck

format:
	pnpm format

db-reset:
	pnpm db:reset

docker:
	docker build -f docker/Dockerfile -t rpgfc:dev .

clean:
	rm -rf node_modules packages/*/node_modules packages/*/dist saves coverage playwright-report test-results
