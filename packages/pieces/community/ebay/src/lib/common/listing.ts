import { EbayAuthProps, ebayClient } from './client';
import { inventoryCommon, TradingResult } from './inventory';
import { xmlUtils } from './xml';

async function getListingDetails({ auth, itemId, includeCompatibility }: { auth: EbayAuthProps; itemId: string; includeCompatibility: boolean }): Promise<ListingDetailsResult> {
    const xml = await ebayClient.tradingCall({
        auth,
        callName: 'GetItem',
        innerXml: `<ItemID>${xmlUtils.escapeXml({ text: itemId.trim() })}</ItemID><DetailLevel>ReturnAll</DetailLevel><IncludeItemSpecifics>true</IncludeItemSpecifics>${includeCompatibility ? '<IncludeItemCompatibilityList>true</IncludeItemCompatibilityList>' : ''}`,
        readOnly: true,
    });
    const result = inventoryCommon.readableResult({ xml, call: 'GetItem' });
    const itemXml = xmlUtils.blocks({ xml, tag: 'Item' })[0];
    if (result.ack === 'Failure' || !itemXml) {
        return { found: false, ...result, listing: null };
    }
    return { found: true, ...result, listing: parseItem({ itemXml }) };
}

function parseItem({ itemXml }: { itemXml: string }): ListingDetails {
    const compatibilityXml = xmlUtils.blocks({ xml: itemXml, tag: 'ItemCompatibilityList' })[0] ?? '';
    const topLevel = ['ItemCompatibilityList', 'Variations', 'ItemSpecifics', 'ShippingDetails', 'ReturnPolicy', 'Seller', 'PictureDetails']
        .reduce((xml, tag) => xmlUtils.withoutBlocks({ xml, tag }), itemXml);
    const sellingStatus = xmlUtils.blocks({ xml: topLevel, tag: 'SellingStatus' })[0] ?? '';
    const category = xmlUtils.blocks({ xml: topLevel, tag: 'PrimaryCategory' })[0] ?? '';
    const listingDetails = xmlUtils.blocks({ xml: topLevel, tag: 'ListingDetails' })[0] ?? '';
    const specificsXml = xmlUtils.blocks({ xml: itemXml, tag: 'ItemSpecifics' })[0] ?? '';
    const pictureXml = xmlUtils.blocks({ xml: itemXml, tag: 'PictureDetails' })[0] ?? '';
    const quantity = toNumber({ value: xmlUtils.firstTag({ xml: xmlUtils.withoutBlocks({ xml: topLevel, tag: 'SellingStatus' }), tag: 'Quantity' }) });
    const quantitySold = toNumber({ value: xmlUtils.firstTag({ xml: sellingStatus, tag: 'QuantitySold' }) });
    const compatibility = xmlUtils.blocks({ xml: compatibilityXml, tag: 'Compatibility' }).map((rowXml) => ({
        ...nameValues({ xml: rowXml }),
        notes: xmlUtils.firstTag({ xml: rowXml, tag: 'CompatibilityNotes' }) ?? '',
    }));
    return {
        item_id: xmlUtils.firstTag({ xml: topLevel, tag: 'ItemID' }),
        sku: xmlUtils.firstTag({ xml: topLevel, tag: 'SKU' }),
        title: xmlUtils.firstTag({ xml: topLevel, tag: 'Title' }),
        subtitle: xmlUtils.firstTag({ xml: topLevel, tag: 'SubTitle' }),
        listing_status: xmlUtils.firstTag({ xml: sellingStatus, tag: 'ListingStatus' }),
        listing_type: xmlUtils.firstTag({ xml: topLevel, tag: 'ListingType' }),
        price: toNumber({ value: xmlUtils.firstTag({ xml: sellingStatus, tag: 'CurrentPrice' }) }),
        currency: xmlUtils.firstTag({ xml: topLevel, tag: 'Currency' }),
        quantity,
        quantity_sold: quantitySold,
        quantity_available: quantity === null ? null : quantity - (quantitySold ?? 0),
        condition: xmlUtils.firstTag({ xml: topLevel, tag: 'ConditionDisplayName' }),
        category_id: xmlUtils.firstTag({ xml: category, tag: 'CategoryID' }),
        category_name: xmlUtils.firstTag({ xml: category, tag: 'CategoryName' }),
        start_time: xmlUtils.firstTag({ xml: listingDetails, tag: 'StartTime' }),
        end_time: xmlUtils.firstTag({ xml: listingDetails, tag: 'EndTime' }),
        view_item_url: xmlUtils.firstTag({ xml: listingDetails, tag: 'ViewItemURL' }),
        picture_urls: xmlUtils.blocks({ xml: pictureXml, tag: 'PictureURL' }).map((url) => xmlUtils.unescapeXml({ text: url })),
        item_specifics: nameValues({ xml: specificsXml }),
        has_variations: itemXml.includes('<Variations>'),
        compatibility_count: compatibility.length,
        compatibility,
    };
}

function nameValues({ xml }: { xml: string }): Record<string, string> {
    return Object.fromEntries(xmlUtils.blocks({ xml, tag: 'NameValueList' }).map((pairXml) => [
        xmlUtils.firstTag({ xml: pairXml, tag: 'Name' }) ?? '',
        xmlUtils.blocks({ xml: pairXml, tag: 'Value' }).map((value) => xmlUtils.unescapeXml({ text: value })).join(' | '),
    ]));
}

function toNumber({ value }: { value: string | null }): number | null {
    if (value === null) {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export const listingCommon = {
    getListingDetails,
};

export type ListingDetails = {
    item_id: string | null;
    sku: string | null;
    title: string | null;
    subtitle: string | null;
    listing_status: string | null;
    listing_type: string | null;
    price: number | null;
    currency: string | null;
    quantity: number | null;
    quantity_sold: number | null;
    quantity_available: number | null;
    condition: string | null;
    category_id: string | null;
    category_name: string | null;
    start_time: string | null;
    end_time: string | null;
    view_item_url: string | null;
    picture_urls: string[];
    item_specifics: Record<string, string>;
    has_variations: boolean;
    compatibility_count: number;
    compatibility: Record<string, string>[];
};

export type ListingDetailsResult = TradingResult & {
    found: boolean;
    listing: ListingDetails | null;
};
