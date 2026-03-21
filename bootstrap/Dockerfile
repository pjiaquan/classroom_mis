FROM alpine:3.21

RUN apk add --no-cache bash curl jq postgresql-client

WORKDIR /app

COPY scripts/bootstrap_nocodb.sh /app/bootstrap_nocodb.sh

RUN chmod +x /app/bootstrap_nocodb.sh

ENTRYPOINT ["/app/bootstrap_nocodb.sh"]
