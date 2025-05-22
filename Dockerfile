# Use an official Node runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Install necessary system utilities including radclient
RUN apk add --no-cache freeradius freeradius-utils

# Copy package.json and package-lock.json
COPY package*.json ./

# Install any needed packages
RUN npm install
RUN npm install -g nodemon

# Copy the rest of your application code
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Run the application
CMD ["npm", "run", "dev"]
