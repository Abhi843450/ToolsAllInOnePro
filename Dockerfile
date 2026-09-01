FROM python:3.12-slim

# Install Node.js 22 and ffmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ffmpeg && \
    curl -fsSL https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.gz | tar -xzf - -C /usr/local --strip-components=1 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN node --version && ffmpeg -version | head -1

WORKDIR /app

# Copy requirements first for Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . .

EXPOSE 10000

CMD ["gunicorn", "wsgi:app", "--workers", "2", "--threads", "4", "--timeout", "600", "--bind", "0.0.0.0:10000"]
