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

# Vite incrusta las variables VITE_* en el bundle en tiempo de BUILD, no de
# arranque del contenedor -- por eso esto es un ARG (parametro de build)
# ademas de ENV, y hay que fijarlo como build arg en Railway (o con
# `docker build --build-arg VITE_API_URL=...`), no como variable de entorno
# normal del servicio: cambiarla luego sin reconstruir la imagen no tiene
# ningun efecto.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
