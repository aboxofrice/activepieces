function findMarketplace({ marketplaceId }: { marketplaceId: string }): Marketplace | undefined {
    return MARKETPLACES.find((marketplace) => marketplace.id === marketplaceId);
}

function regionFor({ marketplaceId }: { marketplaceId: string }): SpApiRegion {
    const marketplace = findMarketplace({ marketplaceId });
    if (!marketplace) {
        throw new Error(`Unknown Amazon marketplace ID "${marketplaceId}".`);
    }
    return marketplace.region;
}

function currencyFor({ marketplaceId }: { marketplaceId: string }): string {
    const marketplace = findMarketplace({ marketplaceId });
    if (!marketplace) {
        throw new Error(`Unknown Amazon marketplace ID "${marketplaceId}".`);
    }
    return marketplace.currency;
}

function dropdownOptions(): { label: string; value: string }[] {
    return MARKETPLACES.map((marketplace) => ({
        label: `${marketplace.country} (${marketplace.domain})`,
        value: marketplace.id,
    }));
}

const MARKETPLACES: Marketplace[] = [
    { id: 'ATVPDKIKX0DER', country: 'United States', domain: 'amazon.com', region: 'na', currency: 'USD' },
    { id: 'A2EUQ1WTGCTBG2', country: 'Canada', domain: 'amazon.ca', region: 'na', currency: 'CAD' },
    { id: 'A1AM78C64UM0Y8', country: 'Mexico', domain: 'amazon.com.mx', region: 'na', currency: 'MXN' },
    { id: 'A2Q3Y263D00KWC', country: 'Brazil', domain: 'amazon.com.br', region: 'na', currency: 'BRL' },
    { id: 'A1F83G8C2ARO7P', country: 'United Kingdom', domain: 'amazon.co.uk', region: 'eu', currency: 'GBP' },
    { id: 'A1PA6795UKMFR9', country: 'Germany', domain: 'amazon.de', region: 'eu', currency: 'EUR' },
    { id: 'A13V1IB3VIYZZH', country: 'France', domain: 'amazon.fr', region: 'eu', currency: 'EUR' },
    { id: 'APJ6JRA9NG5V4', country: 'Italy', domain: 'amazon.it', region: 'eu', currency: 'EUR' },
    { id: 'A1RKKUPIHCS9HS', country: 'Spain', domain: 'amazon.es', region: 'eu', currency: 'EUR' },
    { id: 'A1805IZSGTT6HS', country: 'Netherlands', domain: 'amazon.nl', region: 'eu', currency: 'EUR' },
    { id: 'AMEN7PMS3EDWL', country: 'Belgium', domain: 'amazon.com.be', region: 'eu', currency: 'EUR' },
    { id: 'A2NODRKZP88ZB9', country: 'Sweden', domain: 'amazon.se', region: 'eu', currency: 'SEK' },
    { id: 'A1C3SOZRARQ6R3', country: 'Poland', domain: 'amazon.pl', region: 'eu', currency: 'PLN' },
    { id: 'A33AVAJ2PDY3EV', country: 'Turkey', domain: 'amazon.com.tr', region: 'eu', currency: 'TRY' },
    { id: 'A2VIGQ35RCS4UG', country: 'United Arab Emirates', domain: 'amazon.ae', region: 'eu', currency: 'AED' },
    { id: 'A17E79C6D8DWNP', country: 'Saudi Arabia', domain: 'amazon.sa', region: 'eu', currency: 'SAR' },
    { id: 'ARBP9OOSHTCHU', country: 'Egypt', domain: 'amazon.eg', region: 'eu', currency: 'EGP' },
    { id: 'A21TJRUUN4KGV', country: 'India', domain: 'amazon.in', region: 'eu', currency: 'INR' },
    { id: 'AE08WJ6YKNBMC', country: 'South Africa', domain: 'amazon.co.za', region: 'eu', currency: 'ZAR' },
    { id: 'A1VC38T7YXB528', country: 'Japan', domain: 'amazon.co.jp', region: 'fe', currency: 'JPY' },
    { id: 'A39IBJ37TRP1C6', country: 'Australia', domain: 'amazon.com.au', region: 'fe', currency: 'AUD' },
    { id: 'A19VAU5U5O7RUS', country: 'Singapore', domain: 'amazon.sg', region: 'fe', currency: 'SGD' },
];

export const marketplaces = { findMarketplace, regionFor, currencyFor, dropdownOptions };

export const DEFAULT_MARKETPLACE_ID = 'ATVPDKIKX0DER';

export type SpApiRegion = 'na' | 'eu' | 'fe';

type Marketplace = {
    id: string;
    country: string;
    domain: string;
    region: SpApiRegion;
    currency: string;
};
