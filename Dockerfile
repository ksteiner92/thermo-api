# Use Node.js as the base image for building the app
FROM node:18-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to install dependencies
COPY package.json package-lock.json ./

# Install only the production dependencies initially
RUN npm install --production

# Install dev dependencies for build steps
RUN npm install

# Copy the entire project to the working directory
COPY . .

# Generate tsoa routes and compile TypeScript
RUN npm run build

# Remove dev dependencies to keep the final image slim
RUN npm prune --production

# Start a new stage from a clean Node.js image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy the built app and node_modules from the builder stage
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "dist/app.js"]
