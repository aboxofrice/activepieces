import { HttpMethod } from '@activepieces/pieces-common';
import { createAction, Property } from '@activepieces/pieces-framework';
import { walmartAuth, walmartAuthProps } from '../auth';
import { walmartClient } from '../common/client';

// Walmart has no public API to read or send buyer messages (they live only in the Seller
// Center inbox); this metrics summary is the closest the Marketplace API offers.
export const getSellerResponseRate = createAction({
    auth: walmartAuth,
    name: 'get_seller_response_rate',
    displayName: 'Get Seller Response Rate',
    description: 'Get the share of customer messages answered within 48 hours (Walmart seller performance metric).',
    props: {
        reportDuration: Property.StaticDropdown({
            displayName: 'Period',
            required: true,
            defaultValue: '30',
            options: {
                disabled: false,
                options: [
                    { label: 'Last 14 days', value: '14' },
                    { label: 'Last 30 days', value: '30' },
                    { label: 'Last 60 days', value: '60' },
                    { label: 'Last 90 days', value: '90' },
                ],
            },
        }),
    },
    async run(context) {
        const response = await walmartClient.request<unknown>({
            auth: walmartAuthProps(context.auth),
            method: HttpMethod.GET,
            path: '/v3/insights/performance/srr/summary',
            queryParams: { reportDuration: context.propsValue.reportDuration },
        });
        if (walmartClient.isRecord(response) && walmartClient.isRecord(response['payload'])) {
            return { available: true, ...response['payload'] };
        }
        // Walmart answers with an empty body when there are no customer messages in the period.
        return { available: false, message: 'Walmart has no response-rate data for this period (no customer messages to measure).' };
    },
});
