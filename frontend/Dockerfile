# syntax=docker/dockerfile:1
# Varianta minimă: HTML static servit de nginx.
# Tema de laborator: transformați-l într-un build în două etape (node → nginx).
FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html map.html config.js /usr/share/nginx/html/
EXPOSE 80
