import * as os from 'os';
import * as path from 'path';
import { mkdir, access, readFile, writeFile, constants, rmdir } from 'fs';
import { promisify } from 'util';
import { Package } from './package';
import * as reflect from '@alumna/reflect';

const mkdir_p = promisify(mkdir);
const rmdir_p = promisify(rmdir);
const access_p = promisify(access);
const readFile_p = promisify(readFile);
const writeFile_p = promisify(writeFile);

const CACHE_VERSION = "1";

interface IndexFile {
    version: string;
    index: {
        [ngccVersion: string]: {
            [packName: string]: {
                versions: string[]
            }
        }
    }
}

export class Cache {
    readonly cachePath: string;
    private indexes: IndexFile = {
        version: CACHE_VERSION,
        index: {}
    };

    constructor(private ngccVersion: string) {
        this.cachePath = process.platform === "win32" ?
            path.join(process.env.APPDATA, 'wngcc') :
            path.join(os.homedir(), '.wngcc');
    }

    private get packages() {
        return this.indexes.index[this.ngccVersion];
    }

    async init() {
        await mkdir_p(this.cachePath, { recursive: true });
        return this.loadIndex();
    }

    hasPackage(pack: Package) {
        return !!this.packages[pack.name]?.versions?.includes(pack.version);
    }

    async copyFromCache(pack: Package) {
        if (!this.hasPackage(pack)) {
            throw Error(`Unknown package ${this.ngccVersion}|${pack.name}@${pack.version}`);
        }
        console.log(`From cache ${pack.name}@${pack.version}`);

        const packCachePath = this.generateCachePath(pack);
        const { err } = await reflect({
            src: packCachePath,
            dest: pack.path,
            delete: true,
            exclude: ['node_modules']
        });

        if (err) {
            throw err;
        }
    }

    async copyToCache(pack: Package) {
        console.log(`To cache ${pack.name}@${pack.version}`);

        const packCachePath = this.generateCachePath(pack);
        await mkdir_p(packCachePath, { recursive: true });

        const { err } = await reflect({
            src: pack.path,
            dest: packCachePath,
            delete: true,
            exclude: ['node_modules']
        });

        if (err) {
            throw err;
        }

        let indexRecord = this.packages[pack.name];
        if (!indexRecord) {
            indexRecord = {
                versions: []
            };
            this.packages[pack.name] = indexRecord;
        }
        indexRecord.versions.push(pack.version);
    }

    async save() {
        const indexPath = path.join(this.cachePath, '.index.json');
        const data = JSON.stringify(this.indexes, null, 2);
        return writeFile_p(indexPath, data);
    }

    private async cleanCacheFolder() {
        await rmdir_p(this.cachePath, { recursive: true });
        await mkdir_p(this.cachePath);
    }

    private generateCachePath(pack: Package) {
        return path.join(this.cachePath, this.ngccVersion, pack.name, pack.version)
    }

    private async loadIndex() {
        const indexPath = path.join(this.cachePath, '.index.json');
        if (await access_p(indexPath, constants.F_OK).then(() => true, () => false)) {
            const buffer = await readFile_p(indexPath);
            const indexes = JSON.parse(buffer.toString()) as IndexFile;
            if (indexes.version === CACHE_VERSION) {
                this.indexes = indexes;
            } else {
                await this.cleanCacheFolder();
            }
        }

        if (!this.packages) {
            this.indexes.index[this.ngccVersion] = {};
        }
    }
}