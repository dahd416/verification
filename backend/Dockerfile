# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/app/backend/pw-browsers

# Set work directory
WORKDIR /app/backend

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browser and its system dependencies
RUN playwright install --with-deps chromium

# Copy project
COPY . .

# Create persistent directories
RUN mkdir -p /app/backend/uploads /app/backend/generated_pdfs

# Declare persistent volumes — mount these in Easypanel to survive deployments
VOLUME ["/app/backend/uploads", "/app/backend/generated_pdfs"]

# Expose port
EXPOSE 80

# Command to run the application
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "80"]
