# Build en un stage con Node, servido por nginx en el stage final -- la
# imagen que se despliega no lleva Node ni node_modules, solo el html/js/css
# compilado.
FROM node:20-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Capa de dependencias separada del codigo fuente, igual que en el
# Dockerfile del backend: solo se reinstala si cambian los lockfiles.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# baseURL en produccion es '/api' a secas (frontend/src/api/client.ts,
# via import.meta.env.PROD) -- no hace falta ningun build arg para que el
# frontend sepa donde esta el backend, nginx.conf lo resuelve con el
# proxy inverso de /api/ hacia Railway.
RUN pnpm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
