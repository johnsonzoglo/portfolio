FROM node:22-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8000

WORKDIR /app

COPY --chown=node:node . .

# Let the first deployment create the owner with ADMIN_PASSWORD instead of
# shipping the local development account into the persistent volume.
RUN rm -f /app/data/users.json \
    /app/data/customers.json \
    /app/data/orders.json \
    /app/data/audit.json \
    /app/data/analytics.json \
    /app/data/notifications.json \
    /app/data/support.json \
    /app/data/complaints.json \
    /app/data/reviews.json \
    && mkdir -p /app/assets/uploads /app/backups \
    && chown -R node:node /app/data /app/assets/uploads /app/backups

USER node

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
