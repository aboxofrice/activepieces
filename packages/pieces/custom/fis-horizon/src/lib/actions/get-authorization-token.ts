import {
  createAction,
  Property,
} from '@activepieces/pieces-framework';
import { httpClient, HttpMethod } from '@activepieces/pieces-common';
import { fisHorizonAuth } from '../..';

export const getAuthorizationToken = createAction({
  name: 'authorization_get_token',
  auth: fisHorizonAuth,
  displayName: 'Authorization - Get Token',
  description: 'Retrieve an authorization token using user credentials. This token is required for all other API calls.',
  props: {
    newUserSecret: Property.ShortText({
      displayName: 'New User Secret',
      description: 'Optional: Provide a new user secret to update the password',
      required: false,
    }),
    token: Property.ShortText({
      displayName: 'SSO Token',
      description: 'Optional: SSO Token for single sign-on authentication',
      required: false,
    }),
    sourceId: Property.ShortText({
      displayName: 'Source ID',
      description: 'Optional: 6 character ID provided by FIS',
      required: false,
    }),
  },
  async run(context) {
    const auth = context.auth as any;
    const baseUrl = auth.baseUrl;
    const organizationId = auth.organizationId;
    const userId = auth.userId;
    const userSecret = auth.userSecret;
    const { newUserSecret, token, sourceId } = context.propsValue;

    const uuid = crypto.randomUUID();

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'organization-id': organizationId,
      'uuid': uuid,
    };

    if (sourceId) {
      headers['source-id'] = sourceId;
    }

    const body: Record<string, string> = {
      userId: userId,
      userSecret: userSecret,
    };

    if (newUserSecret) {
      body['newUserSecret'] = newUserSecret;
    }

    if (token) {
      body['token'] = token;
    }

    const response = await httpClient.sendRequest({
      method: HttpMethod.PUT,
      url: `${baseUrl}/authorization/v2/authorization`,
      headers,
      body,
    });

    return response.body;
  },
});
