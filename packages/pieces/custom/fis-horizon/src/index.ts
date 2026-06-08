import { createPiece, PieceAuth, Property } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { createCustomApiCallAction } from '@activepieces/pieces-common';

// Get Authorization Token
import { getAuthorizationToken } from './lib/actions/get-authorization-token';

// Search Customer Relationship Summary
import { searchCustomerRelationshipSummary } from './lib/actions/search-customer-relationship-summary';

// Account Aggregation
import {
  accountAggregationInquiry,
  accountAggregationGet,
  accountAggregationTransactions,
} from './lib/actions/account-aggregation';

// Account Restrictions
import {
  account_restrictions_holds_get,
  account_restrictions_holds_add,
  account_restrictions_holds_delete,
  account_restrictions_stops_get,
  account_restrictions_stops_add,
  account_restrictions_stops_delete,
  account_restrictions_restrictions_get,
  account_restrictions_restrictions_add,
  account_restrictions_restrictions_delete,
  account_restrictions_watch_get,
  account_restrictions_watch_add,
  account_restrictions_watch_delete,
  account_restrictions_credits_only_get,
  account_restrictions_credits_only_add,
  account_restrictions_credits_only_delete,
  account_restrictions_bank_float_get,
  account_restrictions_bank_float_add,
  account_restrictions_bank_float_delete,
  account_restrictions_customer_float_get,
  account_restrictions_customer_float_add,
  account_restrictions_customer_float_delete,
  account_restrictions_no_checks_get,
  account_restrictions_no_checks_add,
  account_restrictions_no_checks_delete,
} from './lib/actions/account-restrictions';

// Bank Controls
import {
  bank_controls_customer_id_personal_identifiers_list,
  bank_controls_demand_deposits_fee_table,
  bank_controls_demand_deposits_promotional_rates_detail,
  bank_controls_demand_deposits_promotional_codes_list,
  bank_controls_demand_deposits_product_types_detail,
  bank_controls_demand_deposits_product_types_list,
  bank_controls_demand_deposits_interest_types_detail,
  bank_controls_demand_deposits_interest_types_list,
  bank_controls_demand_deposits_service_charge_types_detail,
  bank_controls_demand_deposits_service_charge_types_list,
  bank_controls_savings_fee_table,
  bank_controls_savings_promotional_rates_detail,
  bank_controls_savings_promotional_codes_list,
  bank_controls_savings_product_types_detail,
  bank_controls_savings_product_types_list,
  bank_controls_savings_interest_types_detail,
  bank_controls_savings_interest_types_list,
  bank_controls_savings_service_charge_types_detail,
  bank_controls_savings_service_charge_types_list,
  bank_controls_loans_product_types_list,
  bank_controls_loans_product_types_detail,
  bank_controls_mortgage_loans_product_types_list,
  bank_controls_mortgage_loans_product_types_detail,
  bank_controls_ready_reserve_rate_types_detail,
  bank_controls_ready_reserve_rate_types_list,
  bank_controls_ready_reserve_product_types_detail,
  bank_controls_ready_reserve_product_types_list,
  bank_controls_safe_deposit_box_list,
  bank_controls_safe_deposit_box_discount_codes,
  bank_controls_time_deposits_service_charge_types_list,
  bank_controls_time_deposits_service_charge_types_detail,
  bank_controls_time_deposits_product_types_list,
  bank_controls_time_deposits_product_types_detail,
  bank_controls_time_deposits_penalty_types_list,
  bank_controls_time_deposits_penalty_types_detail,
  bank_controls_time_deposits_interest_types_list,
  bank_controls_time_deposits_interest_types_detail,
  bank_controls_cards_product_types_list,
  bank_controls_cards_product_types_detail,
  bank_controls_dynamic_transfer_controls,
  bank_controls_global_index_rates_list,
  bank_controls_global_index_rates_detail,
  bank_controls_global_rate_tiers_list,
  bank_controls_global_rate_tiers_detail,
  bank_controls_user_defined_field_descriptions,
  bank_controls_central_lookup_records,
  bank_controls_global_interest_rates,
  bank_controls_aggregation_descriptions_detail,
  bank_controls_aggregation_descriptions_list,
  bank_controls_account_number_generation,
  bank_controls_collateral_type_list,
  bank_controls_apy_calculation,
} from './lib/actions/bank-controls';

// Card
import {
  card_inquiry,
  card_inquiry_by_account,
  card_maintain,
  card_add,
  card_details_inquiry,
} from './lib/actions/card';

// Collateral
import {
  collateral_getCustomerCollateralList,
  collateral_addCollateral,
  collateral_addCollateralAccountRelationships,
  collateral_collateralAccountInquiry,
} from './lib/actions/collateral';

// Customer
import {
  customer_create,
  customer_portfolio_inquiry,
  customer_relationship_summary_search,
  customer_phones_inquiry,
  customer_phones_add,
  customer_phones_update,
  customer_phones_delete,
  customer_addresses_inquiry,
  customer_addresses_add,
  customer_addresses_update,
  customer_addresses_delete,
  customer_internet_addresses_inquiry,
  customer_internet_addresses_add,
  customer_due_diligence_non_personal_inquiry,
  customer_due_diligence_non_personal_add,
  customer_due_diligence_non_personal_update,
  customer_due_diligence_non_personal_delete,
  customer_due_diligence_personal_inquiry,
  customer_due_diligence_personal_add,
  customer_due_diligence_personal_update,
  customer_due_diligence_personal_delete,
  customer_account_relationships_add,
  customer_email_forms_inquiry,
  customer_dynamic_signature_create,
  customer_dynamic_fields_inquiry,
  customer_dynamic_inquiry,
  customer_relationship_summary_account_details_search,
} from './lib/actions/customer';

// Demand Deposit Savings
import {
  demand_deposit_savings_add_demand_deposit,
  demand_deposit_savings_add_savings,
  demand_deposit_savings_dynamic_signature,
  demand_deposit_savings_dynamic_fields,
  demand_deposit_savings_dynamic_inquiry,
} from './lib/actions/demand-deposit-savings';

// Loans
import { loans_add } from './lib/actions/loans';

// Mortgage Loan
import {
  mortgage_loan_add_mers_information,
  mortgage_loan_add_prepaid_insurance,
  mortgage_loan_add_loan_master_5001,
  mortgage_loan_add_loan_master_5002,
  mortgage_loan_add_arm_information,
  mortgage_loan_add_loan_master_5501,
  mortgage_loan_add_fhlb_information,
  mortgage_loan_add_buydown_schedule,
  mortgage_loan_add_hecm_disbursements,
  mortgage_loan_add_loan_master_5502,
  mortgage_loan_add_loan_master_5503,
  mortgage_loan_add_loan_master,
  mortgage_loan_add_prepaid_taxes,
  mortgage_loan_add_deferred_fees,
  mortgage_loan_add_disbursements,
  mortgage_loan_add_closing_fees,
  mortgage_loan_add_hecm_information,
  mortgage_loan_add_insurance,
  mortgage_loan_add_taxes,
  mortgage_loan_add_fha_va_information,
  mortgage_loan_account_inquiry,
  mortgage_loan_transaction_inquiry,
} from './lib/actions/mortgage-loan';

// Ready Reserve
import {
  ready_reserve_add_account,
  ready_reserve_account_inquiry,
  ready_reserve_transaction_inquiry,
} from './lib/actions/ready-reserve';

// Safe Deposit
import {
  safe_deposit_account_inquiry,
  safe_deposit_transaction_inquiry,
  safe_deposit_box_inquiry,
  safe_deposit_box_maintain,
  safe_deposit_box_add,
} from './lib/actions/safe-deposit';

// Time Deposit
import {
  time_deposit_account_inquiry,
  time_deposit_transaction_inquiry,
  time_deposit_renewal_inquiry,
  time_deposit_renewal_add,
  time_deposit_renewal_maintain,
  time_deposit_renewal_delete,
  time_deposit_certificate_add,
  time_deposit_certificate_add_staging,
  time_deposit_ira_add,
  time_deposit_ira_add_staging,
  time_deposit_ira_plan_add,
} from './lib/actions/time-deposit';

// Transactions
import {
  transactions_add,
  transactions_add_batch,
  transactions_add_memo,
  transactions_delete_memo,
} from './lib/actions/transactions';

// Transfers
import {
  transfers_automatic_transfer_inquiry_details,
  transfers_automatic_transfer_inquiry_list,
  transfers_automatic_transfer_add,
  transfers_automatic_transfer_change,
  transfers_automatic_transfer_delete,
  transfers_dynamic_transfer_inquiry,
  transfers_dynamic_transfer_add,
  transfers_dynamic_transfer_change,
  transfers_dynamic_transfer_delete,
  transfers_dynamic_transfer_search,
} from './lib/actions/transfers';

// User Security
import {
  user_security_template_inquiry,
  user_security_generate_user_id,
  user_security_search_users,
  user_security_create_user,
  user_security_user_inquiry,
  user_security_maintain_user,
  user_security_delete_user,
  user_security_enable_user,
  user_security_groups_inquiry,
  user_security_user_groups_inquiry,
  user_security_maintain_user_groups,
  user_security_group_inquiry,
  user_security_group_permissions_inquiry,
  user_security_change_password,
} from './lib/actions/user-security';

export const fisHorizonAuth = PieceAuth.CustomAuth({
  description: 'FIS Horizon API credentials',
  required: true,
  props: {
    baseUrl: Property.ShortText({
      displayName: 'Base URL',
      description: 'The base URL for the FIS Horizon API (e.g., https://api-gw-uat.fisglobal.com/rest/horizon)',
      required: true,
      defaultValue: 'https://api-gw-uat.fisglobal.com/rest/horizon',
    }),
    organizationId: Property.ShortText({
      displayName: 'Organization ID',
      description: 'Your FIS Organization ID (UUID format)',
      required: true,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'Your FIS Horizon user ID',
      required: true,
    }),
    userSecret: PieceAuth.SecretText({
      displayName: 'User Secret',
      description: 'Your FIS Horizon user secret/password',
      required: true,
    }),
  },
});

export const fisHorizon = createPiece({
  displayName: 'FIS Horizon',
  auth: fisHorizonAuth,
  minimumSupportedRelease: '0.20.0',
  logoUrl: 'https://s6.imgcdn.dev/Y1izHg.jpg',
  authors: ['vqnguyen1'],
  categories: [PieceCategory.BUSINESS_INTELLIGENCE],
  actions: [
    // Authentication
    getAuthorizationToken,
    searchCustomerRelationshipSummary,

    // Account Aggregation
    accountAggregationInquiry,
    accountAggregationGet,
    accountAggregationTransactions,

    // Account Restrictions
    account_restrictions_holds_get,
    account_restrictions_holds_add,
    account_restrictions_holds_delete,
    account_restrictions_stops_get,
    account_restrictions_stops_add,
    account_restrictions_stops_delete,
    account_restrictions_restrictions_get,
    account_restrictions_restrictions_add,
    account_restrictions_restrictions_delete,
    account_restrictions_watch_get,
    account_restrictions_watch_add,
    account_restrictions_watch_delete,
    account_restrictions_credits_only_get,
    account_restrictions_credits_only_add,
    account_restrictions_credits_only_delete,
    account_restrictions_bank_float_get,
    account_restrictions_bank_float_add,
    account_restrictions_bank_float_delete,
    account_restrictions_customer_float_get,
    account_restrictions_customer_float_add,
    account_restrictions_customer_float_delete,
    account_restrictions_no_checks_get,
    account_restrictions_no_checks_add,
    account_restrictions_no_checks_delete,

    // Bank Controls
    bank_controls_customer_id_personal_identifiers_list,
    bank_controls_demand_deposits_fee_table,
    bank_controls_demand_deposits_promotional_rates_detail,
    bank_controls_demand_deposits_promotional_codes_list,
    bank_controls_demand_deposits_product_types_detail,
    bank_controls_demand_deposits_product_types_list,
    bank_controls_demand_deposits_interest_types_detail,
    bank_controls_demand_deposits_interest_types_list,
    bank_controls_demand_deposits_service_charge_types_detail,
    bank_controls_demand_deposits_service_charge_types_list,
    bank_controls_savings_fee_table,
    bank_controls_savings_promotional_rates_detail,
    bank_controls_savings_promotional_codes_list,
    bank_controls_savings_product_types_detail,
    bank_controls_savings_product_types_list,
    bank_controls_savings_interest_types_detail,
    bank_controls_savings_interest_types_list,
    bank_controls_savings_service_charge_types_detail,
    bank_controls_savings_service_charge_types_list,
    bank_controls_loans_product_types_list,
    bank_controls_loans_product_types_detail,
    bank_controls_mortgage_loans_product_types_list,
    bank_controls_mortgage_loans_product_types_detail,
    bank_controls_ready_reserve_rate_types_detail,
    bank_controls_ready_reserve_rate_types_list,
    bank_controls_ready_reserve_product_types_detail,
    bank_controls_ready_reserve_product_types_list,
    bank_controls_safe_deposit_box_list,
    bank_controls_safe_deposit_box_discount_codes,
    bank_controls_time_deposits_service_charge_types_list,
    bank_controls_time_deposits_service_charge_types_detail,
    bank_controls_time_deposits_product_types_list,
    bank_controls_time_deposits_product_types_detail,
    bank_controls_time_deposits_penalty_types_list,
    bank_controls_time_deposits_penalty_types_detail,
    bank_controls_time_deposits_interest_types_list,
    bank_controls_time_deposits_interest_types_detail,
    bank_controls_cards_product_types_list,
    bank_controls_cards_product_types_detail,
    bank_controls_dynamic_transfer_controls,
    bank_controls_global_index_rates_list,
    bank_controls_global_index_rates_detail,
    bank_controls_global_rate_tiers_list,
    bank_controls_global_rate_tiers_detail,
    bank_controls_user_defined_field_descriptions,
    bank_controls_central_lookup_records,
    bank_controls_global_interest_rates,
    bank_controls_aggregation_descriptions_detail,
    bank_controls_aggregation_descriptions_list,
    bank_controls_account_number_generation,
    bank_controls_collateral_type_list,
    bank_controls_apy_calculation,

    // Card
    card_inquiry,
    card_inquiry_by_account,
    card_maintain,
    card_add,
    card_details_inquiry,

    // Collateral
    collateral_getCustomerCollateralList,
    collateral_addCollateral,
    collateral_addCollateralAccountRelationships,
    collateral_collateralAccountInquiry,

    // Customer
    customer_create,
    customer_portfolio_inquiry,
    customer_relationship_summary_search,
    customer_phones_inquiry,
    customer_phones_add,
    customer_phones_update,
    customer_phones_delete,
    customer_addresses_inquiry,
    customer_addresses_add,
    customer_addresses_update,
    customer_addresses_delete,
    customer_internet_addresses_inquiry,
    customer_internet_addresses_add,
    customer_due_diligence_non_personal_inquiry,
    customer_due_diligence_non_personal_add,
    customer_due_diligence_non_personal_update,
    customer_due_diligence_non_personal_delete,
    customer_due_diligence_personal_inquiry,
    customer_due_diligence_personal_add,
    customer_due_diligence_personal_update,
    customer_due_diligence_personal_delete,
    customer_account_relationships_add,
    customer_email_forms_inquiry,
    customer_dynamic_signature_create,
    customer_dynamic_fields_inquiry,
    customer_dynamic_inquiry,
    customer_relationship_summary_account_details_search,

    // Demand Deposit Savings
    demand_deposit_savings_add_demand_deposit,
    demand_deposit_savings_add_savings,
    demand_deposit_savings_dynamic_signature,
    demand_deposit_savings_dynamic_fields,
    demand_deposit_savings_dynamic_inquiry,

    // Loans
    loans_add,

    // Mortgage Loan
    mortgage_loan_add_mers_information,
    mortgage_loan_add_prepaid_insurance,
    mortgage_loan_add_loan_master_5001,
    mortgage_loan_add_loan_master_5002,
    mortgage_loan_add_arm_information,
    mortgage_loan_add_loan_master_5501,
    mortgage_loan_add_fhlb_information,
    mortgage_loan_add_buydown_schedule,
    mortgage_loan_add_hecm_disbursements,
    mortgage_loan_add_loan_master_5502,
    mortgage_loan_add_loan_master_5503,
    mortgage_loan_add_loan_master,
    mortgage_loan_add_prepaid_taxes,
    mortgage_loan_add_deferred_fees,
    mortgage_loan_add_disbursements,
    mortgage_loan_add_closing_fees,
    mortgage_loan_add_hecm_information,
    mortgage_loan_add_insurance,
    mortgage_loan_add_taxes,
    mortgage_loan_add_fha_va_information,
    mortgage_loan_account_inquiry,
    mortgage_loan_transaction_inquiry,

    // Ready Reserve
    ready_reserve_add_account,
    ready_reserve_account_inquiry,
    ready_reserve_transaction_inquiry,

    // Safe Deposit
    safe_deposit_account_inquiry,
    safe_deposit_transaction_inquiry,
    safe_deposit_box_inquiry,
    safe_deposit_box_maintain,
    safe_deposit_box_add,

    // Time Deposit
    time_deposit_account_inquiry,
    time_deposit_transaction_inquiry,
    time_deposit_renewal_inquiry,
    time_deposit_renewal_add,
    time_deposit_renewal_maintain,
    time_deposit_renewal_delete,
    time_deposit_certificate_add,
    time_deposit_certificate_add_staging,
    time_deposit_ira_add,
    time_deposit_ira_add_staging,
    time_deposit_ira_plan_add,

    // Transactions
    transactions_add,
    transactions_add_batch,
    transactions_add_memo,
    transactions_delete_memo,

    // Transfers
    transfers_automatic_transfer_inquiry_details,
    transfers_automatic_transfer_inquiry_list,
    transfers_automatic_transfer_add,
    transfers_automatic_transfer_change,
    transfers_automatic_transfer_delete,
    transfers_dynamic_transfer_inquiry,
    transfers_dynamic_transfer_add,
    transfers_dynamic_transfer_change,
    transfers_dynamic_transfer_delete,
    transfers_dynamic_transfer_search,

    // User Security
    user_security_template_inquiry,
    user_security_generate_user_id,
    user_security_search_users,
    user_security_create_user,
    user_security_user_inquiry,
    user_security_maintain_user,
    user_security_delete_user,
    user_security_enable_user,
    user_security_groups_inquiry,
    user_security_user_groups_inquiry,
    user_security_maintain_user_groups,
    user_security_group_inquiry,
    user_security_group_permissions_inquiry,
    user_security_change_password,

    // Custom API Call
    createCustomApiCallAction({
      baseUrl: (auth) => (auth as any).baseUrl || 'https://api-gw-uat.fisglobal.com/rest/horizon',
      auth: fisHorizonAuth,
      authMapping: async (auth) => {
        const organizationId = (auth as any).organizationId;
        const uuid = crypto.randomUUID();
        return {
          'organization-id': organizationId,
          'uuid': uuid,
        };
      },
    }),
  ],
  triggers: [],
});
