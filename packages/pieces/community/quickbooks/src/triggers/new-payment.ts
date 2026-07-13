import {
  TriggerStrategy,
  createTrigger,
  AppConnectionValueForAuthProperty,
} from '@activepieces/pieces-framework';
import { quickbooksAuth } from '../lib/auth';
import {
  DedupeStrategy,
  httpClient,
  HttpMethod,
  Polling,
  pollingHelper,
} from '@activepieces/pieces-common';
import { quickbooksCommon, QuickbooksEntityResponse } from '../lib/common';
import dayjs from 'dayjs';
import { QuickbooksMetaData, QuickbooksRef } from '../lib/types';

interface QuickbooksPayment {
  Id: string;
  SyncToken?: string;
  MetaData?: QuickbooksMetaData;
  TxnDate?: string;
  CustomerRef: QuickbooksRef;
  TotalAmt?: number;
  UnappliedAmt?: number;
  Line?: {
    Amount?: number;
    LinkedTxn?: { TxnId: string; TxnType: string }[];
  }[];
}

const polling: Polling<
 AppConnectionValueForAuthProperty<typeof quickbooksAuth>,
  Record<string, unknown>
> = {
  strategy: DedupeStrategy.TIMEBASED,
  async items({ auth, lastFetchEpochMS }) {
    const { access_token } = auth;
    const companyId = auth.props?.['companyId'] as string;

    const apiUrl = quickbooksCommon.getApiUrl({ companyId: companyId!, environment: auth.props?.['environment'] as string | undefined });

    const query =
      lastFetchEpochMS === 0
        ? `SELECT * FROM Payment ORDERBY Metadata.CreateTime DESC MAXRESULTS 10`
        : `SELECT * FROM Payment WHERE Metadata.CreateTime >= '${dayjs(
            lastFetchEpochMS
          ).toISOString()}' ORDERBY Metadata.CreateTime DESC`;

    const response = await httpClient.sendRequest<
      QuickbooksEntityResponse<QuickbooksPayment>
    >({
      method: HttpMethod.GET,
      url: `${apiUrl}/query`,
      queryParams: { query: query, minorversion: '70' },
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json',
      },
    });

    const payments = response.body.QueryResponse?.['Payment'] ?? [];

    return payments.map((payment) => ({
      epochMilliSeconds: dayjs(payment.MetaData?.CreateTime).valueOf(),
      data: payment,
    }));
  },
};

export const newPayment = createTrigger({
  auth: quickbooksAuth,
  name: 'new_payment',
  displayName: 'New Payment',
  description: 'Triggers when a payment is received.',
  props: {},
  type: TriggerStrategy.POLLING,
  async onEnable(context) {
    await pollingHelper.onEnable(polling, {
      auth: context.auth,
      store: context.store,
      propsValue: context.propsValue,
    });
  },
  async onDisable(context) {
    await pollingHelper.onDisable(polling, {
      auth: context.auth,
      store: context.store,
      propsValue: context.propsValue,
    });
  },
  async test(context) {
    return await pollingHelper.test(polling, context);
  },
  async run(context) {
    return await pollingHelper.poll(polling, context);
  },
  sampleData: undefined,
});
