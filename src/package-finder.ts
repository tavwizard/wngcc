import { promisify } from 'util';
import * as path from 'path';
import * as glob from 'glob';
import { readFile } from 'fs';
import { Package } from './package';

const readFile_p = promisify(readFile);

const glob_p = promisify(glob);

export async function findAllPackages(basePath: string) {
    const files = await glob_p(path.join(basePath, '**/package.json'));
    return loadPackages(files);
}

export async function loadPackages(files: string[]) {
    let packs = await Promise.all(files.map<Promise<Package>>(async (file) => {
        const buffer = await readFile_p(file);
        const pack = JSON.parse(buffer.toString())
        return {
            name: pack.name,
            version: pack.version,
            ngccProcessed: !!pack['__processed_by_ivy_ngcc__'],
            path: path.dirname(file),
            filePath: file
        };
    }));
    packs = packs.filter(pack => pack.name);

    const map = new Map<string, Package>();
    packs.forEach((pack) => map[pack.name] = pack);
    packs.forEach((pack) => {
        while (pack.ngccProcessed && !pack.version) {
            const parts = pack.name.split('/');
            const parentName = parts.slice(0, parts.length - 1).join('/');
            if (parentName && (pack = map[parentName])) {
                pack.ngccProcessed = true;
            }
        }
    });
    return packs.filter((pack) => pack.version);
}

