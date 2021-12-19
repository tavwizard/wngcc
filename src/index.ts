import { parseCommandLineOptions } from "@angular/compiler-cli/ngcc/src/command_line_options";
import { NGCC_VERSION } from "@angular/compiler-cli/ngcc/src/packages/build_marker";
import {
  process as processNgcc,
  AsyncNgccOptions,
} from "@angular/compiler-cli/ngcc";
import { findAllPackages } from "./package-finder";
import { Cache } from "./cache";
import { pool } from "./utils";

export async function main() {
  const opts = parseCommandLineOptions(process.argv.slice(2));
  const cache = new Cache(NGCC_VERSION);
  await cache.init();
  try {
    const packs = await findAllPackages(opts.basePath);
    const cached = packs
      .filter(
        (pack) => pack.ngccVersion !== NGCC_VERSION && cache.hasPackage(pack)
      )
      .map((pack) => () => cache.copyFromCache(pack));

    await pool(cached, 2);

    await Promise.resolve(processNgcc(opts as AsyncNgccOptions));

    const packsToCheck = await findAllPackages(opts.basePath);
    const toCache = packsToCheck
      .filter((pack) => pack.ngccVersion && !cache.hasPackage(pack))
      .map((pack) => () => cache.copyToCache(pack));

    await pool(toCache, 2);

    await cache.save();
  } catch (err) {
    console.error(err);
    throw err;
  }
}
