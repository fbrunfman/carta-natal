# Carta natal, versión pública. La usa Render (y cualquier hosting que corra Docker).
# pyswisseph no trae ruedas precompiladas en PyPI: se compila en una etapa aparte para que la imagen final quede chica.
# Necesita g++ (trae partes en C++) además de gcc; g++ ya instala gcc y las cabeceras de libc.
FROM python:3.12-slim AS build
RUN apt-get update \
    && apt-get install -y --no-install-recommends g++ libc6-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CARTA_NATAL_PUBLIC=1
# la extensión compilada usa libstdc++ (ya viene en la imagen; esto solo lo asegura)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libstdc++6 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /install /usr/local
WORKDIR /app
COPY app.py astro.py limits.py presence.py store.py ./
COPY static ./static
# sin permisos de root; el hosting define PORT (por defecto 10000)
RUN useradd --system --uid 10001 --no-create-home app
USER app
EXPOSE 10000
CMD ["python", "app.py", "--public"]
