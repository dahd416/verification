# Stage 1: Build the React application
FROM node:20-alpine as build-stage

WORKDIR /app/frontend

# Copy package files and install dependencies
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile --ignore-engines || npm install --legacy-peer-deps


# Copy all files and build
COPY . .
RUN npm run build

# Stage 2: Serve the React application with Nginx
FROM nginx:stable-alpine

# Copy custom nginx config if you have one, or use default
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build files from stage 1
COPY --from=build-stage /app/frontend/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
