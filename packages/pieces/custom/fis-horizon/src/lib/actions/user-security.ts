import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

/**
 * User Security - Template Inquiry
 * GET /users/templates
 * Retrieve a list of user profile templates
 */
export const user_security_template_inquiry = createAction({
  name: 'user_security_template_inquiry',
  auth: fisHorizonAuth,
  displayName: 'User Security - Template Inquiry',
  description: 'Retrieve a list of user profile templates',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/user-security/v1/users/templates`,
      headers,
    });

    return response.body;
  },
});

/**
 * User Security - Generate User ID
 * GET /users/generate-user-id
 * Generate a user id and return a user template
 */
export const user_security_generate_user_id = createAction({
  name: 'user_security_generate_user_id',
  auth: fisHorizonAuth,
  displayName: 'User Security - Generate User ID',
  description: 'Generate a user id and return a user template',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    firstName: Property.ShortText({
      displayName: 'First Name',
      description: 'First name of the user (max 15 characters)',
      required: true,
    }),
    lastName: Property.ShortText({
      displayName: 'Last Name',
      description: 'Last name of the user (max 15 characters)',
      required: true,
    }),
    templateUserId: Property.ShortText({
      displayName: 'Template User ID',
      description: 'Template user profile to base the new user on (max 10 characters)',
      required: true,
    }),
    middleInitial: Property.ShortText({
      displayName: 'Middle Initial',
      description: 'Optional: Middle initial (max 1 character)',
      required: false,
    }),
    employeeNumber: Property.ShortText({
      displayName: 'Employee Number',
      description: 'Optional: Employee identification number (max 10 characters)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, firstName, lastName, templateUserId, middleInitial, employeeNumber } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: Record<string, string> = {
      firstName: firstName,
      lastName: lastName,
      templateUserId: templateUserId,
    }
    if (middleInitial) {
      queryParams['middleInitial'] = middleInitial;
    }
    if (employeeNumber) {
      queryParams['employeeNumber'] = employeeNumber;
    }

    const queryString = '?' + new URLSearchParams(queryParams).toString();

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/user-security/v1/users/generate-user-id${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * User Security - Search Users
 * GET /users
 * Retrieve a list of existing users using filters
 */
export const user_security_search_users = createAction({
  name: 'user_security_search_users',
  auth: fisHorizonAuth,
  displayName: 'User Security - Search Users',
  description: 'Retrieve a list of existing users using filters. Wildcard (*) is permitted for userId, firstName, and lastName.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'Optional: Filter by userId (wildcard * permitted, max 10 characters)',
      required: false,
    }),
    firstName: Property.ShortText({
      displayName: 'First Name',
      description: 'Optional: Filter by first name (wildcard * permitted, max 15 characters)',
      required: false,
    }),
    lastName: Property.ShortText({
      displayName: 'Last Name',
      description: 'Optional: Filter by last name (wildcard * permitted, max 15 characters)',
      required: false,
    }),
    bankNumber: Property.Number({
      displayName: 'Bank Number',
      description: 'Optional: Filter by bank number (max 3 digits)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, userId, firstName, lastName, bankNumber } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: Record<string, string> = {};
    if (userId) {
      queryParams['userId'] = userId;
    }
    if (firstName) {
      queryParams['firstName'] = firstName;
    }
    if (lastName) {
      queryParams['lastName'] = lastName;
    }
    if (bankNumber !== undefined && bankNumber !== null) {
      queryParams['bankNumber'] = String(bankNumber);
    }

    const queryString = Object.keys(queryParams).length > 0
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/user-security/v1/users${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * User Security - Create User
 * POST /users
 * Create a user profile (orchestrated call to finalize HORIZON profile and IBMi profile)
 */
export const user_security_create_user = createAction({
  name: 'user_security_create_user',
  auth: fisHorizonAuth,
  displayName: 'User Security - Create User',
  description: 'Create a user profile. This is an orchestrated call to finalize HORIZON profile and IBMi profile.',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    generalInformation: Property.Json({
      displayName: 'General Information',
      description: 'General information object containing userId, userName, firstName, middleInitial, lastName, employeeNumber, templateUserId, etc.',
      required: true,
    }),
    accessControls: Property.Json({
      displayName: 'Access Controls',
      description: 'Access controls object containing settings like bankControl, primaryGroupCode, etc.',
      required: true,
    }),
    defaultBankNumber: Property.ShortText({
      displayName: 'Default Bank Number',
      description: 'Default bank number (max 3 characters)',
      required: true,
    }),
    defaultBranchNumber: Property.ShortText({
      displayName: 'Default Branch Number',
      description: 'Default branch number (max 4 characters)',
      required: true,
    }),
    bankAssignment: Property.Json({
      displayName: 'Bank Assignment',
      description: 'Optional: Bank assignment object',
      required: false,
    }),
    contactInformation: Property.Json({
      displayName: 'Contact Information',
      description: 'Optional: Contact information object containing emailAddress, phone, etc.',
      required: false,
    }),
    secondarySecurityGroups: Property.Json({
      displayName: 'Secondary Security Groups',
      description: 'Optional: Array of secondary security groups',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, generalInformation, accessControls, defaultBankNumber, defaultBranchNumber, bankAssignment, contactInformation, secondarySecurityGroups } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const body: Record<string, unknown> = {
      generalInformation: generalInformation,
      accessControls: accessControls,
      defaultBankNumber: defaultBankNumber,
      defaultBranchNumber: defaultBranchNumber,
    };

    if (bankAssignment) {
      body['bankAssignment'] = bankAssignment;
    }
    if (contactInformation) {
      body['contactInformation'] = contactInformation;
    }
    if (secondarySecurityGroups) {
      body['secondarySecurityGroups'] = secondarySecurityGroups;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/user-security/v1/users`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * User Security - User Inquiry
 * GET /users/{userId}
 * Retrieve a user profile from HORIZON and the IBMi system
 */
export const user_security_user_inquiry = createAction({
  name: 'user_security_user_inquiry',
  auth: fisHorizonAuth,
  displayName: 'User Security - User Inquiry',
  description: 'Retrieve a user profile from HORIZON and the IBMi system',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'The user ID to retrieve (max 10 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, userId } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/user-security/v1/users/${encodeURIComponent(userId)}`,
      headers,
    });

    return response.body;
  },
});

/**
 * User Security - Maintain User
 * PUT /users/{userId}
 * Maintain a user profile from HORIZON and the IBMi system
 */
export const user_security_maintain_user = createAction({
  name: 'user_security_maintain_user',
  auth: fisHorizonAuth,
  displayName: 'User Security - Maintain User',
  description: 'Maintain a user profile from HORIZON and the IBMi system',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'The user ID to maintain (max 10 characters)',
      required: true,
    }),
    generalInformation: Property.Json({
      displayName: 'General Information',
      description: 'General information object containing userName, employeeNumber, firstName, middleInitial, lastName, etc.',
      required: true,
    }),
    accessControls: Property.Json({
      displayName: 'Access Controls',
      description: 'Access controls object containing settings like bankControl, primaryGroupCode, etc.',
      required: true,
    }),
    defaultBankNumber: Property.ShortText({
      displayName: 'Default Bank Number',
      description: 'Default bank number (max 3 characters)',
      required: true,
    }),
    defaultBranchNumber: Property.ShortText({
      displayName: 'Default Branch Number',
      description: 'Default branch number (max 4 characters)',
      required: true,
    }),
    bankAssignment: Property.Json({
      displayName: 'Bank Assignment',
      description: 'Optional: Bank assignment object',
      required: false,
    }),
    contactInformation: Property.Json({
      displayName: 'Contact Information',
      description: 'Optional: Contact information object containing emailAddress, phone, etc.',
      required: false,
    }),
    secondarySecurityGroups: Property.Json({
      displayName: 'Secondary Security Groups',
      description: 'Optional: Array of secondary security groups',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, userId, generalInformation, accessControls, defaultBankNumber, defaultBranchNumber, bankAssignment, contactInformation, secondarySecurityGroups } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const body: Record<string, unknown> = {
      generalInformation: generalInformation,
      accessControls: accessControls,
      defaultBankNumber: defaultBankNumber,
      defaultBranchNumber: defaultBranchNumber,
    };

    if (bankAssignment) {
      body['bankAssignment'] = bankAssignment;
    }
    if (contactInformation) {
      body['contactInformation'] = contactInformation;
    }
    if (secondarySecurityGroups) {
      body['secondarySecurityGroups'] = secondarySecurityGroups;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/user-security/v1/users/${encodeURIComponent(userId)}`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * User Security - Delete User
 * DELETE /users/{userId}
 * Delete a user profile from HORIZON and the IBMi system
 */
export const user_security_delete_user = createAction({
  name: 'user_security_delete_user',
  auth: fisHorizonAuth,
  displayName: 'User Security - Delete User',
  description: 'Delete a user profile from HORIZON and the IBMi system',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'The user ID to delete (max 10 characters)',
      required: true,
    }),
    newOwnerUserId: Property.ShortText({
      displayName: 'New Owner User ID',
      description: 'New owner for the objects owned by the deleted user profile (max 30 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, userId, newOwnerUserId } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: Record<string, string> = {
      newOwnerUserId: newOwnerUserId,
    };
    const queryString = '?' + new URLSearchParams(queryParams).toString();

    const response = await httpClient.sendRequest({
      method: HttpMethod.DELETE,
      url: `${baseUrl}/user-security/v1/users/${encodeURIComponent(userId)}${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * User Security - Enable User
 * POST /users/{userId}/enable
 * Enable net server access for a HORIZON User Profile and enable a IBMi User Profile
 */
export const user_security_enable_user = createAction({
  name: 'user_security_enable_user',
  auth: fisHorizonAuth,
  displayName: 'User Security - Enable User',
  description: 'Enable net server access for a HORIZON User Profile and enable a IBMi User Profile',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'The user ID to enable (max 10 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, userId } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.POST,
      url: `${baseUrl}/user-security/v1/users/${encodeURIComponent(userId)}/enable`,
      headers,
      body: {},
    });

    return response.body;
  },
});

/**
 * User Security - Groups Inquiry
 * GET /groups
 * Retrieve a list of all available security groups for the bank(s) to which the given user is authorized
 */
export const user_security_groups_inquiry = createAction({
  name: 'user_security_groups_inquiry',
  auth: fisHorizonAuth,
  displayName: 'User Security - Groups Inquiry',
  description: 'Retrieve a list of all available security groups for the bank(s) to which the given user is authorized',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/user-security/v1/groups`,
      headers,
    });

    return response.body;
  },
});

/**
 * User Security - User Groups Inquiry
 * GET /users/{userId}/groups
 * Retrieve a primary user group and a list of secondary groups assigned to a specific user id
 */
export const user_security_user_groups_inquiry = createAction({
  name: 'user_security_user_groups_inquiry',
  auth: fisHorizonAuth,
  displayName: 'User Security - User Groups Inquiry',
  description: 'Retrieve a primary user group and a list of secondary groups assigned to a specific user id',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'The user ID to retrieve groups for (max 10 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, userId } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/user-security/v1/users/${encodeURIComponent(userId)}/groups`,
      headers,
    });

    return response.body;
  },
});

/**
 * User Security - Maintain User Groups
 * PUT /users/{userId}/groups
 * Maintain a list of secondary groups assigned to a specific user id
 */
export const user_security_maintain_user_groups = createAction({
  name: 'user_security_maintain_user_groups',
  auth: fisHorizonAuth,
  displayName: 'User Security - Maintain User Groups',
  description: 'Maintain a list of secondary groups assigned to a specific user id',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'The user ID to maintain groups for (max 10 characters)',
      required: true,
    }),
    assignSecondaryGroups: Property.Json({
      displayName: 'Assign Secondary Groups',
      description: 'Optional: Array of group codes to assign (max 10 characters each). Example: ["TEST32487", "TEST32488"]',
      required: false,
    }),
    removeSecondaryGroups: Property.Json({
      displayName: 'Remove Secondary Groups',
      description: 'Optional: Array of group codes to remove (max 10 characters each). Note: The primary groupCode cannot be removed. Example: ["TEST32489"]',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, userId, assignSecondaryGroups, removeSecondaryGroups } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const body: Record<string, unknown> = {};
    if (assignSecondaryGroups) {
      body['assignSecondaryGroups'] = assignSecondaryGroups;
    }
    if (removeSecondaryGroups) {
      body['removeSecondaryGroups'] = removeSecondaryGroups;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/user-security/v1/users/${encodeURIComponent(userId)}/groups`,
      headers,
      body,
    });

    return response.body;
  },
});

/**
 * User Security - Group Inquiry
 * GET /groups/{groupCode}
 * Retrieve group details information for a specific group code
 */
export const user_security_group_inquiry = createAction({
  name: 'user_security_group_inquiry',
  auth: fisHorizonAuth,
  displayName: 'User Security - Group Inquiry',
  description: 'Retrieve group details information for a specific group code',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    groupCode: Property.ShortText({
      displayName: 'Group Code',
      description: 'The group code to retrieve details for (max 10 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, groupCode } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/user-security/v1/groups/${encodeURIComponent(groupCode)}`,
      headers,
    });

    return response.body;
  },
});

/**
 * User Security - Group Permissions Inquiry
 * GET /groups/{groupCode}/permissions
 * Retrieve a list of permissions for a specific group code
 */
export const user_security_group_permissions_inquiry = createAction({
  name: 'user_security_group_permissions_inquiry',
  auth: fisHorizonAuth,
  displayName: 'User Security - Group Permissions Inquiry',
  description: 'Retrieve a list of permissions for a specific group code',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    groupCode: Property.ShortText({
      displayName: 'Group Code',
      description: 'The group code to retrieve permissions for (max 10 characters)',
      required: true,
    }),
    category: Property.ShortText({
      displayName: 'Category',
      description: 'Optional: Filter by category (max 50 characters)',
      required: false,
    }),
    heading: Property.ShortText({
      displayName: 'Heading',
      description: 'Optional: Filter by heading (max 50 characters)',
      required: false,
    }),
    homePageName: Property.ShortText({
      displayName: 'Home Page Name',
      description: 'Optional: Filter by home page name (max 50 characters)',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, groupCode, category, heading, homePageName } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const queryParams: Record<string, string> = {};
    if (category) {
      queryParams['category'] = category;
    }
    if (heading) {
      queryParams['heading'] = heading;
    }
    if (homePageName) {
      queryParams['homePageName'] = homePageName;
    }

    const queryString = Object.keys(queryParams).length > 0
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';

    const response = await httpClient.sendRequest({
      method: HttpMethod.GET,
      url: `${baseUrl}/user-security/v1/groups/${encodeURIComponent(groupCode)}/permissions${queryString}`,
      headers,
    });

    return response.body;
  },
});

/**
 * User Security - Change Password
 * PUT /users/{userId}/change-passwords
 * Change a password for a user profile on IBMi system
 */
export const user_security_change_password = createAction({
  name: 'user_security_change_password',
  auth: fisHorizonAuth,
  displayName: 'User Security - Change Password',
  description: 'Change a password for a user profile on IBMi system',
  props: {
    xAuthorization: Property.ShortText({
      displayName: 'Authorization Token',
      description: 'The authorization token obtained from the Get Token endpoint',
      required: true,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
    userId: Property.ShortText({
      displayName: 'User ID',
      description: 'The user ID to change password for (max 10 characters)',
      required: true,
    }),
    newPassword: Property.ShortText({
      displayName: 'New Password',
      description: 'The new password (min 15 characters, max 128 characters)',
      required: true,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth['baseUrl'];
    const organizationId = auth['organizationId'];
    const { xAuthorization, sourceId, userId, newPassword } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
      'horizon-authorization': xAuthorization,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const body: Record<string, unknown> = {
      newPassword: newPassword,
    };

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/user-security/v1/users/${encodeURIComponent(userId)}/change-passwords`,
      headers,
      body,
    });

    return response.body;
  },
});
