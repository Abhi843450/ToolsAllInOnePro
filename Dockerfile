FROM python:3.12-slim

# Install Node.js 22 and ffmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ffmpeg && \
    curl -fsSL https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.gz | tar -xzf - -C /usr/local --strip-components=1 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN node --version && ffmpeg -version | head -1

# Clone and build bgutil-ytdlp-pot-provider server
RUN git clone --single-branch --branch 1.3.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil-ytdlp-pot-provider && \
    cd /opt/bgutil-ytdlp-pot-provider/server && \
    npm ci --prefer-offline && \
    npx tsc && \
    rm -rf /opt/bgutil-ytdlp-pot-provider/.git /opt/bgutil-ytdlp-pot-provider/server/src

WORKDIR /app

# Copy requirements first for Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . .

# Create temp download directory
RUN mkdir -p /tmp/toolsallinone/downloads

EXPOSE 10000

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

CMD ["gunicorn", "wsgi:app", "--workers", "1", "--threads", "4", "--timeout", "120", "--graceful-timeout", "30", "--keep-alive", "5", "--bind", "0.0.0.0:10000"]
