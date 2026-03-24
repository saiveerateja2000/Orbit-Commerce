# 🛒 OrbitCommerce

[![CI](https://github.com/saiveerateja2000/Orbit-Commerce/actions/workflows/ci.yml/badge.svg)](https://github.com/saiveerateja2000/Orbit-Commerce/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docker Compose](https://img.shields.io/badge/docker--compose-ready-blue?logo=docker)](docker-compose.yml)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

> **OrbitCommerce** is a cloud-native, microservices-based e-commerce platform built for learning and demonstrating modern DevOps practices — from local development through to production Kubernetes with full CI/CD and observability.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Microservices](#-microservices)
- [Quick Start](#-quick-start)
- [API Reference](#-api-reference)
- [DevOps Phases](#-devops-phases)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌐 Overview

OrbitCommerce is a fully containerised, cloud-native e-commerce backend composed of five independent microservices. Each service owns its own database, exposes a RESTful API, and is independently deployable on Kubernetes. The platform ships with:

- **NGINX API Gateway** for routing, rate-limiting, and CORS
- **Jenkins + ArgoCD + GitHub Actions** for end-to-end CI/CD
- **Prometheus + Grafana** for metrics and dashboards
- **OpenTelemetry + Jaeger** for distributed tracing

---

## 🏗️ Architecture

```
                         ┌─────────────┐
                         │   Browser   │
                         └──────┬──────┘
                                │ :80
                     ┌──────────▼──────────┐
                     │   NGINX API Gateway  │
                     │  (Rate · CORS · LB)  │
                     └──┬──┬──┬──┬──┬──────┘
                        │  │  │  │  │
          ┌─────────────┘  │  │  │  └──────────────────┐
          │      ┌─────────┘  │  └─────────┐           │
          ▼      ▼            ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │  User    │ │ Product  │ │  Order   │ │ Payment  │ │Notification  │
   │ :8001    │ │ :8002    │ │ :8003    │ │ :8004    │ │ :8005        │
   └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘
        │            │            │             │              │
        └────────────┴────────────┴─────────────┴──────────────┘
                                  │
                       ┌──────────▼──────────┐
                       │   PostgreSQL :5432   │
                       │   (5 databases)      │
                       └─────────────────────┘

  ┌──────────────────────────────────────────────────┐
  │               Observability Stack                 │
  │  Prometheus :9090 · Grafana :3001 · Jaeger :16686 │
  └──────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer            | Technology                        |
|------------------|-----------------------------------|
| **Frontend**     | React 18                          |
| **Backend**      | FastAPI (Python 3.12)             |
| **Database**     | PostgreSQL 15                     |
| **Containerisation** | Docker + Docker Compose       |
| **Orchestration**| Kubernetes (K8s)                  |
| **API Gateway**  | NGINX 1.25                        |
| **CI/CD**        | Jenkins · ArgoCD · GitHub Actions |
| **Monitoring**   | Prometheus · Grafana              |
| **Tracing**      | OpenTelemetry · Jaeger            |

---

## 🔧 Microservices

| Service               | Port   | Description                        | Health Endpoint |
|-----------------------|--------|------------------------------------|-----------------|
| **User Service**      | `8001` | Authentication & user management   | `GET /health`   |
| **Product Service**   | `8002` | Product catalogue & inventory      | `GET /health`   |
| **Order Service**     | `8003` | Order processing & management      | `GET /health`   |
| **Payment Service**   | `8004` | Payment simulation & processing    | `GET /health`   |
| **Notification Service** | `8005` | Email/SMS alerts & notifications | `GET /health`   |

---

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 24 & Docker Compose v2
- [Git](https://git-scm.com/)

### Run with Docker Compose

```bash
# 1. Clone the repository
git clone https://github.com/saiveerateja2000/Orbit-Commerce.git
cd Orbit-Commerce

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your values (DB passwords, secret keys, etc.)

# 3. Build and start all services
docker compose up --build

# 4. Verify all services are healthy
curl http://localhost:8001/health   # User Service
curl http://localhost:8002/health   # Product Service
curl http://localhost:8003/health   # Order Service
curl http://localhost:8004/health   # Payment Service
curl http://localhost:8005/health   # Notification Service
```

All services are accessible through the NGINX gateway at **http://localhost:80**.

| UI / Tool      | URL                          |
|----------------|------------------------------|
| NGINX Gateway  | http://localhost:80          |
| Prometheus     | http://localhost:9090        |
| Grafana        | http://localhost:3001        |
| Jaeger UI      | http://localhost:16686       |

---

## 📡 API Reference

### User Service (`/api/users`) — port 8001

| Method | Endpoint               | Description              |
|--------|------------------------|--------------------------|
| `POST` | `/api/users/register`  | Register a new user      |
| `POST` | `/api/users/login`     | Authenticate & get token |
| `GET`  | `/api/users/me`        | Get current user profile |
| `GET`  | `/health`              | Service health check     |

```bash
# Register
curl -X POST http://localhost:8001/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret","name":"Alice"}'
```

### Product Service (`/api/products`) — port 8002

| Method   | Endpoint                | Description           |
|----------|-------------------------|-----------------------|
| `GET`    | `/api/products`         | List all products     |
| `GET`    | `/api/products/{id}`    | Get product by ID     |
| `POST`   | `/api/products`         | Create a product      |
| `PUT`    | `/api/products/{id}`    | Update a product      |
| `DELETE` | `/api/products/{id}`    | Delete a product      |

### Order Service (`/api/orders`) — port 8003

| Method | Endpoint             | Description          |
|--------|----------------------|----------------------|
| `GET`  | `/api/orders`        | List user orders     |
| `POST` | `/api/orders`        | Create a new order   |
| `GET`  | `/api/orders/{id}`   | Get order details    |
| `PUT`  | `/api/orders/{id}`   | Update order status  |

### Payment Service (`/api/payments`) — port 8004

| Method | Endpoint               | Description            |
|--------|------------------------|------------------------|
| `POST` | `/api/payments/charge` | Process a payment      |
| `GET`  | `/api/payments/{id}`   | Get payment status     |

### Notification Service (`/api/notifications`) — port 8005

| Method | Endpoint                  | Description              |
|--------|---------------------------|--------------------------|
| `POST` | `/api/notifications/send` | Send a notification      |
| `GET`  | `/api/notifications`      | List notifications       |

---

## ⚙️ DevOps Phases

The full operational guide is documented in [DEVOPS_GUIDE.md](DEVOPS_GUIDE.md). Here is a summary of the six phases:

| Phase | Title                        | Summary                                                         |
|-------|------------------------------|-----------------------------------------------------------------|
| **1** | Local Development Setup      | Run services locally with a bare PostgreSQL instance            |
| **2** | Dockerization                | Containerise every service; wire up with Docker Compose         |
| **3** | Kubernetes Deployment        | Deploy to K8s with namespaces, ConfigMaps, Secrets, and Ingress |
| **4** | CI/CD — Jenkins + ArgoCD     | Declarative pipelines; GitOps-style continuous deployment       |
| **5** | CI/CD — GitHub Actions       | Automated build, lint, test, and image push on every PR/push    |
| **6** | Monitoring & Observability   | Prometheus metrics, Grafana dashboards, Jaeger tracing          |

---

## 📁 Project Structure

```
Orbit-Commerce/
├── .env.example                  # Environment variable template
├── docker-compose.yml            # Local multi-service orchestration
├── README.md
├── DEVOPS_GUIDE.md               # Full DevOps operational guide
│
├── services/
│   ├── user-service/             # FastAPI — auth & user management
│   ├── product-service/          # FastAPI — product catalogue
│   ├── order-service/            # FastAPI — order processing
│   ├── payment-service/          # FastAPI — payment simulation
│   ├── notification-service/     # FastAPI — alerts & notifications
│   └── init-db.sql               # Database initialisation script
│
├── nginx/
│   ├── nginx.conf                # API gateway configuration
│   └── Dockerfile
│
├── frontend/                     # React 18 customer UI
│
├── k8s/                          # Kubernetes manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── nginx/
│   ├── postgres/
│   ├── user-service/
│   ├── product-service/
│   ├── order-service/
│   ├── payment-service/
│   ├── notification-service/
│   ├── monitoring/               # Prometheus & Grafana
│   └── tracing/                  # Jaeger
│
├── ci-cd/
│   ├── Jenkinsfile               # Jenkins declarative pipeline
│   └── argocd/                   # ArgoCD Application & Project
│
├── monitoring/
│   └── prometheus/
│       └── prometheus.yml
│
└── .github/
    └── workflows/
        └── ci.yml                # GitHub Actions CI workflow
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feat/your-feature`
3. **Commit** your changes: `git commit -m "feat: add your feature"`
4. **Push** to your fork: `git push origin feat/your-feature`
5. **Open** a Pull Request against `main`

Please ensure your code passes all CI checks before requesting a review.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">Built with ❤️ to demonstrate cloud-native DevOps practices</p>
