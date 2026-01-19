import { createAction, Property } from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisIbsAuth } from '../..';

// Helper function to build headers
function buildHeaders(auth: any, ibsAuthorization?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'organization-id': auth.organizationId,
    'source-id': auth.sourceId,
    'application-id': auth.applicationId,
    'uuid': crypto.randomUUID(),
    'ibs-authorization': ibsAuthorization || auth.ibsAuthorization,
  };
  if (auth.securityTokenType) {
    headers['security-token-type'] = auth.securityTokenType;
  }
  return headers;
}

// ============================================
// IBS-Information-Security.json - Security & Authentication
// ============================================

export const security_ping = createAction({
  auth: fisIbsAuth,
  name: 'security_ping',
  displayName: 'Security - Ping Host System',
  description: 'Perform ping of host system to determine if connection is valid',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${auth.baseUrl}/IBSSZ/v4/ping`,
      headers,
    });
    return response.body;
  },
});

export const security_change_racf_password = createAction({
  auth: fisIbsAuth,
  name: 'security_change_racf_password',
  displayName: 'Security - Change RACF Password',
  description: 'Change password for current user ID within FIS RACF security environment',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    newPassword: Property.ShortText({
      displayName: 'New Password',
      description: 'The new RACF password (14-98 characters)',
      required: true,
    }),
    applID: Property.ShortText({
      displayName: 'Application ID',
      description: 'RACF-defined application ID (optional)',
      required: false,
    }),
    termID: Property.ShortText({
      displayName: 'Terminal ID',
      description: 'RACF-defined terminal ID (optional)',
      required: false,
    }),
    altRoutID: Property.ShortText({
      displayName: 'Alternate Routing ID',
      description: 'Alternate routing ID (optional)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const body: Record<string, any> = {
      racfPassword: {
        newPwd: context.propsValue.newPassword,
      },
    };

    if (context.propsValue.applID) {
      body['racfPassword']['applID'] = context.propsValue.applID;
    }
    if (context.propsValue.termID) {
      body['racfPassword']['termID'] = context.propsValue.termID;
    }
    if (context.propsValue.altRoutID) {
      body['racfPassword']['altRoutID'] = context.propsValue.altRoutID;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${auth.baseUrl}/IBSSZ/v4/racf-password`,
      headers,
      body,
    });
    return response.body;
  },
});

export const security_validate_racf_user = createAction({
  auth: fisIbsAuth,
  name: 'security_validate_racf_user',
  displayName: 'Security - Validate RACF User',
  description: 'Validate user within FIS RACF security environment',
  props: {
    ibsAuthorization: Property.ShortText({
      displayName: 'IBS Authorization',
      description: 'IBS Authorization token (if different from connection)',
      required: false,
    }),
    altRoutId: Property.ShortText({
      displayName: 'Alternate Routing ID',
      description: 'Alternate routing ID for system routing (optional)',
      required: false,
    }),
    aceSysId: Property.StaticDropdown({
      displayName: 'ACE System ID',
      description: 'Which ACE system to perform the transaction',
      required: false,
      options: {
        options: [
          { label: 'TEST - Test System', value: 'TEST' },
          { label: 'PROD - Production System', value: 'PROD' },
        ],
      },
    }),
    currentPassword: Property.ShortText({
      displayName: 'Current Password',
      description: 'The user\'s current password',
      required: false,
    }),
    termID: Property.ShortText({
      displayName: 'Terminal ID',
      description: 'RACF-defined terminal ID (optional)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const headers = buildHeaders(auth, context.propsValue.ibsAuthorization);

    const params = new URLSearchParams();
    if (context.propsValue.altRoutId) params.append('altRoutId', context.propsValue.altRoutId);
    if (context.propsValue.aceSysId) params.append('aceSysId', context.propsValue.aceSysId);
    if (context.propsValue.currentPassword) params.append('curPswrd', context.propsValue.currentPassword);
    if (context.propsValue.termID) params.append('termID', context.propsValue.termID);

    const queryString = params.toString();
    const url = `${auth.baseUrl}/IBSSZ/v4/racf-user${queryString ? '?' + queryString : ''}`;

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url,
      headers,
    });
    return response.body;
  },
});
