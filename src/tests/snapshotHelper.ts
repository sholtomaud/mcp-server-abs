import fs from 'fs/promises';
import path from 'path';
import { expect } from 'vitest';

const DATA_DIR = path.join(process.cwd(), 'src', 'tests', 'data');

export async function handleSnapshot(name: string, data: any) {
    const filePath = path.join(DATA_DIR, `${name}.json`);
    const updateSnapshots = process.env.UPDATE_SNAPSHOTS === 'true';

    if (updateSnapshots) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return data;
    }

    try {
        const savedData = await fs.readFile(filePath, 'utf8');
        const snapshot = JSON.parse(savedData);

        // Compare data with snapshot, ignoring dynamic fields
        const normalizedData = normalizeData(data);
        const normalizedSnapshot = normalizeData(snapshot);

        expect(normalizedData).toEqual(normalizedSnapshot);
        return snapshot;
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            // If snapshot doesn't exist, create it (first run behavior)
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            return data;
        }
        throw error;
    }
}

function normalizeData(data: any): any {
    if (Array.isArray(data)) {
        return data.map(normalizeData);
    } else if (data !== null && typeof data === 'object') {
        const normalized: any = {};
        for (const [key, value] of Object.entries(data)) {
            // Ignore dynamic fields like timestamps or IDs that change
            if (['lastUpdated', 'timestamp', 'prepared', 'generated', 'Prepared', 'ID'].includes(key)) {
                normalized[key] = 'EXCLUDED_DYNAMIC_FIELD';
            } else {
                normalized[key] = normalizeData(value);
            }
        }
        return normalized;
    } else if (typeof data === 'string') {
        // Try to parse as JSON to normalize nested dynamic fields in strings (common in MCP responses)
        try {
            const parsed = JSON.parse(data);
            if (typeof parsed === 'object' && parsed !== null) {
                return JSON.stringify(normalizeData(parsed), null, 2);
            }
        } catch (e) {
            // Not JSON, return as is
        }
    }
    return data;
}
