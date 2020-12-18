import { parseCommandLineOptions } from "@angular/compiler-cli/ngcc/src/command_line_options";
import { NGCC_VERSION } from "@angular/compiler-cli/ngcc/src/packages/build_marker";
import { process as processNgcc, AsyncNgccOptions } from "@angular/compiler-cli/ngcc";
import { findAllPackages } from './package-finder';
import { Cache } from './cache';

export async function main() {
    const opts = parseCommandLineOptions(process.argv.slice(2));
    const cache = new Cache(NGCC_VERSION);
    await cache.init();
    const packs = await findAllPackages(opts.basePath);
    const cached = packs
        .filter(pack => !pack.ngccProcessed && cache.hasPackage(pack))
        .map(pack => cache.copyFromCache(pack));

    await Promise.all(cached);

    await Promise.resolve(processNgcc(opts as AsyncNgccOptions));

    const packsToCheck = await findAllPackages(opts.basePath);
    const toCache = packsToCheck
        .filter(pack => pack.ngccProcessed && !cache.hasPackage(pack))
        .map(pack => cache.copyToCache(pack));

    await Promise.all(toCache);

    await cache.save();
}