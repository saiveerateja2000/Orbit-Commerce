# OrbitCommerce DevOps Guide

A practical, step-by-step guide for setting up, deploying, and operating the OrbitCommerce e-commerce platform — from local development through to production Kubernetes with full CI/CD and observability.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Phase 1: Local Development Setup](#phase-1-local-development-setup)
- [Phase 2: Dockerization](#phase-2-dockerization)
- [Phase 3: Kubernetes Deployment](#phase-3-kubernetes-deployment)
- [Phase 4: CI/CD with Jenkins and ArgoCD](#phase-4-cicd-with-jenkins-and-argocd)
- [Phase 5: GitHub Actions CI/CD](#phase-5-github-actions-cicd)
- [Phase 6: Monitoring and Observability](#phase-6-monitoring-and-observability)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│               NGINX API Gateway  :80                         │
│         (Rate limiting · CORS · Load balancing)              │
└────┬────────────┬──────────┬──────────┬──────────┬───────────┘
     │            │          │          │          │
 Frontend   user-service  product-  order-   payment-  notification-
  :3000       :8001       service   service  service    service
                           :8002     :8003    :8004       :8005
                                       │
                              ┌────────┴─────────┐
                              │   PostgreSQL :5432│
                              │  (5 databases)    │
                              └───────────────────┘

Observability:  Jaeger :16686  ·  Prometheus :9090  ·  Grafana :3001
```

**Service summary:**

| Service | Language | Port | Description |
|---------|----------|------|-------------|
| user-service | FastAPI (Python 3.12) | 8001 | Auth, user management |
| product-service | FastAPI (Python 3.12) | 8002 | Product catalog |
| order-service | FastAPI (Python 3.12) | 8003 | Order management |
| payment-service | FastAPI (Python 3.12) | 8004 | Stripe payments |
| notification-service | FastAPI (Python 3.12) | 8005 | Email/SMS notifications |
| frontend | React 18 | 3000 | Customer-facing UI |
| nginx | nginx 1.25 | 80 | API gateway |

---

## Phase 1: Local Development Setup

Run each service individually against a local PostgreSQL instance. Ideal for rapid iteration and debugging without Docker overhead.

### 1.1 Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| Python | 3.11+ | [python.org](https://www.python.org/downloads/) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| PostgreSQL | 15+ | [postgresql.org](https://www.postgresql.org/download/) |
| Git | any | `apt install git` / [git-scm.com](https://git-scm.com/) |

Verify versions:

```bash
python3 --version   # Python 3.11.x or higher
node --version      # v18.x or higher
npm --version       # 9.x or higher
psql --version      # psql (PostgreSQL) 15.x
```

### 1.2 Clone and configure environment

```bash
git clone https://github.com/saiveerateja2000/Orbit-Commerce.git
cd Orbit-Commerce

# Copy the template and fill in values
cp .env.example .env
```

Open `.env` and fill in every value marked `replace_with_*`:

```bash
# Minimum required changes for local dev:
POSTGRES_PASSWORD=your_local_postgres_password
SECRET_KEY=a_random_64_char_string_for_jwt_signing_use_openssl_rand
ADMIN_KEY=a_secure_admin_api_key

# Set Jaeger to localhost (not the docker hostname) for local dev:
OTLP_ENDPOINT=http://localhost:4317

# Skip Stripe and SMTP for local dev — leave as placeholders
# unless you are testing payment or notification flows
```

Generate a strong `SECRET_KEY`:

```bash
openssl rand -hex 32
# Example output: a3f8c2e1b4d6f9a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6
```

### 1.3 Set up PostgreSQL databases

OrbitCommerce uses five isolated databases in a single PostgreSQL instance:

```bash
# Connect as postgres superuser
psql -U postgres

-- Create the shared application user
CREATE USER orbit WITH PASSWORD 'your_local_postgres_password';

-- Create the five service databases
CREATE DATABASE user_db;
CREATE DATABASE product_db;
CREATE DATABASE order_db;
CREATE DATABASE payment_db;
CREATE DATABASE notification_db;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE user_db TO orbit;
GRANT ALL PRIVILEGES ON DATABASE product_db TO orbit;
GRANT ALL PRIVILEGES ON DATABASE order_db TO orbit;
GRANT ALL PRIVILEGES ON DATABASE payment_db TO orbit;
GRANT ALL PRIVILEGES ON DATABASE notification_db TO orbit;

\q
```

### 1.4 Run a service with uvicorn

Each service follows the same pattern. Here is user-service as the example:

```bash
cd services/user-service

# Create an isolated virtual environment
python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# Export the variables this service needs
export DATABASE_URL="postgresql+asyncpg://orbit:your_local_postgres_password@localhost:5432/user_db"
export SECRET_KEY="$(grep SECRET_KEY ../../.env | cut -d= -f2)"
export ADMIN_KEY="$(grep ADMIN_KEY ../../.env | cut -d= -f2)"
export JWT_ALGORITHM=HS256
export JWT_EXPIRY_MINUTES=60
export LOG_LEVEL=info
export OTLP_ENDPOINT=http://localhost:4317

# Start the service (--reload enables hot-reload on file changes)
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Expected output:

```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
```

Repeat for each service, substituting the correct port and database:

| Service | Port | `DATABASE_URL` db name | Extra env vars |
|---------|------|------------------------|----------------|
| user-service | 8001 | `user_db` | `SECRET_KEY`, `JWT_*` |
| product-service | 8002 | `product_db` | — |
| order-service | 8003 | `order_db` | — |
| payment-service | 8004 | `payment_db` | `STRIPE_SECRET_KEY` |
| notification-service | 8005 | `notification_db` | `SMTP_*` |

### 1.5 Verify services with curl

```bash
# Health checks
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health
curl http://localhost:8005/health

# Expected response for each:
# {"status":"healthy"}

# Browse the auto-generated API docs:
open http://localhost:8001/docs   # Swagger UI for user-service
```

Register a user and retrieve a token:

```bash
# Register
curl -X POST http://localhost:8001/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","full_name":"Test User"}'

# Login to get a JWT
curl -X POST http://localhost:8001/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'

# Response includes: {"access_token":"eyJ...","token_type":"bearer"}
```

### 1.6 Run the React frontend

```bash
cd frontend
npm install

# Point the dev server at the local NGINX (or a running service)
export REACT_APP_API_BASE_URL=http://localhost/api
export REACT_APP_ENV=development

npm start
# Opens http://localhost:3000 in your browser
```

> **Tip:** The `package.json` sets `"proxy": "http://localhost:80"`, so API calls made without a full URL will be proxied to NGINX automatically during development.

---

## Phase 2: Dockerization

Run the entire stack with a single command using Docker Compose.

### 2.1 Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| Docker Engine | 24+ | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| Docker Compose | v2 (`docker compose`) | Bundled with Docker Desktop |

```bash
docker --version          # Docker version 24.x.x
docker compose version    # Docker Compose version v2.x.x
```

### 2.2 Dockerfile structure (multi-stage builds)

Every service uses a two-stage Dockerfile to produce lean production images:

```dockerfile
# ── Stage 1: builder ──────────────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

# ── Stage 2: runtime ──────────────────────────────────────────
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Runtime PostgreSQL driver only (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false appuser
COPY --from=builder /install /usr/local
COPY app/ ./app/
USER appuser
EXPOSE 8001
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

Benefits: build-time dependencies (gcc, libpq-dev) are discarded; the final image contains only the runtime, keeping images small and the attack surface minimal.

### 2.3 Build individual images

```bash
# Build a single service image
docker build -t orbit-commerce/user-service:latest ./services/user-service
docker build -t orbit-commerce/product-service:latest ./services/product-service
docker build -t orbit-commerce/order-service:latest ./services/order-service
docker build -t orbit-commerce/payment-service:latest ./services/payment-service
docker build -t orbit-commerce/notification-service:latest ./services/notification-service
docker build -t orbit-commerce/frontend:latest ./frontend

# Verify images were created
docker images | grep orbit-commerce
```

Expected output:

```
orbit-commerce/user-service          latest    a1b2c3d4e5f6   2 minutes ago   185MB
orbit-commerce/product-service       latest    b2c3d4e5f6a7   2 minutes ago   183MB
...
```

### 2.4 Run the full stack

```bash
# Ensure your .env file is populated (see Phase 1.2)
docker compose up --build
```

First run takes 3–5 minutes as all images are built. Subsequent starts are much faster.

To run in detached (background) mode:

```bash
docker compose up --build -d
```

### 2.5 Verify all services are running

```bash
docker compose ps
```

Expected output (all services should show `healthy`):

```
NAME                    IMAGE                              STATUS
orbit-postgres          postgres:15                        healthy
orbit-user-service      orbit-commerce/user-service        healthy
orbit-product-service   orbit-commerce/product-service     healthy
orbit-order-service     orbit-commerce/order-service       healthy
orbit-payment-service   orbit-commerce/payment-service     healthy
orbit-notification-svc  orbit-commerce/notification-svc    healthy
orbit-frontend          orbit-commerce/frontend            healthy
orbit-nginx             orbit-commerce/nginx               healthy
orbit-jaeger            jaegertracing/all-in-one           healthy
orbit-prometheus        prom/prometheus                    healthy
orbit-grafana           grafana/grafana                    healthy
```

If a container shows `starting` after 2 minutes, check its logs:

```bash
docker compose logs user-service --tail=50
```

### 2.6 Test the full stack via NGINX

```bash
# NGINX gateway health
curl http://localhost/health
# Expected: healthy

# User service through the gateway
curl http://localhost/api/users/health
# Expected: {"status":"healthy"}

# Product listing
curl http://localhost/api/products/

# Access the Swagger docs through the gateway
open http://localhost/api/users/docs
open http://localhost/api/products/docs
```

### 2.7 Access observability UIs

| Service | URL | Default credentials |
|---------|-----|---------------------|
| API Gateway | http://localhost:80 | — |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3001 | admin / value from `GRAFANA_ADMIN_PASSWORD` in `.env` |
| Jaeger | http://localhost:16686 | — |

### 2.8 Useful Docker Compose commands

```bash
# Follow logs for all services
docker compose logs -f

# Follow logs for a specific service
docker compose logs -f order-service

# Restart a single service without rebuilding
docker compose restart payment-service

# Rebuild and restart a single service
docker compose up -d --build user-service

# Scale a service (run 3 instances)
docker compose up -d --scale product-service=3

# Stop and remove containers (keep volumes)
docker compose down

# Stop and remove containers AND volumes (wipes database)
docker compose down -v

# Execute a command inside a running container
docker compose exec user-service bash

# View resource usage
docker stats
```

---

## Phase 3: Kubernetes Deployment

Deploy OrbitCommerce to a Kubernetes cluster for production-grade orchestration.

### 3.1 Prerequisites

| Tool | Install |
|------|---------|
| kubectl | [kubernetes.io/docs/tasks/tools](https://kubernetes.io/docs/tasks/tools/) |
| minikube (local) | [minikube.sigs.k8s.io](https://minikube.sigs.k8s.io/docs/start/) |
| Helm (optional) | [helm.sh/docs/intro/install](https://helm.sh/docs/intro/install/) |

```bash
kubectl version --client    # Client Version: v1.28.x
minikube version            # minikube version: v1.32.x
```

### 3.2 Set up minikube (local cluster)

```bash
# Start with enough resources for all services
minikube start --cpus=4 --memory=6g --disk-size=30g

# Verify the cluster is running
kubectl cluster-info
# Expected: Kubernetes control plane is running at https://192.168.49.2:8443

# Enable the ingress addon (needed for external access)
minikube addons enable ingress

# Enable the metrics server (needed for HPA)
minikube addons enable metrics-server
```

### 3.3 Build and load images into minikube

Instead of pushing to a remote registry, load images directly into minikube:

```bash
# Point your shell's Docker CLI to minikube's Docker daemon
eval $(minikube docker-env)

# Build all images inside minikube
docker build -t orbit-commerce/user-service:latest ./services/user-service
docker build -t orbit-commerce/product-service:latest ./services/product-service
docker build -t orbit-commerce/order-service:latest ./services/order-service
docker build -t orbit-commerce/payment-service:latest ./services/payment-service
docker build -t orbit-commerce/notification-service:latest ./services/notification-service
docker build -t orbit-commerce/frontend:latest ./frontend
docker build -t orbit-commerce/nginx:latest ./nginx

# Verify images are available inside minikube
docker images | grep orbit-commerce
```

> **For a remote cluster (EKS, GKE, AKS):** push images to a registry first.
>
> ```bash
> # Example: push to GitHub Container Registry
> docker tag orbit-commerce/user-service:latest ghcr.io/YOUR_ORG/user-service:latest
> docker push ghcr.io/YOUR_ORG/user-service:latest
> # Then update k8s/user-service/deployment.yaml with the new image path
> ```

### 3.4 Configure kubectl context

```bash
# minikube sets the context automatically; verify:
kubectl config current-context
# Expected: minikube

# For a remote cluster, set the context explicitly:
kubectl config use-context my-production-cluster
```

### 3.5 Create namespace and apply base resources

```bash
# 1. Create the namespace
kubectl apply -f k8s/namespace.yaml

# Verify
kubectl get namespace orbit-commerce
# NAME             STATUS   AGE
# orbit-commerce   Active   5s
```

### 3.6 Update secrets with real base64 values

The `k8s/secrets.yaml` contains placeholder base64 values. Replace them before applying:

```bash
# Encode your real values
echo -n 'your_strong_postgres_password' | base64
echo -n 'your_64_char_secret_key' | base64
echo -n 'your_admin_api_key' | base64
```

Edit `k8s/secrets.yaml` and replace the placeholder values with your encoded output, then:

```bash
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml

# Verify secrets were created (values are redacted)
kubectl get secret orbit-commerce-secrets -n orbit-commerce
```

> **Security note:** Never commit real secret values to Git. Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, Sealed Secrets) in production.

### 3.7 Deploy services step by step

```bash
# 2. Deploy PostgreSQL (StatefulSet with persistent volume)
kubectl apply -f k8s/postgres/postgres.yaml

# Wait for PostgreSQL to be ready before continuing
kubectl rollout status statefulset/postgres -n orbit-commerce
# Waiting for statefulset rolling update to complete...
# statefulset rolling update complete 1 pods...

# 3. Deploy each microservice
kubectl apply -f k8s/user-service/deployment.yaml
kubectl apply -f k8s/product-service/deployment.yaml
kubectl apply -f k8s/order-service/deployment.yaml
kubectl apply -f k8s/payment-service/deployment.yaml
kubectl apply -f k8s/notification-service/deployment.yaml

# 4. Deploy frontend and NGINX gateway
kubectl apply -f k8s/frontend/deployment.yaml
kubectl apply -f k8s/nginx/deployment.yaml

# 5. Deploy observability stack (if manifests exist)
kubectl apply -f k8s/monitoring/   # Prometheus, Grafana
kubectl apply -f k8s/tracing/      # Jaeger
```

### 3.8 Verify all deployments

```bash
# Check all pods in the namespace
kubectl get pods -n orbit-commerce

# Expected output (all pods Running):
# NAME                                    READY   STATUS    RESTARTS   AGE
# postgres-0                              1/1     Running   0          3m
# user-service-7d9b8c6f5-xp2kl            1/1     Running   0          2m
# user-service-7d9b8c6f5-r4qt9            1/1     Running   0          2m
# product-service-6b8f7d4c3-mn8jk         1/1     Running   0          2m
# ...

# Describe a pod for detailed information
kubectl describe pod -l app=user-service -n orbit-commerce

# View logs for a service
kubectl logs -l app=user-service -n orbit-commerce --tail=50

# Follow logs in real time
kubectl logs -l app=user-service -n orbit-commerce -f

# Check services
kubectl get services -n orbit-commerce

# Check deployments and their replica counts
kubectl get deployments -n orbit-commerce
```

### 3.9 Port forward for local testing

```bash
# Access user-service directly
kubectl port-forward svc/user-service 8001:8001 -n orbit-commerce &

# Access NGINX gateway
kubectl port-forward svc/nginx 8080:80 -n orbit-commerce &

# Test through the gateway
curl http://localhost:8080/health
curl http://localhost:8080/api/users/health

# Access Prometheus
kubectl port-forward svc/prometheus 9090:9090 -n orbit-commerce &
```

For persistent external access with minikube:

```bash
minikube service nginx -n orbit-commerce --url
# Returns: http://192.168.49.2:XXXXX
```

### 3.10 Scale deployments

```bash
# Scale user-service to 4 replicas
kubectl scale deployment user-service --replicas=4 -n orbit-commerce

# Verify pods scaled
kubectl get pods -l app=user-service -n orbit-commerce
# Shows 4 running pods

# Scale back down
kubectl scale deployment user-service --replicas=2 -n orbit-commerce
```

### 3.11 Perform a rolling update

```bash
# Update a service image (e.g., after building a new version)
kubectl set image deployment/user-service \
  user-service=orbit-commerce/user-service:v1.1.0 \
  -n orbit-commerce

# Watch the rollout progress
kubectl rollout status deployment/user-service -n orbit-commerce
# Waiting for deployment "user-service" rollout to finish...
# 1 out of 2 new replicas have been updated...
# 2 out of 2 new replicas have been updated...
# deployment "user-service" successfully rolled out

# Rollback if something goes wrong
kubectl rollout undo deployment/user-service -n orbit-commerce

# View rollout history
kubectl rollout history deployment/user-service -n orbit-commerce
```

---

## Phase 4: CI/CD with Jenkins and ArgoCD

Jenkins builds and tests code; ArgoCD handles GitOps-based deployment to Kubernetes.

### 4.1 Install Jenkins with Docker

```bash
# Create a persistent volume directory
mkdir -p ~/jenkins-data

# Run Jenkins
docker run -d \
  --name jenkins \
  --restart=on-failure \
  -p 8080:8080 -p 50000:50000 \
  -v ~/jenkins-data:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins/jenkins:lts

# Get the initial admin password
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open http://localhost:8080 and complete setup:

1. Enter the initial admin password
2. Choose **Install suggested plugins**
3. Create the first admin user
4. Set Jenkins URL to `http://localhost:8080`

### 4.2 Configure Jenkins

**Install required plugins** (Manage Jenkins → Plugins → Available):

- Docker Pipeline
- Kubernetes CLI
- GitHub Integration
- Credentials Binding
- Pipeline: Stage View

**Add credentials** (Manage Jenkins → Credentials → Global → Add Credential):

| ID | Type | Description |
|----|------|-------------|
| `docker-registry-credentials` | Username/Password | Container registry login |
| `argocd-auth-token` | Secret text | ArgoCD API token |
| `github-token` | Username/Password | GitHub PAT for webhooks |

**Create the pipeline:**

1. New Item → Pipeline → name it `orbit-commerce`
2. Under **Pipeline**, select **Pipeline script from SCM**
3. SCM: Git, Repository URL: your fork URL
4. Credentials: select `github-token`
5. Branch: `*/main`
6. Script Path: `ci-cd/Jenkinsfile`
7. Save

**Configure the Jenkinsfile parameters** by editing `ci-cd/Jenkinsfile`:

```groovy
parameters {
    string(name: 'DOCKER_REGISTRY', defaultValue: 'ghcr.io/YOUR_ORG', ...)
    string(name: 'IMAGE_TAG',       defaultValue: 'latest', ...)
    choice(name: 'DEPLOY_ENV',      choices: ['dev', 'staging', 'prod'], ...)
}
```

### 4.3 Install ArgoCD on Kubernetes

```bash
# Create the ArgoCD namespace and install
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl rollout status deployment/argocd-server -n argocd

# Get the initial admin password
kubectl get secret argocd-initial-admin-secret -n argocd \
  -o jsonpath="{.data.password}" | base64 -d; echo

# Access the ArgoCD UI
kubectl port-forward svc/argocd-server 8443:443 -n argocd &
open https://localhost:8443
# Login: admin / <password from above>
```

### 4.4 Configure ArgoCD application

```bash
# Apply the ArgoCD project first (defines RBAC and sync windows)
kubectl apply -f ci-cd/argocd/project.yaml

# Apply the application (points ArgoCD at k8s/ in this repo)
kubectl apply -f ci-cd/argocd/application.yaml
```

Verify in the ArgoCD UI at https://localhost:8443:
- Application `orbit-commerce` should appear
- Status should transition to **Synced** and **Healthy**

**Generate a CI deployer token** for Jenkins:

```bash
# Install the ArgoCD CLI
curl -sSL -o argocd \
  https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x argocd && sudo mv argocd /usr/local/bin

# Log in
argocd login localhost:8443 --username admin --insecure

# Create a token scoped to the ci-deployer role
argocd proj role create-token orbit-commerce ci-deployer
# Copy the token and add it to Jenkins as 'argocd-auth-token' credential
```

### 4.5 Set up GitHub webhooks for Jenkins

1. In your GitHub repository: **Settings → Webhooks → Add webhook**
2. **Payload URL:** `http://YOUR_JENKINS_URL/github-webhook/`
3. **Content type:** `application/json`
4. **Events:** select **Just the push event**
5. Save

In Jenkins, enable the webhook trigger on the `orbit-commerce` pipeline:
- Configure pipeline → Build Triggers → check **GitHub hook trigger for GITScm polling**

### 4.6 Full pipeline walkthrough

```
Developer pushes to main branch
          │
          ▼
  GitHub webhook fires
          │
          ▼
  Jenkins pipeline starts
  ├── Stage: Test (parallel, all 5 services)
  │     └── pytest + coverage report
  ├── Stage: Build Docker Images (parallel, 6 components)
  │     └── docker build with IMAGE_TAG + short SHA
  ├── Stage: Push Docker Images
  │     └── docker push to registry
  └── Stage: Deploy via ArgoCD
        ├── argocd app set orbit-commerce --helm-set global.imageTag=<SHA>
        ├── argocd app sync --prune --timeout 300
        └── argocd app wait --health
          │
          ▼
  ArgoCD detects k8s/ manifest changes
  ├── Applies updated Deployments
  ├── Kubernetes performs rolling update (maxUnavailable=0)
  └── Health checks confirm pods are ready
          │
          ▼
  Jenkins post-action notifies notification-service
  with build status (success or failure)
```

---

## Phase 5: GitHub Actions CI/CD

The `.github/workflows/ci.yml` pipeline runs automatically on every push and pull request.

### 5.1 Pipeline stages

```
Push / PR
    │
    ▼
┌─────────────────────────────────────┐
│ lint  (matrix: all 5 services)      │
│  Python 3.12 · flake8               │
│  max-line-length=120                │
└─────────────────────────────────────┘
    │ (on success)
    ▼
┌─────────────────────────────────────┐
│ test  (matrix: all 5 services)      │
│  PostgreSQL 15 service container    │
│  pytest + coverage XML + JUnit      │
│  Artifacts uploaded for each run    │
└─────────────────────────────────────┘
    │ (on success)
    ▼
┌─────────────────────────────────────┐
│ build  (matrix: 6 components)       │
│  Docker Buildx with layer cache     │
│  Tags: sha-<SHORT_SHA> + latest     │
│  Push to ghcr.io  (main only)       │
└─────────────────────────────────────┘
    │ (on success)
    ▼
┌─────────────────────────────────────┐
│ security-scan  (matrix: 6 images)   │
│  Trivy: CRITICAL + HIGH severity    │
│  SARIF → GitHub Security tab        │
└─────────────────────────────────────┘
```

### 5.2 Required GitHub secrets

Navigate to **Repository → Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value | Used by |
|-------------|-------|---------|
| `GITHUB_TOKEN` | Auto-provided by GitHub | GHCR push, SARIF upload |

> The `GITHUB_TOKEN` is automatically available to all workflows — no manual setup needed. The workflow uses `github.repository_owner` to construct the registry path: `ghcr.io/<owner>/<image>`.

### 5.3 Pull request workflow

On every pull request:

- **lint** and **test** jobs run against the PR branch
- **build** job runs but does **not** push images (push only triggers on `main`)
- Test coverage and JUnit results are uploaded as artifacts
- Security scan results appear in the **Security** tab of the repository

To view test artifacts: **Actions → <run> → Artifacts → test-results-<service>**

### 5.4 Publish images to GitHub Container Registry

Images are published automatically on every push to `main`. To pull them locally:

```bash
# Authenticate with GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Pull a published image
docker pull ghcr.io/YOUR_ORG/user-service:latest
docker pull ghcr.io/YOUR_ORG/user-service:sha-a1b2c3d

# Update k8s/user-service/deployment.yaml to use the new image:
# image: ghcr.io/YOUR_ORG/user-service:sha-a1b2c3d
```

To make packages public (so no auth is needed to pull):
**GitHub → Packages → <image> → Package settings → Visibility → Public**

---

## Phase 6: Monitoring and Observability

### 6.1 Prometheus

Prometheus scrapes metrics from all services every 15 seconds. The configuration lives in `monitoring/prometheus/prometheus.yml`.

Access Prometheus: http://localhost:9090 (Docker Compose) or port-forward in K8s.

**Useful PromQL queries:**

```promql
# Request rate per service (requests per second)
rate(http_requests_total[5m])

# Error rate (5xx responses)
rate(http_requests_total{status=~"5.."}[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active database connections
asyncpg_connections_active

# Check all scrape targets are up
up
```

**Verify scrape targets:** http://localhost:9090/targets — all services should show **State: UP**.

### 6.2 Grafana dashboards

Access Grafana: http://localhost:3001 (Docker Compose) — log in with `admin` / `GRAFANA_ADMIN_PASSWORD` from `.env`.

**Add Prometheus as a data source:**

1. **Configuration → Data Sources → Add data source**
2. Select **Prometheus**
3. URL: `http://prometheus:9090` (Docker Compose) or `http://prometheus.orbit-commerce.svc.cluster.local:9090` (K8s)
4. Click **Save & Test** — should show "Data source is working"

**Import a pre-built dashboard:**

1. **Dashboards → Import**
2. Enter dashboard ID `1860` (Node Exporter Full) or `7587` (FastAPI dashboard)
3. Select the Prometheus data source
4. Click **Import**

**Create a custom microservices dashboard:**

1. **Dashboards → New → New Dashboard → Add visualization**
2. Select Prometheus as data source
3. Add panels with these queries:

```promql
# Panel 1: Request rate by service
sum by (job) (rate(http_requests_total[1m]))

# Panel 2: Error rate
sum by (job) (rate(http_requests_total{status=~"5.."}[1m]))

# Panel 3: P95 latency
histogram_quantile(0.95,
  sum by (job, le) (rate(http_request_duration_seconds_bucket[5m])))
```

### 6.3 Jaeger distributed tracing

Access Jaeger: http://localhost:16686

All services emit OpenTelemetry traces via gRPC to `jaeger:4317` (configured via `OTLP_ENDPOINT` in `.env`).

**Trace an order flow:**

1. Open http://localhost:16686
2. In the **Service** dropdown, select `order-service`
3. Click **Find Traces**
4. Click any trace to see the full span tree across services

**To trace a specific request:**

```bash
# Make a request and note the trace ID from the response header
curl -v http://localhost/api/orders/ 2>&1 | grep -i x-trace
# x-trace-id: abc123def456

# Search for that trace ID in Jaeger
```

### 6.4 Create Prometheus alerting rules

Add alert rules to `monitoring/prometheus/prometheus.yml`:

```yaml
rule_files:
  - "alerts.yml"
```

Create `monitoring/prometheus/alerts.yml`:

```yaml
groups:
  - name: orbit-commerce
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "{{ $labels.job }} has been unreachable for more than 1 minute."

      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m])
          / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on {{ $labels.job }}"
          description: "Error rate is {{ $value | humanizePercentage }} over the last 5 minutes."

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency on {{ $labels.job }}"
          description: "P95 latency is {{ $value }}s on {{ $labels.job }}."
```

Reload Prometheus after changes:

```bash
# Docker Compose
docker compose restart prometheus

# Kubernetes
kubectl rollout restart deployment/prometheus -n orbit-commerce
```

---

## Troubleshooting

### Container / Docker issues

**Problem:** Service container stays in `starting` state

```bash
# Check logs for startup errors
docker compose logs user-service --tail=100

# Common causes:
# - DATABASE_URL not set or wrong password
# - PostgreSQL not healthy yet (service starts before db is ready)
# - Missing required env variable

# Fix: ensure .env is populated; check depends_on health checks
docker compose ps postgres  # must show "healthy"
```

**Problem:** `docker compose up` fails with "port already in use"

```bash
# Find what is using the port
sudo lsof -i :8001
sudo lsof -i :80

# Kill the process or change the port mapping in docker-compose.yml
# e.g., change "80:80" to "8888:80"
```

**Problem:** Services can't connect to PostgreSQL

```bash
# Verify PostgreSQL is listening
docker compose exec postgres psql -U orbit -d user_db -c "SELECT 1;"

# Check if DATABASE_URL in .env matches the credentials
# Format: postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DB_NAME
# For Docker Compose, HOST must be "postgres" (the service name)
```

### Kubernetes issues

**Problem:** Pods stuck in `Pending` state

```bash
kubectl describe pod <pod-name> -n orbit-commerce
# Look for Events section at the bottom
# Common: "Insufficient cpu" or "Insufficient memory"

# Increase minikube resources
minikube stop
minikube start --cpus=4 --memory=6g
```

**Problem:** Pods stuck in `ImagePullBackOff`

```bash
kubectl describe pod <pod-name> -n orbit-commerce
# Look for: Failed to pull image "orbit-commerce/user-service:latest"

# If using minikube, images must be built inside minikube's Docker:
eval $(minikube docker-env)
docker build -t orbit-commerce/user-service:latest ./services/user-service

# Also set imagePullPolicy: Never in deployment.yaml for local images
```

**Problem:** `CrashLoopBackOff` after deployment

```bash
# Check logs from the crashing container
kubectl logs <pod-name> -n orbit-commerce --previous

# Common causes:
# - Secret values incorrect (wrong base64 encoding)
# - Service can't reach PostgreSQL (check postgres pod is Ready)
# - Missing ConfigMap key referenced by the pod

# Re-encode a secret value correctly:
echo -n 'actual_value_without_newline' | base64
#                  ^ -n flag removes trailing newline — essential for base64!
```

**Problem:** `kubectl apply` returns "namespace not found"

```bash
# Always apply the namespace first
kubectl apply -f k8s/namespace.yaml
# Then apply other resources
```

### CI/CD issues

**Problem:** GitHub Actions build fails with "permission denied" pushing to GHCR

```yaml
# Ensure your workflow has the correct permissions block:
permissions:
  contents: read
  packages: write

# Also verify the repository is not set to private packages by default
```

**Problem:** Jenkins pipeline fails at "Push Docker Images" stage

```bash
# Verify the docker-registry-credentials are set correctly in Jenkins:
# Manage Jenkins → Credentials → Global → docker-registry-credentials
# Username: your registry username
# Password: personal access token (not your account password)

# Test manually on the Jenkins host:
docker login ghcr.io -u YOUR_USERNAME -p YOUR_TOKEN
```

**Problem:** ArgoCD application stuck in `OutOfSync`

```bash
# Force a manual sync
argocd app sync orbit-commerce --force

# If resources are stuck due to finalizers:
argocd app terminate-op orbit-commerce

# Check for resource diffs
argocd app diff orbit-commerce
```

### Service-level issues

**Problem:** JWT authentication failing across services

```bash
# All services must share the same SECRET_KEY value
# Verify in Docker Compose:
docker compose exec user-service env | grep SECRET_KEY
docker compose exec order-service env | grep SECRET_KEY
# Both must match

# In Kubernetes:
kubectl get secret orbit-commerce-secrets -n orbit-commerce -o yaml
# Decode and verify: echo "BASE64_VALUE" | base64 -d
```

**Problem:** Payment service returns 500 for webhook validation

```bash
# The STRIPE_WEBHOOK_SECRET must match the one configured in Stripe Dashboard
# Stripe → Developers → Webhooks → your endpoint → Signing secret
# Update .env and restart: docker compose restart payment-service
```

**Problem:** Notification emails not sent

```bash
# Check notification service logs
docker compose logs notification-service

# Test SMTP connectivity from inside the container
docker compose exec notification-service \
  python3 -c "import smtplib; s=smtplib.SMTP('$SMTP_HOST', $SMTP_PORT); s.starttls(); print('SMTP OK')"

# Common fixes:
# - SMTP_PORT 587 requires STARTTLS; port 465 requires SSL
# - Gmail requires an App Password, not your account password
# - Check your SMTP provider's "less secure apps" or API key settings
```

### Prometheus / Grafana issues

**Problem:** Prometheus shows targets as "DOWN"

```bash
# Verify services expose /metrics endpoint
curl http://localhost:8001/metrics

# Check Prometheus scrape config
docker compose exec prometheus cat /etc/prometheus/prometheus.yml

# Reload without restart
curl -X POST http://localhost:9090/-/reload
```

**Problem:** Grafana shows "No data" in panels

```bash
# 1. Confirm Prometheus data source URL is correct
#    Docker Compose: http://prometheus:9090
#    Kubernetes: http://prometheus.orbit-commerce.svc.cluster.local:9090

# 2. Check the time range (top-right corner) — set to "Last 1 hour"

# 3. Test query directly in Prometheus first at http://localhost:9090
```

---

## Quick Reference

### Useful one-liners

```bash
# Check all service health endpoints at once
for port in 8001 8002 8003 8004 8005; do
  echo -n "Port $port: "; curl -sf http://localhost:$port/health || echo "FAILED"
done

# Watch pod status in real time
watch -n 2 kubectl get pods -n orbit-commerce

# Get all K8s events (sorted by time)
kubectl get events -n orbit-commerce --sort-by='.lastTimestamp'

# Delete and recreate a deployment (force fresh pull)
kubectl rollout restart deployment/user-service -n orbit-commerce

# List all images running in the cluster
kubectl get pods -n orbit-commerce \
  -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}' | sort -u

# Encode a string for use in K8s secrets
echo -n 'my_secret_value' | base64

# Decode a K8s secret
kubectl get secret orbit-commerce-secrets -n orbit-commerce \
  -o jsonpath='{.data.SECRET_KEY}' | base64 -d
```

### Reference links

| Resource | URL |
|----------|-----|
| FastAPI documentation | https://fastapi.tiangolo.com |
| Docker Compose reference | https://docs.docker.com/compose/reference |
| Kubernetes documentation | https://kubernetes.io/docs/home |
| kubectl cheat sheet | https://kubernetes.io/docs/reference/kubectl/cheatsheet |
| ArgoCD documentation | https://argo-cd.readthedocs.io |
| Jenkins pipeline syntax | https://www.jenkins.io/doc/book/pipeline/syntax |
| GitHub Actions reference | https://docs.github.com/en/actions |
| Prometheus querying | https://prometheus.io/docs/prometheus/latest/querying/basics |
| Grafana dashboards | https://grafana.com/grafana/dashboards |
| Jaeger documentation | https://www.jaegertracing.io/docs |
| OpenTelemetry Python | https://opentelemetry-python.readthedocs.io |
| Stripe testing | https://stripe.com/docs/testing |
