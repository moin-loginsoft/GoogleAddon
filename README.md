# VMRay Report Phishing Google Add-on Deployment Guide

This repository contains the necessary components and instructions to deploy the VMRay Report Phishing Add-on for Gmail. This tool allows users to report suspicious emails directly to a VMRay Incident Response (IR) mailbox for automated analysis.

---

## Introduction

### Google Workspace Add-ons
Google Workspace Add-ons are customized applications that integrate with Google Workspace productivity apps. They allow organizations to extend the functionality of the Gmail interface, automate security workflows, and connect third-party services directly into the user’s inbox.

### About VMRay
VMRay is a premier provider of automated malware analysis and detection solutions. By leveraging advanced sandboxing and hypervisor-based monitoring, VMRay provides deep insights into sophisticated threats. This add-on streamlines the process of submitting potential threats from Gmail to the VMRay platform.

The VMRay Report Phishing Add-on allows users to:

-   Report suspicious emails with a single click
-   Forward original email content (including attachments) to a VMRay IR
    mailbox
-   Automatically move reported emails to a dedicated Gmail label
    (optional)

---

## Prerequisites

* **Google Workspace Administrator Account:** Required for project creation and domain-wide deployment.
* **VMRay IR Mailbox:** A designated email address to receive reported phishing attempts.

---

## Installation Steps

### Phase 1: Apps Script Configuration

1. Navigate to [script.google.com](https://script.google.com/home) and log in with your administrator account. 

![googlescripts_overview](images/new-project.png)

2. Select **New Project** and provide a descriptive name in project title (e.g., VMRay Phishing).

![googlescripts_overview](images/rename-project.png)

3. In the `Code.gs` file, replace the default content with the provided source code.
4. Modify the **CONFIG** parameters within the script:
    * **recipient:** Enter your VMRay IR mailbox address.
    * **moveToLabel:** Specify a Gmail label to move the email to after it is reported. Leave as an empty string (`""`) if you do not wish to move the email.

![googlescripts_overview](images/code-gs.png)

5. Click **Save**.
6. Select **Project Settings** (gear icon) from the left sidebar.
7. Check the box for **Show 'appsscript.json' manifest file in editor**.

![googlescripts_overview](images/show-appscript.png)

8. Return to the **Editor**, select `appsscript.json`, and update the file:
    * Ensure the `dependencies`, `oauthScopes`, and `addOns` sections are correctly populated.
    * You may update the `logoUrl` to a raw image link of your choice.

![googlescripts_overview](images/appsscript.png)

9. Click **Save**. You should now see **Gmail** listed under the Services section.

---

### Phase 2: Google Cloud Project Setup

1. Open a new tab and navigate to [console.cloud.google.com](https://console.cloud.google.com).
2. Open the **Project Picker** (top left) or use `Ctrl + O`.

![googlescripts_overview](images/select-domain.png)

3. Select your organization/domain.
4. Select **New Project**, enter a project name, and click **Create**.

![googlescripts_overview](images/create-project.png)

5. Ensure the new project is selected in the Project Picker.

![googlescripts_overview](images/select-new-project.png)

6. Navigate to **Menu > APIs & Services > OAuth consent screen**.

![googlescripts_overview](images/OAuthConsentScreen.png)

7. Click **Get Started**.
8. Select **Internal** for Audience.
9. Complete the **App Information** and **Contact Information** sections.
10. Agree to the terms and click **Continue**, then **Create**.

![googlescripts_overview](images/app-info.png)
![googlescripts_overview](images/audience.png)
![googlescripts_overview](images/contact-info.png)
![googlescripts_overview](images/finish.png)

11. Return to the **Google Cloud Dashboard** and copy the **Project Number**.

![googlescripts_overview](images/copy-project-number.png)


---

### Phase 3: Linking and Deployment

1. Return to the **Apps Script** tab (script.google.com).
2. In **Project Settings**, scroll to the **Google Cloud Platform (GCP) Project** section.
3. Click **Change Project** and enter the **Project Number** copied in the previous step.

![googlescripts_overview](images/set-project.png)

4. Click **Deploy > New Deployment**.

![googlescripts_overview](images/new-deployment.png)

5. Add a description and click **Deploy**.

![googlescripts_overview](images/new-deploy-description.png)

6. **Important:** Copy and save the **Deployment ID** for the next phase.

![googlescripts_overview](images/deploy-confirm.png)

---

### Phase 4: Marketplace SDK Configuration

1. In the Google Cloud Console, search for **Google Workspace Marketplace SDK** and click **Enable**.

![googlescripts_overview](images/marketplace-sdk-home.png)
![googlescripts_overview](images/marketplace-overview.png)


2. In the left panel, select **Library**. Search for **Gmail API** and click **Enable**.

![googlescripts_overview](images/select-gmail.png)

3. Return to the **Google Workspace Marketplace SDK** page and select **App Configuration**.

![googlescripts_overview](images/app-configuration.png)

4. Set visibility to **Private**.
5. Under **Installation Settings**, select your preferred method (e.g., **Admin-only install**).
6. Under **App Integrations**, select **Google Workspace Add-on**.
7. Paste the **Deployment ID** from Step 3.6 into the Apps Script field.

![googlescripts_overview](images/enter-deployment-id.png)

8. Under **OAuth Scopes**, manually add the following:
    * `https://www.googleapis.com/auth/gmail.addons.execute`
    * `https://www.googleapis.com/auth/gmail.modify`
    * `https://www.googleapis.com/auth/gmail.labels`
    * `https://www.googleapis.com/auth/gmail.send`
9. Complete the **Developer Information** section.

![googlescripts_overview](images/developer-info.png)

10. Click **Save Draft**.
11. Select the **Store Listing** tab. Provide the required details (as this is internal, you can fill these according to internal company standards).

![googlescripts_overview](images/store-listing-0.png)
![googlescripts_overview](images/store-listing-1.png)
![googlescripts_overview](images/store-listing-2.png)
![googlescripts_overview](images/store-listing-3.png)

12. Click **Save Draft** and then click **Publish**.

![googlescripts_overview](images/publish.png)


---

## Verification

To verify the installation:
1. Navigate to the [Google Workspace Marketplace](https://workspace.google.com/marketplace).

![googlescripts_overview](images/workspace-marketplace.png)

2. Click on **Internal Apps**.

![googlescripts_overview](images/addon-click.png)

3. The VMRay Report Phishing Add-on should be visible. Users within your domain will now see the VMRay icon in their Gmail side panel.

![googlescripts_overview](images/success-install.png)
![googlescripts_overview](images/confirm.png)



# Validation Checklist

-   Apps Script project created
-   Code.gs updated
-   appsscript.json configured
-   GCP project linked
-   Deployment created
-   Gmail API enabled
-   Marketplace SDK enabled
-   OAuth scopes added
-   App published internally

------------------------------------------------------------------------

VMRay Report Phishing Gmail Add-on\
Internal Deployment Guide\
Version 1.0
