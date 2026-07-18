targetScope = 'resourceGroup'

@description('Globally unique name for the production Azure Static Web App.')
param staticWebAppName string

@description('Azure region that serves the Static Web App.')
param location string = 'eastus2'

@description('Optional resource tags applied in addition to the workload and environment tags.')
param tags object = {}

resource staticWebApp 'Microsoft.Web/staticSites@2024-04-01' = {
  name: staticWebAppName
  location: location
  tags: union(tags, {
    workload: 'TwinkleTune'
    environment: 'production'
  })
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    allowConfigFileUpdates: true
    publicNetworkAccess: 'Enabled'
    stagingEnvironmentPolicy: 'Disabled'
  }
}

output staticWebAppId string = staticWebApp.id
output defaultHostname string = staticWebApp.properties.defaultHostname
output siteUrl string = 'https://${staticWebApp.properties.defaultHostname}'
