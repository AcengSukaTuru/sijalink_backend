# Deployment SijaLink Backend

## Deploy container

```bash
cp deploy/.env.example deploy/.env
# isi secret production di deploy/.env
DOCKER_CONFIG=/DATA/Development/.docker docker compose -f deploy/compose.yaml --env-file deploy/.env up -d --build
```

## Akses LAN

- API: `http://IP_SERVER:3000/api/v1`
- Swagger: `http://IP_SERVER:3000/docs`
- MinIO Console: `http://IP_SERVER:19001`
- MinIO API: `http://IP_SERVER:19000`

Jangan expose port `5432`, `15432`, `19000`, atau `19001` ke internet kecuali ada kebutuhan admin. Untuk FE, cukup expose API port `3000`.

## Port forwarding router

Atur port forwarding di router internet:

```text
WAN TCP 3000 -> IP_LAN_SERVER TCP 3000
```

FE memakai:

```text
http://PUBLIC_IP:3000/api/v1
```

Lebih aman: gunakan domain + HTTPS reverse proxy (Nginx/Caddy/Cloudflare Tunnel) daripada membuka port API mentah ke internet. Jangan port-forward PostgreSQL atau MinIO.

## Compose plugin di ZimaOS

User `vito` memakai lokasi plugin berikut karena `/DATA/.docker` tidak writable:

```bash
export DOCKER_CONFIG=/DATA/Development/.docker
```
