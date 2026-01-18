# Development Setup

<cite>
**Referenced Files in This Document**   
- [package.json](file://package.json)
- [README.md](file://README.md)
- [vite.config.ts](file://vite.config.ts)
- [tsconfig.json](file://tsconfig.json)
- [components/AiAssistant.tsx](file://components/AiAssistant.tsx)
- [.gitignore](file://.gitignore)
</cite>

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation Process](#installation-process)
3. [Environment Configuration](#environment-configuration)
4. [Running the Application](#running-the-application)
5. [TypeScript and Vite Configuration](#typescript-and-vite-configuration)
6. [Available npm Scripts](#available-npm-scripts)
7. [Troubleshooting Common Issues](#troubleshooting-common-issues)

## Prerequisites

Before setting up the development environment, ensure that Node.js is installed on your system. The application requires Node.js to manage dependencies and run the development server. You can verify your Node.js installation by running `node --version` in your terminal. If Node.js is not installed, download and install it from the official website (https://nodejs.org/). It is recommended to use a stable LTS (Long Term Support) version for development.

**Section sources**
- [README.md](file://README.md#L13)

## Installation Process

To install the project dependencies, navigate to the project root directory in your terminal and execute the following command:

```bash
npm install
```

This command reads the `package.json` file and installs all the required dependencies listed under the "dependencies" and "devDependencies" sections. The installation process may take a few minutes depending on your internet connection speed. Once completed, all necessary packages will be available in the `node_modules` directory.

The project relies on several key dependencies including React 19, Vite as the build tool, and the Google GenAI SDK for AI functionality. These are automatically installed during this process.

**Section sources**
- [package.json](file://package.json#L1-L25)
- [README.md](file://README.md#L16-L17)

## Environment Configuration

The application requires a Gemini API key for AI functionality. To configure this, create a `.env.local` file in the project root directory and add your API key using the following format:

```env
GEMINI_API_KEY=your_api_key_here
```

The Vite configuration (`vite.config.ts`) is set up to load environment variables from this file and make them available to the application through `process.env.GEMINI_API_KEY`. This configuration ensures that sensitive API keys are not exposed in the source code and can be easily managed across different environments.

The `.env.local` file is included in the `.gitignore` file, which prevents it from being committed to version control, ensuring your API key remains secure.

**Section sources**
- [vite.config.ts](file://vite.config.ts#L5-L16)
- [README.md](file://README.md#L18)
- [.gitignore](file://.gitignore#L13)

## Running the Application

Once the dependencies are installed and the environment is configured, you can start the development server by running:

```bash
npm run dev
```

This command executes the "dev" script defined in `package.json`, which starts the Vite development server. The application will be available at `http://localhost:3000` by default. The Vite server provides hot module replacement (HMR), which means that changes to your code will be instantly reflected in the browser without requiring a full page refresh.

The development server is configured to listen on all network interfaces (`host: '0.0.0.0'`) and port 3000, making it accessible from other devices on the same network if needed.

**Section sources**
- [package.json](file://package.json#L7)
- [vite.config.ts](file://vite.config.ts#L8-L11)
- [README.md](file://README.md#L19-L20)

## TypeScript and Vite Configuration

The project is configured with TypeScript and Vite to provide a robust development experience. The `tsconfig.json` file contains the TypeScript compiler options, including target ECMAScript version, module resolution, and path aliases. The configuration enables modern JavaScript features while maintaining compatibility with current browsers.

Vite is configured through `vite.config.ts` to use the React plugin and set up path aliases. The `@` alias is configured to point to the project root, allowing for cleaner import statements throughout the codebase. This configuration improves code maintainability and reduces the complexity of relative imports.

The TypeScript configuration also includes support for JSX syntax and defines the types that are available in the project, including Node.js types for server-side operations.

**Section sources**
- [tsconfig.json](file://tsconfig.json#L1-L28)
- [vite.config.ts](file://vite.config.ts#L17-L21)

## Available npm Scripts

The project provides several npm scripts through the `package.json` file to facilitate development:

- `npm run dev`: Starts the development server with hot reloading
- `npm run build`: Builds the application for production
- `npm run preview`: Locally previews the production build

These scripts are defined in the "scripts" section of `package.json` and leverage Vite's capabilities for fast development and optimized production builds. The build process generates static files in the `dist` directory, which can be deployed to any static hosting service.

**Section sources**
- [package.json](file://package.json#L6-L9)

## Troubleshooting Common Issues

### Missing Dependencies
If you encounter errors about missing modules, ensure that you have run `npm install` successfully. If the issue persists, try deleting the `node_modules` directory and `package-lock.json` file, then run `npm install` again to perform a clean installation.

### API Key Errors
If the AI features are not working, verify that the `.env.local` file exists in the project root and contains a valid `GEMINI_API_KEY`. Check the browser's developer console for any error messages related to API key validation. Ensure that the key has the necessary permissions enabled in the Google Cloud Console.

### Development Server Startup Problems
If the development server fails to start, check if port 3000 is already in use by another application. You can either stop the conflicting application or modify the port number in `vite.config.ts`. Also verify that Node.js is properly installed and that you have the necessary permissions to run scripts in the project directory.

The application's AI assistant component (`AiAssistant.tsx`) includes error handling that displays toast notifications when API calls fail, which can help diagnose connectivity or authentication issues.

**Section sources**
- [components/AiAssistant.tsx](file://components/AiAssistant.tsx#L26-L54)
- [vite.config.ts](file://vite.config.ts#L8-L11)
- [README.md](file://README.md#L13-L20)