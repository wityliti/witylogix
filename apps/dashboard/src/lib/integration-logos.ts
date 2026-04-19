/**
 * Integration catalog logos: curated Simple Icons (SVG) when available, else
 * DuckDuckGo favicon. Simple Icons (CC0): https://github.com/simple-icons/simple-icons
 *
 * Uses the {@code cdn.simpleicons.org} endpoint which returns the brand's
 * official hex colour baked into the SVG. The jsdelivr mirror ships
 * monochrome black SVGs intended to be coloured via CSS, which renders
 * invisible on the dark catalog chip.
 */

const SI = (slug: string) => `https://cdn.simpleicons.org/${slug}`

/**
 * Only brands with a verified Simple Icons asset in v11 (avoid broken first paint).
 */
const SIMPLE_ICON_SVG: Partial<Record<string, string>> = {
  mapbox: SI('mapbox'),
  'here-maps': SI('here'),
  osrm: SI('openstreetmap'),
  sap: SI('sap'),
  'dynamics-365': SI('dynamics365'),
  salesforce: SI('salesforce'),
  hubspot: SI('hubspot'),
  twilio: SI('twilio'),
  'firebase-fcm': SI('firebase'),
  'microsoft-crm': SI('microsoft'),
  odoo: SI('odoo'),
  quickbooks: SI('quickbooks'),
  sage: SI('sage'),
  xero: SI('xero'),
  stripe: SI('stripe'),
  paypal: SI('paypal'),
  adyen: SI('adyen'),
  braintree: SI('paypal'),
  mollie: SI('mollie'),
  shopify: SI('shopify'),
  woocommerce: SI('woocommerce'),
  magento: SI('magento'),
  'google-analytics': SI('googleanalytics'),
  mixpanel: SI('mixpanel'),
  amplitude: SI('amplitude'),
  segment: SI('segment'),
  hotjar: SI('hotjar'),
  looker: SI('looker'),
  mailgun: SI('mailgun'),
  'slack-api': SI('slack'),
  telegram: SI('telegram'),
  vonage: SI('vonage'),
  'whatsapp-biz': SI('whatsapp'),
  onesignal: SI('onesignal'),
  'sms-aws-sns': SI('amazonaws'),
  'marketing-mailchimp': SI('mailchimp'),
  'planning-asana': SI('asana'),
  'planning-notion': SI('notion'),
  'planning-clickup': SI('clickup'),
  'itsm-jira-service': SI('jira'),
  'itsm-zendesk': SI('zendesk'),
  box: SI('box'),
  'dropbox-business': SI('dropbox'),
  sharepoint: SI('microsoftsharepoint'),
  onedrive: SI('microsoftonedrive'),
  contentful: SI('contentful'),
  'comm-intercom': SI('intercom'),
  'comm-help-scout': SI('helpscout'),
  expensify: SI('expensify'),
  'zoho-crm': SI('zoho'),
  'bi-powerbi': SI('powerbi'),
  'bi-tableau': SI('tableau'),
  'fedex-api': SI('fedex'),
  'ups-api': SI('ups'),
  'marketing-marketo': SI('adobe'),
  'marketing-pardot': SI('salesforce'),
  concur: SI('sap'),
  'netsuite-fin': SI('oracle'),
  'stripe-acct': SI('stripe'),
  'authorize-net': SI('visa'),
  '2checkout': SI('paypal'),
  'warehouse-flexport': SI('fedex'),
  'procurement-ariba': SI('sap'),
  'hr-successfactors': SI('sap'),
  'compliance-secureframe': SI('okta')
}

const FAVICON_HOST: Record<string, string> = {
  'here-maps': 'here.com',
  'verizon-connect': 'verizon.com',
  'firebase-fcm': 'firebase.google.com',
  'whatsapp-biz': 'whatsapp.com',
  'sms-aws-sns': 'aws.amazon.com',
  'quickbooks': 'quickbooks.intuit.com',
  'dynamics-365': 'dynamics.microsoft.com',
  'microsoft-crm': 'microsoft.com',
  wave: 'waveapps.com',
  osrm: 'project-osrm.org',
  valhalla: 'valhalla.is',
  vroom: 'vroom.org',
  graphhopper: 'graphhopper.com',
  tomtom: 'tomtom.com',
  motive: 'gomotive.com',
  trimble: 'trimble.com',
  omnitracs: 'omnitracs.com',
  platformscience: 'platformscience.com',
  clearpathgps: 'clearpathgps.com',
  onestepgps: 'onestepgps.com',
  titangps: 'titangps.com',
  samsara: 'samsara.com',
  geotab: 'geotab.com',
  sendgrid: 'sendgrid.com',
  netsuite: 'netsuite.com',
  freshsales: 'freshworks.com',
  capsule: 'capsulecrm.com',
  'track-trace': 'aftership.com',
  'warehouse-3pl': 'flexport.com',
  'warehouse-checkrobot': 'checkrobot.com',
  'warehouse-agiliron': 'agiliron.com',
  'warehouse-flexport-api': 'flexport.com',
  'procurement-jaggr': 'jaggr.com',
  cin7: 'cin7.com',
  skubana: 'skubana.com',
  'certent': 'certent.com',
  '2checkout': 'verifone.com',
  'authorize-net': 'authorize.net',
  worldpay: 'worldpay.com',
  pushbullet: 'pushbullet.com',
  routific: 'routific.com',
  optimoroute: 'optimoroute.com',
  route4me: 'route4me.com',
  flespi: 'flespi.com',
  fleetio: 'fleetio.com',
  powerfleet: 'powerfleet.com',
  azuga: 'azuga.com',
  'itsm-servicenow': 'servicenow.com',
  'itsm-freshservice': 'freshworks.com',
  'comm-front': 'front.com',
  'comm-drift': 'drift.com',
  'comm-crisp': 'crisp.chat',
  'comm-gorgias': 'gorgias.com',
  'marketing-klaviyo': 'klaviyo.com',
  'marketing-activecampaign': 'activecampaign.com',
  'planning-monday': 'monday.com',
  'compliance-drata': 'drata.com',
  'compliance-vanta': 'vanta.com',
  'procurement-coupa': 'coupa.com',
  'procurement-tradeshift': 'tradeshift.com',
  'hr-workday': 'workday.com',
  'hr-bamboo': 'bamboohr.com',
  'workday-fin': 'workday.com',
  pipedrive: 'pipedrive.com',
  insightly: 'insightly.com',
  'nexmo-vonage': 'vonage.com',
  shipstation: 'shipstation.com',
  easypost: 'easypost.com',
  shippo: 'shippo.com',
  aftership: 'aftership.com',
  linnworks: 'linnworks.com',
  brightpearl: 'brightpearl.com',
  veeqo: 'veeqo.com',
  'bill-dot-com': 'bill.com',
  epicor: 'epicor.com',
  freshbooks: 'freshbooks.com',
  infor: 'infor.com',
  'warehouse-shipbob': 'shipbob.com',
  'netsuite-fin': 'netsuite.com'
}

export function faviconUrl (host: string): string {
  const h = host.replace(/^www\./, '')
  return `https://icons.duckduckgo.com/ip3/${h}.ico`
}

export function faviconHostForIntegration (integrationId: string): string {
  if (FAVICON_HOST[integrationId]) return FAVICON_HOST[integrationId]
  return `${integrationId.replace(/-/g, '')}.com`
}

/**
 * Logo URLs to try in order (use {@code onError} on {@code img} to advance).
 */
export function integrationLogoCandidates (integrationId: string): string[] {
  const fav = faviconUrl(faviconHostForIntegration(integrationId))
  const si = SIMPLE_ICON_SVG[integrationId]
  if (si) return [si, fav]
  return [fav]
}
