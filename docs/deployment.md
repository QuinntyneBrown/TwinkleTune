# Azure deployment

TwinkleTune deploys one tested static artifact to Azure Static Web Apps:

- `/` contains the marketing brochure from `marketing/`.
- `/app` contains the production Vite build from `frontend/apps/game/dist/`.
- The .NET 10 family server is built and tested by CI, but it is not hosted by this Static Web Apps resource. The public app therefore keeps its offline-first behavior; multiplayer and shared family data still require a separately hosted family server.

The production resource is `twinkletune-web` in the `twinkletune-rg` resource group. Its public URL is [https://twinkletune.app](https://twinkletune.app); the Azure-generated hostname is [https://zealous-meadow-0adef640f.7.azurestaticapps.net](https://zealous-meadow-0adef640f.7.azurestaticapps.net).

Pull requests and pushes to `main` run backend tests, frontend tests/build, browser E2E, and the full-stack duet E2E suite. Only a green push to `main` can enter the `production` GitHub Environment. The deploy job downloads the exact `site-<commit SHA>` artifact produced by CI, verifies its checksum manifest, uploads it without rebuilding, then smoke-tests `/` and `/app` on Azure.

## Provision Azure

Prerequisites: an Azure subscription, a current Azure CLI with Bicep support, and admin access to the GitHub repository. Static Web App names are globally unique.

From PowerShell at the repository root:

```powershell
az login

$resourceGroup = 'twinkletune-rg'
$staticWebAppName = 'twinkletune-web'
$resourceGroupLocation = 'canadacentral'
$staticWebAppLocation = 'eastus2'

az group create --name $resourceGroup --location $resourceGroupLocation
az deployment group create `
  --resource-group $resourceGroup `
  --template-file infra/main.bicep `
  --parameters staticWebAppName=$staticWebAppName location=$staticWebAppLocation
```

The template creates a public Free-tier Static Web App and disables preview environments. GitHub Actions remains the only deployment path configured by this repository.

## Configure GitHub

1. In **Settings → Environments**, create an environment named exactly `production`. Restrict deployment branches to `main`; optionally add required reviewers.
2. Read the Static Web Apps deployment token without committing it:

   ```powershell
   $deploymentToken = az staticwebapp secrets list `
     --name $staticWebAppName `
     --resource-group $resourceGroup `
     --query 'properties.apiKey' `
     --output tsv
   ```

3. Add `AZURE_STATIC_WEB_APPS_API_TOKEN` as an **environment secret** on `production`, not as a repository secret. With GitHub CLI, this can be done without printing the token:

   ```powershell
   $deploymentToken | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --env production
   $deploymentToken = $null
   ```

4. Push to `main` and watch **Actions → CI and Azure Static Web Apps deployment**. The deployment URL is attached to the `production` environment and both public routes are checked after upload.

If the token is exposed, reset the deployment token in Azure immediately and replace the GitHub environment secret. Keep the action references pinned to full commit SHAs; update them through a reviewed dependency change.
