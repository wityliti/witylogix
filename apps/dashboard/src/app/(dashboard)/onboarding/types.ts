export enum OnboardingStep {
  VERIFY_EMAIL = "verify-email",
  CHOOSE_DEPLOYMENT = "choose-deployment",
  CONFIGURE_WORKSPACE = "configure-workspace",
}

export enum OnboardingSubStep {
  COMPANY_INFO = "company-info",
  INDUSTRY = "industry",
  GOALS = "goals",
  INTEGRATIONS = "integrations",
  DASHBOARD_LAYOUT = "dashboard-layout",
  DATA_IMPORT = "data-import",
  REVIEW = "review",
}

export enum Industry {
  ECOMMERCE = "ecommerce",
  FOOD_BEVERAGE = "food-beverage",
  HEALTHCARE = "healthcare",
  LOGISTICS = "logistics",
  FIELD_SERVICE = "field-service",
  MANUFACTURING = "manufacturing",
  COURIER = "courier",
  GROCERY = "grocery",
  CUSTOM = "custom",
}

export enum Goal {
  ROUTE_OPTIMIZATION = "route-optimization",
  FLEET_TRACKING = "fleet-tracking",
  LAST_MILE = "last-mile",
  MULTI_CARRIER = "multi-carrier",
  ORDER_MANAGEMENT = "order-management",
  NOTIFICATIONS = "notifications",
  ANALYTICS = "analytics",
  ERP_INTEGRATION = "erp-integration",
  DRIVER_MANAGEMENT = "driver-management",
  COMPLIANCE = "compliance",
}

export enum DeploymentType {
  CLOUD = "cloud",
  SELF_MANAGED = "self-managed",
}

export enum CompanySize {
  SMALL = "1-10",
  SMALL_MEDIUM = "11-50",
  MEDIUM = "51-200",
  MEDIUM_LARGE = "201-1000",
  LARGE = "1000+",
}

export interface OnboardingData {
  // Verify Email
  email: string;
  verificationCode: string;
  emailVerified: boolean;

  // Choose Deployment
  deploymentType: DeploymentType | null;

  // Company Info
  companyName: string;
  companyWebsite: string;
  companyLogo: string | null;
  companySize: CompanySize | null;
  phoneNumber: string;

  // Industry Selection
  industry: Industry | null;
  industryCustom: string;

  // Goals Selection
  goals: Goal[];

  // Integrations (placeholder for now)
  integrations: string[];

  // Dashboard Layout (placeholder)
  dashboardLayout: string;

  // Data Import (placeholder)
  dataImport: string;
}
