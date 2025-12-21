//// filepath: Dockerfile
# Use official Node LTS image
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
# copy backend only (split-deploy)
COPY Backend/ ./Backend
WORKDIR /app/Backend
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "index.js"]