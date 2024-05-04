+++
title = "How to Deploy a React App with Nginx using Docker with react-router-dom"
date = "2023-01-21T00:00:00+03:00"
author = "Berk Selvi"
authorTwitter = "berkslv" #do not include @
keywords = ["react","nginx","docker","deployment"] 
description = "Learn how to deploy a React app with Nginx using Docker in this step-by-step tutorial. This tutorial covers everything from creating a Dockerfile for your React app to using Docker Compose to ..." 
showFullContent = false
readingTime = true
+++

If you're looking to deploy a React app, there are several options available, including deploying it to a web server or using a containerization tool like Docker. In this tutorial, we'll show you how to deploy a React app with Nginx using Docker. Nginx is a popular open-source web server that is known for its high performance and low resource usage. We'll create a Dockerfile for our React app that uses Nginx to serve the app, and we'll also create an Nginx configuration file to tell Nginx how to serve the app. Finally, we'll build a Docker image of our app and run a Docker container to deploy the app.

# Prerequisites:

- A basic understanding of Docker
- A React app to deploy

# Step 1: Create a Dockerfile

The first step is to create a Dockerfile for our React app. This file will contain instructions on how to build a Docker image of our app. Here is an example Dockerfile for a React app with Nginx:

```Dockerfile
# Use an official Node runtime as a parent image
FROM node:19-alpine as build

# Set the working directory to /app
WORKDIR /app

# Copy the package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Build the React app
RUN npm run build

# Use an official Nginx runtime as a parent image
FROM nginx:1.21.0-alpine

# Copy the ngnix.conf to the container
COPY ngnix.conf /etc/nginx/conf.d/default.conf

# Copy the React app build files to the container
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80 for Nginx
EXPOSE 80

# Start Nginx when the container starts
CMD ["nginx", "-g", "daemon off;"]
```

This Dockerfile uses the official Node runtime as the parent image to install and build the React app. It then uses the official Nginx runtime as the parent image to serve the React app.

# Step 2: Create an Nginx configuration file

Next, we need to create an Nginx configuration file to tell Nginx how to serve our React app. Here is an example configuration file:

```conf
server {
  listen 80;
  server_name example.com;
  root /usr/share/nginx/html;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

__You must create this `nginx.conf` file in the same directory with Dockerfile.__ This configuration file sets up Nginx to listen on port 80 and serve the React app. The try_files directive tells Nginx to try serving the requested file, then the directory containing the file, and finally fall back to serving the index.html file if the requested file or directory doesn't exist.

# Step 3: Build the Docker image

With the Dockerfile and Nginx configuration file created, we can now build the Docker image. Navigate to the directory containing the Dockerfile and run the following command:

```bash
docker build -t my-react-app .
```

This command tells Docker to build an image using the Dockerfile in the current directory and tag it with the name my-react-app. The . at the end of the command tells Docker to use the current directory as the build context.

# Step 4: Run the Docker container

With the Docker image built, we can now run a container using the following command:

```bash
docker run -p 80:80 my-react-app
```

This command creates a container from the my-react-app Docker image and maps port 80 in the container to port 80 on the host machine. You can then access your React app by navigating to http://localhost in your web browser.

Congratulations, you have successfully deployed a React app with Nginx using Docker! You can now use this method to easily deploy your React apps to any server or hosting platform that supports Docker.

# Step 5: Use Docker Compose to deploy the app

If you prefer a more streamlined approach to deploying your app, you can use Docker Compose to manage your containers. Docker Compose is a tool that allows you to define and run multi-container Docker applications.

To use Docker Compose, you'll need to create a docker-compose.yml file in the root directory of your project. Here's an example docker-compose.yml file that you can use with the Dockerfile provided earlier:

```yaml
version: '3'

services:
  my-react-app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "80:80"
    volumes:
      - ./ngnix.conf:/etc/nginx/conf.d/default.conf
```

In this docker-compose.yml file, we define a single service named my-react-app. We specify the build context as the current directory (.), and the name of the Dockerfile as Dockerfile. We also map port 80 in the container to port 80 on the host machine using the ports configuration.

Finally, we mount a volume that maps the ngnix.conf file on the host machine to the default.conf file in the container's Nginx configuration directory. This allows us to customize the Nginx configuration without having to rebuild the Docker image.

To use this docker-compose.yml file, simply navigate to the directory containing the file and run the following command:

```bash

docker-compose up -d

```

This command tells Docker Compose to build the my-react-app service using the Dockerfile and run a container. The -d flag runs the container in detached mode, which means that it runs in the background. You can then access your React app by navigating to http://localhost in your web browser.

Congratulations! You have successfully deployed a React app with Nginx using Docker and Docker Compose. You can now easily deploy your React apps to any server or hosting platform that supports Docker.

---

## Conclusion

Thank you for reading 🎉 Don't miss out on the latest updates and insights in the world of software development. Follow me on [@berkslv](https://x.com/berkslv) to stay connected and join the conversation