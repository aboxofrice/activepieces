import { createPiece, PieceAuth, Property } from '@activepieces/pieces-framework';
import { PieceCategory } from '@activepieces/shared';
import { createCustomApiCallAction } from '@activepieces/pieces-common';

// Cards actions
import {
  cards_single_commit,
  cards_get_holds,
  cards_authenticate,
  cards_link_unlink,
  cards_update_personal_limits,
  cards_activate,
  cards_get_cardholders,
  cards_update_cardholder_address,
  cards_get_details,
  cards_reset_failure_counters,
  cards_generate_number,
  cards_update_primary_accounts,
  cards_get_multiple_accounts,
  cards_update_multiple_accounts,
  cards_add_multiple_accounts,
  cards_delete_multiple_accounts,
  cards_get_by_dda_account,
  cards_update_alert_preferences,
  cards_get_alert_preferences,
  cards_update_alert_contact_info,
  cards_get_alert_contact_info,
  cards_get_fraud_exclusion_codes,
  cards_delete_fraud_exclusion,
  cards_update_fraud_exclusion,
  cards_get_fraud_exclusion,
  cards_get_holds_v3,
  cards_update_negative_file,
  cards_get_negative_file,
  cards_update_negative_file_replace_card,
  cards_get_negative_file_replace_card,
  cards_negative_file_ivr,
  cards_change_pin_ivr,
  cards_validate_pin_ivr,
  cards_change_pin,
  cards_get_pin_info,
  cards_send_pin_reminder,
  cards_get_prefix_fee_info,
  cards_get_prefix_issuer_ids,
  cards_search,
  cards_prepaid_credit_adjustment,
  cards_prepaid_debit_adjustment,
  cards_dda_sav_transfer,
  cards_get_transaction_detail,
  cards_prepaid_load,
  cards_prepaid_unload,
  cards_get_transactions,
  cards_get_history_transactions,
  cards_get_pending_transactions,
  cards_ach_transfer,
  cards_get_history_transaction_detail,
} from './lib/actions/cards';

// Security actions
import {
  security_ping,
  security_change_racf_password,
  security_validate_racf_user,
} from './lib/actions/security';

// Bank Control actions
import {
  bank_control_get_branch_detail,
  bank_control_get_branch_info,
  bank_control_get_processing_date,
  bank_control_get_holiday_calendar,
  bank_control_get_gl_account,
  bank_control_get_institution_info,
  bank_control_get_officer,
  bank_control_get_product_codes,
  bank_control_get_transaction_codes,
  bank_control_get_routing_number,
} from './lib/actions/bank-control';

export const fisIbsCardsAuth = PieceAuth.CustomAuth({
  description: 'FIS IBS Cards API credentials',
  required: true,
  props: {
    baseUrl: Property.ShortText({
      displayName: 'Base URL',
      description: 'The base URL for the FIS IBS API (e.g., https://api-gw-uat.fisglobal.com/rest)',
      required: true,
      defaultValue: 'https://api-gw-uat.fisglobal.com/rest',
    }),
    organizationId: Property.ShortText({
      displayName: 'Organization ID',
      description: 'Your FIS Organization ID',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Source ID provided by FIS (e.g., APIGWY)',
      required: true,
      defaultValue: 'APIGWY',
    }),
    applicationId: Property.ShortText({
      displayName: 'Application ID',
      description: 'Application ID for your integration',
      required: true,
    }),
    ibsAuthorization: PieceAuth.SecretText({
      displayName: 'IBS Authorization',
      description: 'Authorization token for IBS APIs',
      required: true,
    }),
    securityTokenType: Property.StaticDropdown({
      displayName: 'Security Token Type',
      description: 'Type of security token being used',
      required: false,
      options: {
        options: [
          { label: 'JWT', value: 'JWT' },
          { label: 'SAML', value: 'SAML' },
          { label: 'OAuth', value: 'OAuth' },
        ],
      },
      defaultValue: 'JWT',
    }),
  },
});

export const fisIbsCards = createPiece({
  displayName: 'FIS IBS Cards',
  auth: fisIbsCardsAuth,
  minimumSupportedRelease: '0.20.0',
  logoUrl: 'https://s6.imgcdn.dev/Y1izHg.jpg',
  authors: ['vqnguyen1'],
  categories: [PieceCategory.BUSINESS_INTELLIGENCE],
  actions: [
    // Security & Authentication (3)
    security_ping,
    security_change_racf_password,
    security_validate_racf_user,

    // Bank Control (10)
    bank_control_get_branch_detail,
    bank_control_get_branch_info,
    bank_control_get_processing_date,
    bank_control_get_holiday_calendar,
    bank_control_get_gl_account,
    bank_control_get_institution_info,
    bank_control_get_officer,
    bank_control_get_product_codes,
    bank_control_get_transaction_codes,
    bank_control_get_routing_number,

    // Card Management (11)
    cards_single_commit,
    cards_get_holds,
    cards_authenticate,
    cards_link_unlink,
    cards_update_personal_limits,
    cards_activate,
    cards_get_cardholders,
    cards_update_cardholder_address,
    cards_get_details,
    cards_reset_failure_counters,
    cards_generate_number,

    // Account Management (6)
    cards_update_primary_accounts,
    cards_get_multiple_accounts,
    cards_update_multiple_accounts,
    cards_add_multiple_accounts,
    cards_delete_multiple_accounts,
    cards_get_by_dda_account,

    // Alerts (4)
    cards_update_alert_preferences,
    cards_get_alert_preferences,
    cards_update_alert_contact_info,
    cards_get_alert_contact_info,

    // Fraud (4)
    cards_get_fraud_exclusion_codes,
    cards_delete_fraud_exclusion,
    cards_update_fraud_exclusion,
    cards_get_fraud_exclusion,

    // Holds (1)
    cards_get_holds_v3,

    // Negative File (5)
    cards_update_negative_file,
    cards_get_negative_file,
    cards_update_negative_file_replace_card,
    cards_get_negative_file_replace_card,
    cards_negative_file_ivr,

    // PIN (5)
    cards_change_pin_ivr,
    cards_validate_pin_ivr,
    cards_change_pin,
    cards_get_pin_info,
    cards_send_pin_reminder,

    // Prefix (2)
    cards_get_prefix_fee_info,
    cards_get_prefix_issuer_ids,

    // Search (1)
    cards_search,

    // Transactions (11)
    cards_prepaid_credit_adjustment,
    cards_prepaid_debit_adjustment,
    cards_dda_sav_transfer,
    cards_get_transaction_detail,
    cards_prepaid_load,
    cards_prepaid_unload,
    cards_get_transactions,
    cards_get_history_transactions,
    cards_get_pending_transactions,
    cards_ach_transfer,
    cards_get_history_transaction_detail,

    // Custom API call for any other endpoints
    createCustomApiCallAction({
      baseUrl: (auth) => (auth as any).baseUrl || 'https://api-gw-uat.fisglobal.com/rest',
      auth: fisIbsCardsAuth,
      authMapping: async (auth) => {
        const authObj = auth as any;
        const uuid = crypto.randomUUID();
        const headers: Record<string, string> = {
          'organization-id': authObj.organizationId,
          'source-id': authObj.sourceId,
          'application-id': authObj.applicationId,
          'uuid': uuid,
          'ibs-authorization': authObj.ibsAuthorization,
        };
        if (authObj.securityTokenType) {
          headers['security-token-type'] = authObj.securityTokenType;
        }
        return headers;
      },
    }),
  ],
  triggers: [],
});
