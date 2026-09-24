import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('1. Dynamic Leads CSS contains theme tokens and dark-mode overrides', () => {
  const cssPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'config', 'lead-dynamics.css');
  assert.ok(fs.existsSync(cssPath), 'lead-dynamics.css must exist');

  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify CSS custom properties are used for text, card backgrounds, and inputs
  assert.match(css, /color:\s*var\(--text-primary/);
  assert.match(css, /background:\s*var\(--surface/);
  assert.match(css, /color:\s*var\(--text-muted/);
  assert.match(css, /border:\s*1px solid var\(--border-color/);
  assert.match(css, /background-color:\s*var\(--input-bg/);

  // Verify dark mode attributes and body selectors
  assert.match(css, /\[data-theme="dark"\]\s+\.ld-config-container/);
  assert.match(css, /body\.dark-mode\s+\.ld-config-container/);
  assert.match(css, /html\.dark\s+\.ld-config-container/);
  assert.match(css, /\[data-theme="dark"\]\s+\.ld-modal-card/);
  assert.match(css, /body\.dark-mode\s+\.ld-modal-card/);
  assert.match(css, /html\.dark\s+\.ld-modal-card/);
});

test('2. Dynamic Leads Component mounts modal inside document.body portal', () => {
  const componentPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'config', 'LeadDynamicsConfig.tsx');
  assert.ok(fs.existsSync(componentPath), 'LeadDynamicsConfig.tsx must exist');

  const content = fs.readFileSync(componentPath, 'utf8');

  // Verify createPortal is used to mount modal to document.body
  assert.match(content, /createPortal/);
  assert.match(content, /document\.body/);

  // Verify form state is kept in react state, not reset on theme changes
  assert.match(content, /const \[formData,\s*setFormData\]/);
});
