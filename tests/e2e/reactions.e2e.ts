import { test, expect } from '@playwright/test';

const cases = [
  { name: 'vittoria rossa in singolo', red: ['Diego Cogliati'], blue: ['Marco Bianchi'], scores: [10, 7], outcome: 'win' },
  { name: 'vittoria blu in doppio', red: ['Marco Bianchi', 'Giulia Rossi'], blue: ['Diego Cogliati', 'Matteo Galli'], scores: [6, 10], outcome: 'win' },
  { name: 'sconfitta anche se MVP', red: ['Marco Bianchi'], blue: ['Diego Cogliati'], scores: [10, 7], outcome: 'loss', mvp: true },
  { name: 'inserimento senza partecipare', red: ['Marco Bianchi'], blue: ['Giulia Rossi'], scores: [10, 7], outcome: null },
] as const;

for (const scenario of cases) test(scenario.name, async ({ page }, info) => {
  await page.goto('/');await page.getByRole('button', { name: 'Esplora la demo' }).click();
  const add = info.project.name === 'mobile' ? page.locator('.mobile-nav').getByRole('button', { name: 'Aggiungi', exact: true }) : page.getByRole('button', { name: 'Aggiungi partita', exact: true }).first();
  await add.click(); const dialog = page.getByRole('dialog');
  if (scenario.red.length === 1) await dialog.getByRole('button', { name: '1 contro 1' }).click();
  for (const name of [...scenario.red, ...scenario.blue]) {
    await dialog.getByRole('combobox').first().fill(name);
    await dialog.getByRole('option', { name, exact: true }).click();
  }
  await dialog.getByRole('spinbutton', { name: 'Gol Rossi' }).fill(String(scenario.scores[0]));
  await dialog.getByRole('spinbutton', { name: 'Gol Blu' }).fill(String(scenario.scores[1]));
  if ('mvp' in scenario) await dialog.getByRole('combobox', { name: 'MVP della partita' }).selectOption('diego');
  await expect(page.locator('.match-reaction')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Aggiungi la partita' }).click();
  await expect(dialog).not.toBeVisible();
  const reaction = page.locator('.match-reaction');
  if (!scenario.outcome) { await expect(reaction).toHaveCount(0); return; }
  await expect(reaction).toHaveAttribute('data-outcome', scenario.outcome);
  await expect(reaction).toContainText(scenario.outcome === 'win' ? 'Questa è tua!' : 'Ci rifacciamo alla prossima.');
  expect(await reaction.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  await expect.poll(() => reaction.locator('.reaction-message').evaluate(el => Number(getComputedStyle(el).opacity))).toBeGreaterThan(.95);
  if (scenario.name !== 'vittoria blu in doppio') await page.screenshot({ path: `test-results/reaction-${scenario.outcome}-${info.project.name}.png` });
  await expect(reaction).toHaveCount(0, { timeout: 5000 });
});
