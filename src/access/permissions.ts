export const PERMISSIONS = [
  // Admin section
  "admin.analytics.view",
  "admin.alerts.view",
  "admin.expenses.view",
  "admin.authUsers.manage",
  "admin.access.manage",
  "admin.resellers.manage",
  "admin.resellers.fund",

  // Users section
  "users.view",
  "users.online.view",

  // Radius settings section
  "radius.settings.view",
  "radius.nas.view",
  "radius.profiles.view",

  // Billing section
  "billing.invoiceUpload.create",
  "billing.externalInvoices.view",
  "billing.externalInvoices.viewTotals",
  "billing.externalInvoices.pay",
  "billing.externalInvoices.unpay",
  "billing.collections.view",

  // Dashboard widgets
  "dashboard.widget.totalAmount",
  "dashboard.widget.invoiceCounts",

  // Reseller portal
  "reseller.portal.access",
  "reseller.balance.view",
  "reseller.users.view",
  "reseller.users.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

