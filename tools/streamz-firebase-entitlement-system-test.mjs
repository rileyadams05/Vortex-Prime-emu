import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
const site = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
const pluginAlias = await readFile(new URL('../docs/streamz-pro-plugin/index.html', import.meta.url), 'utf8');
const checkout = await readFile(new URL('../docs/projects/streamz/pro/index.html', import.meta.url), 'utf8');
const verify = await readFile(new URL('../docs/projects/streamz/pro/verify/index.html', import.meta.url), 'utf8');
const commands = await readFile(new URL('../tools/register-streamz-discord-command.mjs', import.meta.url), 'utf8');

assert.doesNotMatch(site, /id="nav-streamz-plugin"|id="mobile-nav-streamz-plugin"|id="page-streamz-plugin"/);
assert.doesNotMatch(site, /\/streamz-pro-plugin\//);
assert.doesNotMatch(site, /Upgrade to Pro/);
assert.match(site, /if \(document\.getElementById\('page-streamz-plugin'\)\) loadStreamzDashboardData\(\)/);
assert.match(worker, /path === 'api\/streamz\/pro' \|\| \(path\.startsWith\('api\/streamz\/pro\/'\) && path !== 'api\/streamz\/pro\/webhook'\)/);
assert.match(worker, /Streamz Pro has been retired/);
assert.match(worker, /path === 'api\/streamz\/pro\/webhook'/, 'Stripe webhook is retained to process existing payment events');
assert.match(worker, /interaction\.data\?\.name === 'verify-pro' \|\| interaction\.data\?\.name === 'code-expired'/);
assert.match(pluginAlias, /Streamz Pro has been retired/);
assert.match(checkout, /New purchases, activations/);
assert.match(verify, /no longer available/);
assert.doesNotMatch(commands, /name: "verify-pro"|name: "code-expired"/);
assert.match(commands, /name: "contact-support"/);

console.log('Streamz Pro retirement checks passed.');
