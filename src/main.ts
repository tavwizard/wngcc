#!/usr/bin/env node
import { main } from './index';

main().catch((error) => {
    console.error(error);
});