import { describe, expect, it } from 'vitest';
import { FitmentSource, fitmentMatcher } from './fitment-matcher';

describe('fitmentMatcher.assessFitment', () => {
    it('does not match an F-250 Super Duty to an F-150 "heavy duty" part', () => {
        const result = assess({
            texts: ['2015-2020 Ford F-150 Heavy Duty Oil Pan'],
            vehicle: { year: 2017, make: 'Ford', model: 'F-250 Super Duty' },
        });
        expect(result.verdict).toBe('text_mismatch');
        expect(result.model_matches).toBe(false);
    });

    it('matches an F-250 listed with a year range that covers the vehicle', () => {
        const result = assess({
            texts: ['Fits 2017-2019 Ford F-250 F-350 Super Duty 6.7L'],
            vehicle: { year: 2018, make: 'Ford', model: 'F-250 Super Duty' },
        });
        expect(result.verdict).toBe('text_match');
        expect(result.confidence).toBe('medium');
        expect(result.years_near_model).toBe('2017-2019');
        expect(result.evidence[0]).toContain('F-250');
    });

    it('reads the years before the model even when another model sits between', () => {
        const result = assess({
            texts: ['2015-2016 Ford F-250 F-350 Super Duty'],
            vehicle: { year: 2016, make: 'Ford', model: 'F-350 Super Duty' },
        });
        expect(result.verdict).toBe('text_match');
    });

    it('understands F-250/350 shorthand', () => {
        const result = assess({
            texts: ['2011-2016 Ford F-250/350 Super Duty'],
            vehicle: { year: 2012, make: 'Ford', model: 'F-350 Super Duty' },
        });
        expect(result.verdict).toBe('text_match');
    });

    it('rejects a Ram 2500 against a Ram 1500 part', () => {
        const result = assess({
            texts: ['2013-2018 Ram 1500 Front Brake Rotors'],
            vehicle: { year: 2015, make: 'RAM', model: '2500' },
        });
        expect(result.verdict).toBe('text_mismatch');
    });

    it('matches a Ram 2500 listed as Dodge Ram 2500', () => {
        const result = assess({
            texts: ['2010-2018 Dodge Ram 2500 Cummins'],
            vehicle: { year: 2015, make: 'RAM', model: '2500' },
        });
        expect(result.verdict).toBe('text_match');
    });

    it('rejects a Silverado 2500 HD against a Silverado 1500 part', () => {
        const result = assess({
            texts: ['2014-2018 Chevy Silverado 1500 Tail Light'],
            vehicle: { year: 2016, make: 'Chevrolet', model: 'Silverado 2500 HD' },
        });
        expect(result.verdict).toBe('text_mismatch');
    });

    it('ties years to their own model (Accord vs Civic)', () => {
        const texts = ['2013-2017 Honda Accord; 2016-2020 Honda Civic'];
        expect(assess({ texts, vehicle: { year: 2018, make: 'Honda', model: 'Accord' } }).verdict).toBe('text_mismatch');
        expect(assess({ texts, vehicle: { year: 2015, make: 'Honda', model: 'Accord' } }).verdict).toBe('text_match');
        expect(assess({ texts, vehicle: { year: 2018, make: 'Honda', model: 'Civic' } }).verdict).toBe('text_match');
    });

    it('reads "2019+" as 2019 onwards', () => {
        const result = assess({
            texts: ['Ford F-150 2019+ Running Boards'],
            vehicle: { year: 2022, make: 'Ford', model: 'F-150' },
            currentYear: 2025,
        });
        expect(result.verdict).toBe('text_match');
        expect(result.years_near_model).toBe('2019-2026');
    });

    it('does not read part numbers or weights as years', () => {
        const result = assess({
            texts: ['Ford F-250 bracket FC3Z-2015-A, rated 2000 lbs'],
            vehicle: { year: 2015, make: 'Ford', model: 'F-250' },
        });
        expect(result.years_mentioned).toBe('');
        expect(result.verdict).toBe('unknown');
    });

    it('needs the make to appear before claiming a match', () => {
        const result = assess({
            texts: ['2015-2019 F-250 Super Duty'],
            vehicle: { year: 2016, make: 'Ford', model: 'F-250 Super Duty' },
        });
        expect(result.verdict).toBe('unknown');
    });

    it('accepts the brand as the make for OEM parts', () => {
        const result = assess({
            texts: ['2015-2019 F-250 Super Duty'],
            brand: 'Ford',
            vehicle: { year: 2016, make: 'Ford', model: 'F-250 Super Duty' },
        });
        expect(result.verdict).toBe('text_match');
    });

    it('reports a different make as a mismatch', () => {
        const result = assess({
            texts: ['2015-2019 Toyota Tacoma'],
            vehicle: { year: 2016, make: 'Ford', model: 'Ranger' },
        });
        expect(result.verdict).toBe('text_mismatch');
        expect(result.confidence).toBe('low');
    });

    it('handles two-digit range ends across a century', () => {
        const result = assess({
            texts: ['1998-02 Honda Accord'],
            vehicle: { year: 2001, make: 'Honda', model: 'Accord' },
        });
        expect(result.verdict).toBe('text_match');
    });

    it('passes universal fit through', () => {
        const result = fitmentMatcher.assessFitment({ sources: [], fitType: 'universal_fit', brand: null, vehicle: { year: 2016, make: 'Ford', model: 'F-250' } });
        expect(result.verdict).toBe('universal');
    });
});

function assess({ texts, vehicle, brand = null, currentYear }: AssessInput) {
    const sources: FitmentSource[] = texts.map((text) => ({ label: 'compatibility', text }));
    return fitmentMatcher.assessFitment({ sources, fitType: null, brand, vehicle, currentYear });
}

type AssessInput = {
    texts: string[];
    vehicle: { year: number; make: string; model: string };
    brand?: string | null;
    currentYear?: number;
};
