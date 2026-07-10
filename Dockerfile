FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY server.py .
COPY static/ static/

# Create persistent data directories
RUN mkdir -p /data/news_archive /data/daily_reports /data/knowledge_db /data/essay_knowledge_db /data/pdf_uploads /data/pdf_questions /data/topics /data/morning_cards /data/essay_images

# Copy existing data (question banks, news, reports, topics, morning cards)
COPY data/pdf_questions/ /data/pdf_questions/
COPY data/news_archive/ /data/news_archive/
COPY data/daily_reports/ /data/daily_reports/
COPY data/topics/ /data/topics/
COPY data/morning_cards/ /data/morning_cards/
COPY essay_vault/ essay_vault/

# Environment variables
ENV DATA_DIR=/data
ENV PORT=7860
ENV FLASK_DEBUG=0

# Expose port
EXPOSE 7860

# Start with gunicorn
CMD ["gunicorn", "server:app", "--bind", "0.0.0.0:7860", "--timeout", "240", "--workers", "2"]
