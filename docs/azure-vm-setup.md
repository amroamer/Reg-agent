# RegInspector — Azure VM Deployment Guide

## VM Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 vCPUs | 8 vCPUs |
| RAM | 16 GB | 32 GB |
| Disk | 100 GB SSD | 256 GB SSD |
| GPU | NVIDIA T4 (for Ollama) | NVIDIA A10 / V100 |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

**Recommended Azure VM sizes:**
- With GPU: `Standard_NC4as_T4_v3` (4 vCPUs, 28GB RAM, T4 GPU)
- CPU-only: `Standard_D8s_v5` (8 vCPUs, 32GB RAM) — uses Claude API only

## Step 1: Create Azure VM

```bash
# Via Azure CLI
az vm create \
  --resource-group myResourceGroup \
  --name reginspector-vm \
  --image Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest \
  --size Standard_NC4as_T4_v3 \
  --admin-username azureuser \
  --generate-ssh-keys \
  --os-disk-size-gb 256
```

## Step 2: Configure Network Security Group

Allow only these inbound ports:

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Your IP | SSH access |
| 80 | TCP | Any | HTTP (redirects to HTTPS) |
| 443 | TCP | Any | HTTPS (application) |

```bash
az network nsg rule create \
  --resource-group myResourceGroup \
  --nsg-name reginspector-vmNSG \
  --name AllowHTTPS \
  --priority 100 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --destination-port-ranges 80 443

# Block direct access to internal services (5432, 6379, 6333, 8000, 3000)
# These are only accessible within Docker's internal network.
```

## Step 3: Install Prerequisites

SSH into the VM:
```bash
ssh azureuser@<VM_IP>
```

Install Docker:
```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

Install NVIDIA drivers + Container Toolkit (GPU VMs only):
```bash
# NVIDIA drivers
sudo apt-get update
sudo apt-get install -y ubuntu-drivers-common
sudo ubuntu-drivers autoinstall
sudo reboot

# After reboot:
nvidia-smi  # verify GPU is detected

# NVIDIA Container Toolkit
distribution=$(. /etc/os-release; echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Verify GPU in Docker
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

## Step 4: Deploy RegInspector

```bash
# Clone the repository
git clone https://github.com/amroamer/Reg-agent.git
cd Reg-agent

# Make scripts executable
chmod +x scripts/*.sh

# Run the one-command deploy
./scripts/deploy.sh
```

The deploy script will:
1. Generate self-signed SSL certificates
2. Generate `.env.production` (prompts for your Anthropic API key)
3. Build all Docker images (~15 min first time, downloads 2.2GB embedding model)
4. Start all services
5. Initialize the database with admin user and topic taxonomy
6. Pull the Ollama model (if GPU available)
7. Run health checks

## Step 5: Verify

```bash
# Health check
curl -k https://localhost/api/health

# View logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Check all containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Open in browser: `https://<VM_IP>`

## Post-Deployment

### Change Admin Password
1. Login with `admin@reginspector.local` / `admin123!@#`
2. Change the password immediately

### Set Up Daily Backups
```bash
# Add to crontab
crontab -e

# Add this line (backup at 2 AM daily):
0 2 * * * /home/azureuser/Reg-agent/scripts/backup-db.sh >> /var/log/reginspector-backup.log 2>&1
```

### Monitor
```bash
# View real-time logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend worker

# Check disk usage
df -h
docker system df

# Check container resource usage
docker stats
```

### Update Application
```bash
cd Reg-agent
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --parallel
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Restore from Backup
```bash
./scripts/restore-db.sh backups/reginspector_YYYYMMDD_HHMMSS.sql.gz
```

## Architecture on Azure VM

```
Internet
    │
    ▼
[Azure NSG: 80, 443]
    │
    ▼
┌─────────────────────────────────────────────┐
│  Azure VM (Ubuntu 22.04 + Docker)           │
│                                             │
│  ┌─────────┐                                │
│  │  Nginx  │ :80 → :443 (HTTPS)            │
│  └────┬────┘                                │
│       │                                     │
│  ┌────▼────┐  ┌──────────┐  ┌────────────┐ │
│  │ Next.js │  │ FastAPI  │  │  Celery    │ │
│  │ :3000   │  │ :8000    │  │  Worker    │ │
│  └─────────┘  └────┬─────┘  └─────┬──────┘ │
│                    │              │         │
│  ┌────────┐  ┌─────▼──┐  ┌───────▼──────┐ │
│  │ Redis  │  │Postgres│  │   Qdrant     │ │
│  │ :6379  │  │ :5432  │  │   :6333      │ │
│  └────────┘  └────────┘  └──────────────┘ │
│                                             │
│  ┌──────────┐                               │
│  │  Ollama  │ (GPU)                         │
│  │  :11434  │                               │
│  └──────────┘                               │
└─────────────────────────────────────────────┘
```

All internal ports (5432, 6379, 6333, 8000, 3000, 11434) are only accessible within the Docker network. Only ports 80 and 443 are exposed to the internet via Nginx.
