import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

  test('Zappit CRM Dashboard Preview - Light/Dark Theme Switcher Suite', async (t) => {
    const rootDir = process.cwd();
    const pagePath = path.join(rootDir, 'src', 'app', 'page.tsx');
    const cssPath = path.join(rootDir, 'src', 'app', 'landing.css');
    const jsPath = path.join(rootDir, 'public', 'js', 'inline', 'index.js');
    const darkAssetPath = path.join(rootDir, 'public', 'assets', 'crm-dashboard-dark.png');
    const lightAssetPath = path.join(rootDir, 'public', 'assets', 'crm-dashboard-light.png');

      await t.test('1. Both Dark and Light real screenshot assets exist with matching 1024x519 dimensions', () => {
        assert.ok(fs.existsSync(darkAssetPath), 'crm-dashboard-dark.png must exist');
        assert.ok(fs.existsSync(lightAssetPath), 'crm-dashboard-light.png must exist');

        const darkBuf = fs.readFileSync(darkAssetPath);
        const lightBuf = fs.readFileSync(lightAssetPath);

        assert.equal(darkBuf[0], 0x89, 'Dark asset is a valid PNG');
        assert.equal(lightBuf[0], 0x89, 'Light asset is a valid PNG');

        const darkWidth = darkBuf.readUInt32BE(16);
        const darkHeight = darkBuf.readUInt32BE(20);
        const lightWidth = lightBuf.readUInt32BE(16);
        const lightHeight = lightBuf.readUInt32BE(20);

        assert.equal(darkWidth, 1024, 'Dark image width is 1024');
        assert.equal(darkHeight, 519, 'Dark image height is 519');
        assert.equal(lightWidth, 1024, 'Light image width matches dark image width (1024)');
        assert.equal(lightHeight, 519, 'Light image height matches dark image height (519)');
      });

      const pageContent = fs.readFileSync(pagePath, 'utf8');
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      const jsContent = fs.readFileSync(jsPath, 'utf8');

        await t.test('2. Light / Dark switch is placed above the image, aligned right and accessible', () => {
          assert.ok(pageContent.includes('class="crm-preview-toolbar"'), 'Toolbar exists above preview');
          assert.ok(pageContent.includes('class="crm-preview-theme-switch"'), 'Theme switcher capsule exists');
          assert.ok(pageContent.includes('role="group"'), 'Accessible role group on switcher');
          assert.ok(pageContent.includes('id="crm-theme-dark-btn"'), 'Dark button id present');
          assert.ok(pageContent.includes('id="crm-theme-light-btn"'), 'Light button id present');
          assert.ok(pageContent.includes('aria-pressed="true"'), 'Dark button is initially pressed');

          // CSS alignment and focus styles
          assert.ok(cssContent.includes('margin-left: auto'), 'Switcher is aligned to the right');
          assert.ok(cssContent.includes(':focus-visible'), 'Accessible visible focus states defined');
          assert.ok(cssContent.includes('min-height: 40px') || cssContent.includes('min-height: 38px'), 'Comfortable mobile touch target defined');
        });

          await t.test('3. Dark mode is default, image space is reserved, and switch avoids blank frames', () => {
            assert.ok(pageContent.includes('data-preview-theme="dark"'), 'Default preview theme is dark');
            assert.ok(pageContent.includes('/assets/crm-dashboard-dark.png'), 'Dark image referenced');
            assert.ok(pageContent.includes('/assets/crm-dashboard-light.png'), 'Light image referenced');

            // Check space reservation via aspect-ratio to prevent layout shifts
            assert.ok(cssContent.includes('aspect-ratio: 1024 / 519'), 'Image space reserved via aspect-ratio: 1024 / 519');
            assert.ok(cssContent.includes('.crm-preview-img-dark'), 'CSS targets dark image');
            assert.ok(cssContent.includes('.crm-preview-img-light'), 'CSS targets light image');
            assert.ok(cssContent.includes('will-change: opacity') || cssContent.includes('transition: opacity'), 'Seamless opacity transition defined');
          });

            await t.test('4. Rounded frame and caption dynamically coordinate their colors with selected preview', () => {
              // Dark frame styles
              assert.ok(cssContent.includes('.crm-preview-card[data-preview-theme="dark"]'), 'Dark theme selector present');
              assert.ok(cssContent.includes('#08090B') && cssContent.includes('#25282C'), 'Dark frame and border tokens present');

              // Light frame styles
              assert.ok(cssContent.includes('.crm-preview-card[data-preview-theme="light"]'), 'Light theme selector present');
              assert.ok(cssContent.includes('#FFFFFF') && cssContent.includes('#DEE5EF'), 'Light frame and border tokens present');

              // Caption exists and is preserved
              assert.ok(pageContent.includes('Zappit CRM dashboard preview'), 'Caption explicitly present');
              assert.ok(pageContent.includes('<figcaption'), 'Figcaption tag intact');
            });

              await t.test('5. Theme isolation: switch operates only on preview and does not touch global website theme', () => {
                assert.ok(jsContent.includes('initCrmPreviewThemeSwitcher'), 'JS handler registered');
                assert.ok(jsContent.includes('zappit_crm_preview_mode'), 'Isolated storage key used');
                assert.ok(!jsContent.includes("localStorage.setItem('theme'"), 'Does not overwrite global website theme');
                assert.ok(!jsContent.includes("document.documentElement.setAttribute('data-theme'"), 'Does not change html data-theme');
              });

              await t.test('6. Old mockup elements remain completely eliminated', () => {
                assert.ok(!pageContent.includes('ZAPPIT CRM WORKSPACE · SAMPLE PIPELINE'), 'Sample pipeline header gone');
                assert.ok(!pageContent.includes('Live Workspace Demo'), 'Demo badge gone');
                assert.ok(!pageContent.includes('Sarah Jenkins'), 'Mock lead gone');
                assert.ok(!pageContent.includes('+100% vs yesterday'), 'Mock percentage gone');
              });
            });
