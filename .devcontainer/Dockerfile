FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        git-lfs \
        openssh-client \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Pin pnpm explicitly so local and CI container builds use the same version.
RUN npm install -g pnpm@10.12.4
