FROM node:22-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8002

WORKDIR /app

COPY --chown=node:node . .

# Let the first deployment create the owner with ADMIN_PASSWORD instead of
# shipping the local development account into the persistent volume.
RUN rm -f /app/data/users.json \
    && mkdir -p /app/assets/uploads \
    && chown -R node:node /app/data /app/assets/uploads

USER node

EXPOSE 8002

CMD ["node", "server.js"]
