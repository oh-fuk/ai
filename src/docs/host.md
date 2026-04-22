# Hosting on Hostinger with a Subdomain

This guide will walk you through deploying your Next.js application to a Hostinger server on a subdomain. This process involves building the app locally, uploading the files, and configuring the server.

---

## Prerequisites

- A **Hostinger account** with a hosting plan that supports Node.js.
- A **registered domain name** connected to your Hostinger account.
- **Terminal/Command Line** access on your local computer.
- **Node.js** and **npm** installed on your local computer.

---

## Step 1: Build Your Next.js Project

Before uploading, you need to create a production-ready version of your application.

1.  **Install Dependencies**: If you haven't already, open your terminal in the project directory and run:
    ```bash
    npm install
    ```
2.  **Build the App**: Run the build command:
    ```bash
    npm run build
    ```
    This command compiles your application for production and creates a `.next` directory in your project root. This directory contains everything needed to run the app.

---

## Step 2: Prepare Files for Upload

You will need to upload your entire project folder, but you can exclude some development-specific files to save space.

- **Required Files/Folders for Upload**:
  - `.next` (This is the most important folder)
  - `public`
  - `package.json`
  - `next.config.ts` (or `next.config.js`)
  - Any other configuration files like `.env` if you use them for production.

- **Files to Exclude (Optional but Recommended)**:
  - `node_modules` (This will be reinstalled on the server)
  - `.git`
  - Any local development files.

You can create a `.zip` archive of the required files to make the upload process faster.

---

## Step 3: Set Up Subdomain on Hostinger

1.  Log in to your **Hostinger hPanel**.
2.  Navigate to the **"Domains"** section and click on **"Subdomains"**.
3.  Enter the name for your subdomain (e.g., `app` for `app.yourdomain.com`).
4.  The "Custom folder for subdomain" option will automatically be checked. You can leave the default folder name (e.g., `public_html/app`).
5.  Click **"Create"**.

---

## Step 4: Upload Your Project Files

1.  In hPanel, go to **"Files"** -> **"File Manager"**.
2.  Navigate to the folder created for your subdomain (e.g., `public_html/app`).
3.  Upload the `.zip` file containing your project and then extract it. Alternatively, upload the files and folders individually.

---

## Step 5: Configure Node.js on Hostinger

1.  In hPanel, go to **"Advanced"** -> **"Node.js"**.
2.  Click **"Create Application"**.
3.  - **Application startup file**: Enter `node_modules/.bin/next`.
    - **Application mode**: Set to `production`.
    - **Application location**: Should be the root of your subdomain folder (e.g., `/app`).
4.  Click **"Save"**.
5.  Once the application is created, **Stop** the application.
6.  Go to the **"Install npm dependencies"** section and click **"Install"**. This will install the production dependencies from your `package.json` on the server.
7.  After the installation is complete, **Start** the application again.

---

## Step 6: Configure Environment Variables

If your application requires environment variables (like `GEMINI_API_KEY`):

1.  In the Node.js section of hPanel for your application, find the **"Environment variables"** section.
2.  Click **"Add variable"**.
3.  Enter the **Key** (e.g., `GEMINI_API_KEY`) and the **Value**.
4.  Click **"Save"**.
5.  **Restart** your Node.js application from the hPanel for the changes to take effect.

---

## Step 7: Verify Your Deployment

Open your subdomain (e.g., `https://app.yourdomain.com`) in a web browser. Your AthenaAI StudyBuddy application should now be live!

If you encounter a "503 Service Unavailable" error, check the application logs in the Node.js section of hPanel for clues. It's often related to a missing dependency or an incorrect startup file path.
