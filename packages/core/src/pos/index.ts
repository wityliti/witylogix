/**
 * POS Integration Module
 * Point-of-Sale integration for checkout, in-store pickup, and local delivery
 * Sprint 2.8
 */

// Export types
export type {
  PosProvider,
  PosDeliveryType,
  PosOrderStatus,
  PosConfigInput,
  PosOrderInput,
  PosLineItem,
  PosAddress,
  CustomFormField,
  PosFormInput,
  PosOrderStats,
  PosOrderListResponse,
  PosOrderFilters,
} from "./types";

// Export classes and functions
export { PosManager } from "./pos-manager";
export {
  createForm,
  getForm,
  listForms,
  updateForm,
  deleteForm,
  validateSubmission,
  getDefaultForm,
} from "./form-builder";
