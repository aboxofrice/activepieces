import { httpClient, HttpMethod } from '@activepieces/pieces-common';

export interface EncompassAuthProps {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  instanceId: string;
}

// Helper function to extract auth props from context.auth
export function getAuthProps(auth: unknown): EncompassAuthProps {
  // CustomAuth wraps props under a 'props' key
  const authObj = auth as { props?: EncompassAuthProps } & EncompassAuthProps;
  return authObj.props ?? authObj;
}

// Custom URL encoding that matches Encompass API expectations
// encodeURIComponent encodes $ and ! but Encompass expects them unencoded
function encompassEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%24/g, '$')
    .replace(/%21/g, '!');
}

// Helper function to get access token
export async function getAccessToken(authProps: EncompassAuthProps): Promise<string> {
  // Match exact curl format
  const formBody = [
    `instance_id=${encompassEncode(authProps.instanceId)}`,
    `scope=lp`,
    `grant_type=client_credentials`,
    `client_id=${encompassEncode(authProps.clientId)}`,
    `client_secret=${encompassEncode(authProps.clientSecret)}`,
  ].join('&');

  const tokenResponse = await httpClient.sendRequest({
    method: HttpMethod.POST,
    url: `${authProps.baseUrl}/oauth2/v1/token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  });

  return (tokenResponse.body as any).access_token;
}
