import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../docs/assets/js/fpkg-release.js', import.meta.url), 'utf8');
const releaseModule = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { formatAssetSize, getReleaseVersion, selectInstallerAssets } = releaseModule;

assert.doesNotMatch(source, /Cached release information · checked/);
assert.doesNotMatch(source, /\$\{version\} \(cached\)/);
assert.match(source, /setStatus\(freshness\.retry \? freshness\.message/);
assert.match(source, /repository: 'rileyadams05\/FPKG-Builder'/);
assert.match(source, /api\.github\.com\/repos\/\$\{config\.repository\}\/releases\/latest/);
assert.match(source, /link\.dataset\.noGate = 'true'/);

test('the retry action remains hidden after a successful load', async () => {
    const css = await readFile(new URL('../docs/assets/css/fpkg-release.css', import.meta.url), 'utf8');
    assert.match(css, /\.fpkg-release-retry\[hidden\]\s*\{\s*display:\s*none;/);
});

test('release version is read from the GitHub release tag', () => {
    assert.equal(getReleaseVersion({ tag_name: 'v0.1.1' }), '0.1.1');
    assert.equal(getReleaseVersion({ tag_name: 'V0.2.0' }), '0.2.0');
    assert.equal(getReleaseVersion({}), 'Unknown');
});

test('only the official DEB and RPM installers are selected', () => {
    const deb = { name: 'FPKG-Builder-0.1.1-linux-x64.deb', browser_download_url: 'https://github.com/release.deb', size: 35710918 };
    const rpm = { name: 'FPKG-Builder-0.1.1-linux-x64.rpm', browser_download_url: 'https://github.com/release.rpm', size: 35696542 };
    const assets = selectInstallerAssets({ assets: [
        deb,
        rpm,
        { name: 'FPKG-Builder-0.1.1-source.zip', browser_download_url: 'https://github.com/source.zip' },
        { name: 'FPKG-Builder-0.1.1-arch-x86_64.pkg.tar.zst', browser_download_url: 'https://github.com/arch.pkg.tar.zst' },
        { name: 'SHA256SUMS', browser_download_url: 'https://github.com/SHA256SUMS' },
    ] });

    assert.equal(assets.deb, deb);
    assert.equal(assets.rpm, rpm);
    assert.equal(assets.source.name, 'FPKG-Builder-0.1.1-source.zip');
    assert.equal(assets.checksums.name, 'SHA256SUMS');
});

test('asset sizes are formatted for the release dialog', () => {
    assert.equal(formatAssetSize(0), '0 B');
    assert.equal(formatAssetSize(1024), '1.0 KB');
    assert.equal(formatAssetSize(35710918), '34.1 MB');
    assert.equal(formatAssetSize(Number.NaN), 'Size unavailable');
});
