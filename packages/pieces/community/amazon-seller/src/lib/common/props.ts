import { Property } from '@activepieces/pieces-framework';
import { AmazonSellerAuthProps } from './client';
import { marketplaces } from './marketplaces';

function marketplace() {
    return Property.StaticDropdown({
        displayName: 'Marketplace',
        description: "Leave empty to use the connection's default marketplace. Must be in the same region as the default.",
        required: false,
        options: { options: marketplaces.dropdownOptions() },
    });
}

// An override from another region would be sent to the wrong regional host and fail with an
// opaque 400, so reject it here with a message that says what to change.
function resolveMarketplace({ auth, override }: { auth: AmazonSellerAuthProps; override: string | undefined | null }): string {
    if (!override) {
        return auth.marketplaceId;
    }
    const wanted = marketplaces.regionFor({ marketplaceId: override });
    const connected = marketplaces.regionFor({ marketplaceId: auth.marketplaceId });
    if (wanted !== connected) {
        throw new Error(`Marketplace ${override} is in the ${wanted.toUpperCase()} region but this connection uses ${connected.toUpperCase()}. Create a connection for that region instead.`);
    }
    return override;
}

function requireSellerId({ auth }: { auth: AmazonSellerAuthProps }): string {
    const sellerId = auth.sellerId?.trim();
    if (!sellerId) {
        throw new Error('This action needs the Seller ID (Merchant Token). Add it to the connection: Seller Central > Settings > Account Info > Merchant Token.');
    }
    return sellerId;
}

function amazonOrderId() {
    return Property.ShortText({
        displayName: 'Amazon Order ID',
        description: 'The 3-7-7 order number shown in Seller Central, e.g. 113-1234567-1234567.',
        required: true,
    });
}

function sku({ description }: { description?: string } = {}) {
    return Property.ShortText({
        displayName: 'Seller SKU',
        description: description ?? 'The SKU you assigned to the listing in Seller Central.',
        required: true,
    });
}

export const amazonProps = { marketplace, resolveMarketplace, requireSellerId, amazonOrderId, sku };
